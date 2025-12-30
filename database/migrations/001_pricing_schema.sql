-- Migration 001: Pricing Schema
-- Production-grade AWS pricing data warehouse

-- ============================================
-- TABLE: pricing_catalog_versions
-- Tracks pricing catalog ingestion metadata
-- ============================================
CREATE TABLE IF NOT EXISTS pricing_catalog_versions (
    version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service VARCHAR(100) NOT NULL,
    region_code VARCHAR(50) NOT NULL,
    source_url TEXT NOT NULL,
    published_at TIMESTAMP,
    ingested_at TIMESTAMP NOT NULL DEFAULT NOW(),
    file_hash VARCHAR(64) NOT NULL, -- SHA256
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    row_count INTEGER,
    error_message TEXT,
    
    CONSTRAINT valid_status CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED')),
    CONSTRAINT unique_ingestion UNIQUE (service, region_code, file_hash)
);

CREATE INDEX idx_catalog_versions_service ON pricing_catalog_versions(service);
CREATE INDEX idx_catalog_versions_status ON pricing_catalog_versions(status);
CREATE INDEX idx_catalog_versions_ingested ON pricing_catalog_versions(ingested_at DESC);

COMMENT ON TABLE pricing_catalog_versions IS 'Tracks AWS pricing catalog ingestion for determinism and audit';
COMMENT ON COLUMN pricing_catalog_versions.file_hash IS 'SHA256 hash for idempotency - prevents duplicate ingestion';
COMMENT ON COLUMN pricing_catalog_versions.version_id IS 'Used in estimates for reproducibility';

-- ============================================
-- TABLE: pricing_dimensions
-- Normalized pricing data from AWS catalogs
-- ============================================
CREATE TABLE IF NOT EXISTS pricing_dimensions (
    id BIGSERIAL PRIMARY KEY,
    catalog_version UUID NOT NULL REFERENCES pricing_catalog_versions(version_id) ON DELETE CASCADE,
    
    -- Core identifiers
    service VARCHAR(100) NOT NULL,
    region_code VARCHAR(50) NOT NULL, -- CANONICAL (never region name)
    sku VARCHAR(100) NOT NULL,
    
    -- Pricing dimensions
    usage_type VARCHAR(200) NOT NULL,
    operation VARCHAR(200),
    unit VARCHAR(50) NOT NULL,
    
    -- Price data
    price_per_unit NUMERIC(20, 10) NOT NULL,
    begin_range NUMERIC(20, 2) DEFAULT 0,
    end_range NUMERIC(20, 2), -- NULL = infinity
    
    -- Terms
    term_type VARCHAR(50) NOT NULL DEFAULT 'OnDemand',
    lease_contract_length VARCHAR(50),
    purchase_option VARCHAR(50),
    offering_class VARCHAR(50),
    
    -- Temporal
    effective_date DATE NOT NULL,
    
    -- Raw attributes (preserves ALL AWS metadata)
    attributes JSONB NOT NULL,
    
    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- CRITICAL: Prevent duplicate SKUs in same catalog version
    CONSTRAINT unique_pricing_sku UNIQUE (
        catalog_version, 
        service, 
        region_code, 
        sku, 
        usage_type, 
        term_type,
        begin_range,
        COALESCE(end_range, -1) -- Handle NULL end_range in unique constraint
    )
);

-- Performance indexes
CREATE INDEX idx_pricing_service_region ON pricing_dimensions(service, region_code);
CREATE INDEX idx_pricing_usage_type ON pricing_dimensions(usage_type);
CREATE INDEX idx_pricing_sku ON pricing_dimensions(sku);
CREATE INDEX idx_pricing_catalog ON pricing_dimensions(catalog_version);
CREATE INDEX idx_pricing_term_type ON pricing_dimensions(term_type);

-- JSONB attribute search
CREATE INDEX idx_pricing_attributes ON pricing_dimensions USING GIN (attributes);

COMMENT ON TABLE pricing_dimensions IS 'Fully normalized AWS pricing data - source of truth for cost calculations';
COMMENT ON COLUMN pricing_dimensions.region_code IS 'CANONICAL region code (e.g., us-east-1), never region name';
COMMENT ON COLUMN pricing_dimensions.begin_range IS 'Tiered pricing start (e.g., 0 for first tier)';
COMMENT ON COLUMN pricing_dimensions.end_range IS 'Tiered pricing end (NULL = infinity)';
COMMENT ON COLUMN pricing_dimensions.attributes IS 'Preserves ALL AWS attributes for future-proofing';

-- ============================================
-- TABLE: attribute_mappings
-- Resolves AWS vocabulary variations
-- ============================================
CREATE TABLE IF NOT EXISTS attribute_mappings (
    id SERIAL PRIMARY KEY,
    mapping_type VARCHAR(50) NOT NULL,
    input_code VARCHAR(200) NOT NULL,
    target_value VARCHAR(500) NOT NULL,
    service VARCHAR(100), -- NULL = global mapping
    
    CONSTRAINT unique_mapping UNIQUE (mapping_type, input_code, COALESCE(service, ''))
);

CREATE INDEX idx_mappings_type ON attribute_mappings(mapping_type);
CREATE INDEX idx_mappings_service ON attribute_mappings(service);

COMMENT ON TABLE attribute_mappings IS 'Translates between Terraform vocabulary and AWS billing terms';
COMMENT ON COLUMN attribute_mappings.mapping_type IS 'REGION, OS, TENANCY, LICENSE, INSTANCE_TYPE, etc.';

-- ============================================
-- Seed initial region mappings
-- ============================================
INSERT INTO attribute_mappings (mapping_type, input_code, target_value) VALUES
    ('REGION', 'us-east-1', 'US East (N. Virginia)'),
    ('REGION', 'us-east-2', 'US East (Ohio)'),
    ('REGION', 'us-west-1', 'US West (N. California)'),
    ('REGION', 'us-west-2', 'US West (Oregon)'),
    ('REGION', 'eu-west-1', 'EU (Ireland)'),
    ('REGION', 'eu-central-1', 'EU (Frankfurt)'),
    ('REGION', 'ap-south-1', 'Asia Pacific (Mumbai)'),
    ('REGION', 'ap-southeast-1', 'Asia Pacific (Singapore)'),
    ('REGION', 'ap-southeast-2', 'Asia Pacific (Sydney)'),
    ('REGION', 'ap-northeast-1', 'Asia Pacific (Tokyo)')
ON CONFLICT DO NOTHING;

-- ============================================
-- Seed OS mappings
-- ============================================
INSERT INTO attribute_mappings (mapping_type, input_code, target_value) VALUES
    ('OS', 'linux', 'Linux'),
    ('OS', 'windows', 'Windows'),
    ('OS', 'rhel', 'RHEL'),
    ('OS', 'suse', 'SUSE')
ON CONFLICT DO NOTHING;

-- ============================================
-- Seed tenancy mappings
-- ============================================
INSERT INTO attribute_mappings (mapping_type, input_code, target_value) VALUES
    ('TENANCY', 'default', 'Shared'),
    ('TENANCY', 'dedicated', 'Dedicated'),
    ('TENANCY', 'host', 'Host')
ON CONFLICT DO NOTHING;

-- ============================================
-- VIEWS: Convenient query helpers
-- ============================================

-- Latest pricing for each service/region
CREATE OR REPLACE VIEW latest_pricing_versions AS
SELECT DISTINCT ON (service, region_code)
    version_id,
    service,
    region_code,
    ingested_at,
    status
FROM pricing_catalog_versions
WHERE status = 'COMPLETED'
ORDER BY service, region_code, ingested_at DESC;

COMMENT ON VIEW latest_pricing_versions IS 'Returns latest successfully ingested catalog version per service/region';

-- ============================================
-- FUNCTIONS: Helper queries
-- ============================================

-- Get pricing for usage
CREATE OR REPLACE FUNCTION get_pricing(
    p_service VARCHAR,
    p_region VARCHAR,
    p_usage_type VARCHAR,
    p_quantity NUMERIC DEFAULT 1,
    p_catalog_version UUID DEFAULT NULL
) RETURNS TABLE (
    sku VARCHAR,
    unit VARCHAR,
    price_per_unit NUMERIC,
    quantity_in_tier NUMERIC,
    tier_cost NUMERIC
) AS $$
DECLARE
    v_catalog_version UUID;
BEGIN
    -- Use specified version or latest
    IF p_catalog_version IS NULL THEN
        SELECT version_id INTO v_catalog_version
        FROM latest_pricing_versions
        WHERE service = p_service AND region_code = p_region;
    ELSE
        v_catalog_version := p_catalog_version;
    END IF;
    
    -- Return tiered pricing breakdown
    RETURN QUERY
    SELECT 
        pd.sku,
        pd.unit,
        pd.price_per_unit,
        CASE 
            WHEN pd.end_range IS NULL THEN p_quantity - pd.begin_range
            WHEN p_quantity > pd.end_range THEN pd.end_range - pd.begin_range
            ELSE GREATEST(0, p_quantity - pd.begin_range)
        END AS quantity_in_tier,
        CASE 
            WHEN pd.end_range IS NULL THEN (p_quantity - pd.begin_range) * pd.price_per_unit
            WHEN p_quantity > pd.end_range THEN (pd.end_range - pd.begin_range) * pd.price_per_unit
            ELSE GREATEST(0, p_quantity - pd.begin_range) * pd.price_per_unit
        END AS tier_cost
    FROM pricing_dimensions pd
    WHERE pd.catalog_version = v_catalog_version
        AND pd.service = p_service
        AND pd.region_code = p_region
        AND pd.usage_type = p_usage_type
        AND pd.term_type = 'OnDemand'
        AND pd.begin_range < p_quantity
    ORDER BY pd.begin_range;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_pricing IS 'Calculates tiered pricing for a given usage quantity';

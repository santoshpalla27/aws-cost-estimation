/**
 * PostgreSQL Database Layer
 * Connection pooling and query helpers for pricing data
 */

import pg from 'pg';
import { from as copyFrom } from 'pg-copy-streams';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import type {
    CatalogVersion,
    NormalizedPricingDimension,
    AttributeMapping,
} from '../types/pricing.js';

const { Pool } = pg;

// Connection pool
const pool = new Pool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.database,
    user: config.database.user,
    password: config.database.password,
    max: config.database.maxConnections,
});

pool.on('error', (err) => {
    logger.error({ err }, 'Unexpected database pool error');
});

/**
 * Initialize database schema
 */
export async function initializeSchema(): Promise<void> {
    const client = await pool.connect();
    try {
        await client.query(`
      -- Catalog versions table
      CREATE TABLE IF NOT EXISTS catalog_versions (
        id SERIAL PRIMARY KEY,
        service VARCHAR(64) NOT NULL,
        source_url TEXT NOT NULL,
        version_hash VARCHAR(64) NOT NULL,
        etag VARCHAR(128),
        publication_date TIMESTAMPTZ,
        ingested_at TIMESTAMPTZ DEFAULT NOW(),
        record_count INT DEFAULT 0,
        status VARCHAR(32) DEFAULT 'pending',
        error_message TEXT,
        UNIQUE(service, version_hash)
      );

      -- Pricing dimensions table (core pricing data)
      CREATE TABLE IF NOT EXISTS pricing_dimensions (
        id BIGSERIAL PRIMARY KEY,
        catalog_version_id INT NOT NULL REFERENCES catalog_versions(id) ON DELETE CASCADE,
        service VARCHAR(64) NOT NULL,
        region_code VARCHAR(32) NOT NULL,
        usage_type VARCHAR(256) NOT NULL,
        operation VARCHAR(256),
        unit VARCHAR(64) NOT NULL,
        price_per_unit DECIMAL(24, 12) NOT NULL,
        currency VARCHAR(8) NOT NULL DEFAULT 'USD',
        begin_range DECIMAL(24, 8),
        end_range DECIMAL(24, 8),
        term_type VARCHAR(32) NOT NULL,
        sku VARCHAR(64) NOT NULL,
        rate_code VARCHAR(128) NOT NULL,
        description TEXT,
        product_family VARCHAR(128),
        attributes JSONB
      );

      -- Attribute mappings (Rosetta table)
      CREATE TABLE IF NOT EXISTS attribute_mappings (
        id SERIAL PRIMARY KEY,
        catalog_version_id INT NOT NULL REFERENCES catalog_versions(id) ON DELETE CASCADE,
        mapping_type VARCHAR(64) NOT NULL,
        source_value VARCHAR(256) NOT NULL,
        target_value VARCHAR(256) NOT NULL,
        UNIQUE(catalog_version_id, mapping_type, source_value)
      );

      -- Pricing overrides (for custom pricing)
      CREATE TABLE IF NOT EXISTS pricing_overrides (
        id SERIAL PRIMARY KEY,
        service VARCHAR(64) NOT NULL,
        region_code VARCHAR(32),
        usage_type_pattern VARCHAR(256),
        override_price DECIMAL(24, 12),
        override_percentage DECIMAL(8, 4),
        reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ
      );

      -- Indexes for fast lookups
      CREATE INDEX IF NOT EXISTS idx_pricing_lookup 
        ON pricing_dimensions(service, region_code, usage_type);
      CREATE INDEX IF NOT EXISTS idx_pricing_term 
        ON pricing_dimensions(term_type);
      CREATE INDEX IF NOT EXISTS idx_pricing_sku 
        ON pricing_dimensions(sku);
      CREATE INDEX IF NOT EXISTS idx_pricing_catalog 
        ON pricing_dimensions(catalog_version_id);
      CREATE INDEX IF NOT EXISTS idx_pricing_attributes 
        ON pricing_dimensions USING GIN(attributes);
      
      CREATE INDEX IF NOT EXISTS idx_mappings_lookup 
        ON attribute_mappings(mapping_type, source_value);
      CREATE INDEX IF NOT EXISTS idx_mappings_catalog 
        ON attribute_mappings(catalog_version_id);
    `);
        logger.info('Database schema initialized');
    } finally {
        client.release();
    }
}

/**
 * Create or get existing catalog version
 */
export async function upsertCatalogVersion(
    version: Omit<CatalogVersion, 'id' | 'ingestedAt'>
): Promise<CatalogVersion> {
    const result = await pool.query<CatalogVersion & { id: number }>(
        `INSERT INTO catalog_versions (service, source_url, version_hash, etag, publication_date, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (service, version_hash) 
     DO UPDATE SET 
       status = EXCLUDED.status,
       etag = EXCLUDED.etag
     RETURNING id, service, source_url, version_hash, etag, publication_date, ingested_at, record_count, status, error_message`,
        [
            version.service,
            version.sourceUrl,
            version.versionHash,
            version.etag,
            version.publicationDate,
            version.status,
        ]
    );
    return result.rows[0]!;
}

/**
 * Update catalog version status
 */
export async function updateCatalogVersionStatus(
    id: number,
    status: CatalogVersion['status'],
    recordCount?: number,
    errorMessage?: string
): Promise<void> {
    await pool.query(
        `UPDATE catalog_versions 
     SET status = $2, record_count = COALESCE($3, record_count), error_message = $4
     WHERE id = $1`,
        [id, status, recordCount, errorMessage]
    );
}

/**
 * Get latest catalog version for a service
 */
export async function getLatestCatalogVersion(
    service: string
): Promise<CatalogVersion | null> {
    const result = await pool.query<CatalogVersion>(
        `SELECT * FROM catalog_versions 
     WHERE service = $1 AND status = 'completed'
     ORDER BY ingested_at DESC 
     LIMIT 1`,
        [service]
    );
    return result.rows[0] ?? null;
}

/**
 * Delete old catalog versions for a service (keep last N)
 */
export async function pruneOldCatalogVersions(
    service: string,
    keepCount: number = 3
): Promise<number> {
    const result = await pool.query(
        `WITH old_versions AS (
       SELECT id FROM catalog_versions 
       WHERE service = $1 
       ORDER BY ingested_at DESC 
       OFFSET $2
     )
     DELETE FROM catalog_versions 
     WHERE id IN (SELECT id FROM old_versions)
     RETURNING id`,
        [service, keepCount]
    );
    return result.rowCount ?? 0;
}

/**
 * Bulk insert pricing dimensions using COPY for maximum performance
 */
export async function bulkInsertPricingDimensions(
    dimensions: NormalizedPricingDimension[]
): Promise<number> {
    if (dimensions.length === 0) return 0;

    const client = await pool.connect();
    try {
        const copyStream = client.query(
            copyFrom(`
        COPY pricing_dimensions (
          catalog_version_id, service, region_code, usage_type, operation,
          unit, price_per_unit, currency, begin_range, end_range,
          term_type, sku, rate_code, description, product_family, attributes
        ) FROM STDIN WITH (FORMAT csv, NULL 'NULL')
      `)
        );

        const csvStream = Readable.from(
            dimensions.map((d) =>
                [
                    d.catalogVersionId,
                    escapeCsv(d.service),
                    escapeCsv(d.regionCode),
                    escapeCsv(d.usageType),
                    d.operation ? escapeCsv(d.operation) : 'NULL',
                    escapeCsv(d.unit),
                    d.pricePerUnit,
                    d.currency,
                    d.beginRange ?? 'NULL',
                    d.endRange ?? 'NULL',
                    d.termType,
                    escapeCsv(d.sku),
                    escapeCsv(d.rateCode),
                    d.description ? escapeCsv(d.description) : 'NULL',
                    d.productFamily ? escapeCsv(d.productFamily) : 'NULL',
                    escapeCsv(JSON.stringify(d.attributes)),
                ].join(',') + '\n'
            )
        );

        await pipeline(csvStream, copyStream);
        return dimensions.length;
    } finally {
        client.release();
    }
}

/**
 * Bulk insert attribute mappings
 */
export async function bulkInsertAttributeMappings(
    mappings: AttributeMapping[]
): Promise<number> {
    if (mappings.length === 0) return 0;

    const client = await pool.connect();
    try {
        // Use multi-row INSERT with ON CONFLICT for mappings (smaller dataset)
        const values: unknown[] = [];
        const placeholders: string[] = [];

        mappings.forEach((m, i) => {
            const offset = i * 4;
            placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
            values.push(m.catalogVersionId, m.mappingType, m.sourceValue, m.targetValue);
        });

        await client.query(
            `INSERT INTO attribute_mappings (catalog_version_id, mapping_type, source_value, target_value)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (catalog_version_id, mapping_type, source_value) DO NOTHING`,
            values
        );

        return mappings.length;
    } finally {
        client.release();
    }
}

/**
 * Check if a catalog version already exists
 */
export async function catalogVersionExists(
    service: string,
    versionHash: string
): Promise<boolean> {
    const result = await pool.query(
        `SELECT 1 FROM catalog_versions 
     WHERE service = $1 AND version_hash = $2 AND status = 'completed'`,
        [service, versionHash]
    );
    return (result.rowCount ?? 0) > 0;
}

/**
 * Get ingestion statistics
 */
export async function getIngestionStats(): Promise<{
    totalServices: number;
    totalRecords: number;
    lastIngestedAt: Date | null;
}> {
    const result = await pool.query(`
    SELECT 
      COUNT(DISTINCT service) as total_services,
      SUM(record_count) as total_records,
      MAX(ingested_at) as last_ingested_at
    FROM catalog_versions
    WHERE status = 'completed'
  `);
    const row = result.rows[0];
    return {
        totalServices: parseInt(row?.total_services ?? '0', 10),
        totalRecords: parseInt(row?.total_records ?? '0', 10),
        lastIngestedAt: row?.last_ingested_at ?? null,
    };
}

/**
 * Close database connections
 */
export async function closeDatabase(): Promise<void> {
    await pool.end();
    logger.info('Database connections closed');
}

/**
 * Escape a value for CSV format
 */
function escapeCsv(value: string): string {
    if (value.includes('"') || value.includes(',') || value.includes('\n')) {
        return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
}

export { pool };

// Package pricing provides the pricing match engine that queries
// the pricing warehouse and matches usage vectors to prices
package pricing

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/santoshpalla27/aws-cost-estimation/cost-engine/internal/types"
)

// Matcher queries the pricing warehouse and matches usage vectors to prices
type Matcher struct {
	pool *pgxpool.Pool
}

// NewMatcher creates a new pricing matcher
func NewMatcher(pool *pgxpool.Pool) *Matcher {
	return &Matcher{pool: pool}
}

// PricingDimension represents a row from the pricing_dimensions table
type PricingDimension struct {
	ID            int64
	Service       string
	RegionCode    string
	UsageType     string
	Operation     string
	Unit          string
	PricePerUnit  float64
	Currency      string
	BeginRange    *float64
	EndRange      *float64
	TermType      string
	SKU           string
	RateCode      string
	ProductFamily string
	Attributes    map[string]string
}

// Match finds the best pricing match for a usage vector
func (m *Matcher) Match(ctx context.Context, vector types.UsageVector) (*types.PricedItem, error) {
	// Convert region format if needed (us-east-1 -> US East (N. Virginia))
	regionCode := normalizeRegion(vector.Region)

	// Try exact match first
	dim, score, err := m.findBestMatch(ctx, vector, regionCode)
	if err != nil {
		return nil, err
	}

	if dim == nil {
		// No match found
		return &types.PricedItem{
			UsageVector:     vector,
			PricePerUnit:    0,
			MonthlyCost:     0,
			Currency:        "USD",
			MatchConfidence: types.ConfidenceUnknown,
			MatchScore:      0,
			PricingSource:   "NOT_FOUND",
			Formula:         "No pricing match found",
		}, nil
	}

	monthlyCost := vector.Quantity * dim.PricePerUnit
	
	// Determine match confidence based on score
	var confidence types.Confidence
	switch {
	case score >= 0.95:
		confidence = types.ConfidenceHigh
	case score >= 0.7:
		confidence = types.ConfidenceMedium
	default:
		confidence = types.ConfidenceLow
	}

	return &types.PricedItem{
		UsageVector:     vector,
		PricePerUnit:    dim.PricePerUnit,
		MonthlyCost:     monthlyCost,
		Currency:        dim.Currency,
		MatchConfidence: confidence,
		MatchScore:      score,
		PricingSource:   dim.SKU,
		Formula:         fmt.Sprintf("%.2f %s × $%.6f/%s", vector.Quantity, vector.Unit, dim.PricePerUnit, dim.Unit),
	}, nil
}

// findBestMatch searches for the best pricing match
func (m *Matcher) findBestMatch(ctx context.Context, vector types.UsageVector, region string) (*PricingDimension, float64, error) {
	// Strategy 1: Exact usage_type match
	dim, err := m.queryExact(ctx, vector.Service, region, vector.UsageType)
	if err != nil {
		return nil, 0, err
	}
	if dim != nil {
		return dim, 1.0, nil
	}

	// Strategy 2: Pattern match on usage_type
	dim, err = m.queryPattern(ctx, vector.Service, region, vector.UsageType)
	if err != nil {
		return nil, 0, err
	}
	if dim != nil {
		return dim, 0.85, nil
	}

	// Strategy 3: Try without region prefix
	usageWithoutRegion := removeRegionPrefix(vector.UsageType)
	if usageWithoutRegion != vector.UsageType {
		dim, err = m.queryPattern(ctx, vector.Service, region, usageWithoutRegion)
		if err != nil {
			return nil, 0, err
		}
		if dim != nil {
			return dim, 0.75, nil
		}
	}

	// Strategy 4: Attribute-based matching for EC2 instances
	if strings.HasPrefix(vector.UsageType, "BoxUsage:") {
		instanceType := strings.TrimPrefix(vector.UsageType, "BoxUsage:")
		dim, err = m.queryInstanceType(ctx, vector.Service, region, instanceType, vector.Attributes)
		if err != nil {
			return nil, 0, err
		}
		if dim != nil {
			return dim, 0.9, nil
		}
	}

	return nil, 0, nil
}

// queryExact performs an exact match query
func (m *Matcher) queryExact(ctx context.Context, service, region, usageType string) (*PricingDimension, error) {
	query := `
		SELECT id, service, region_code, usage_type, operation, unit, 
		       price_per_unit, currency, begin_range, end_range, term_type, 
		       sku, rate_code, product_family, attributes
		FROM pricing_dimensions
		WHERE service = $1 
		  AND region_code = $2 
		  AND usage_type = $3
		  AND term_type = 'OnDemand'
		ORDER BY price_per_unit ASC
		LIMIT 1
	`

	return m.scanDimension(ctx, query, service, region, usageType)
}

// queryPattern performs a pattern match query
func (m *Matcher) queryPattern(ctx context.Context, service, region, pattern string) (*PricingDimension, error) {
	// Use ILIKE for case-insensitive pattern matching
	query := `
		SELECT id, service, region_code, usage_type, operation, unit, 
		       price_per_unit, currency, begin_range, end_range, term_type, 
		       sku, rate_code, product_family, attributes
		FROM pricing_dimensions
		WHERE service = $1 
		  AND region_code = $2 
		  AND usage_type ILIKE $3
		  AND term_type = 'OnDemand'
		ORDER BY price_per_unit ASC
		LIMIT 1
	`

	return m.scanDimension(ctx, query, service, region, "%"+pattern+"%")
}

// queryInstanceType performs EC2 instance-specific matching using attributes
func (m *Matcher) queryInstanceType(ctx context.Context, service, region, instanceType string, attrs map[string]string) (*PricingDimension, error) {
	os := attrs["operatingSystem"]
	if os == "" {
		os = "Linux"
	}
	tenancy := attrs["tenancy"]
	if tenancy == "" {
		tenancy = "Shared"
	}

	query := `
		SELECT id, service, region_code, usage_type, operation, unit, 
		       price_per_unit, currency, begin_range, end_range, term_type, 
		       sku, rate_code, product_family, attributes
		FROM pricing_dimensions
		WHERE service = $1 
		  AND region_code = $2
		  AND attributes->>'instanceType' = $3
		  AND attributes->>'operatingSystem' = $4
		  AND attributes->>'tenancy' = $5
		  AND term_type = 'OnDemand'
		ORDER BY price_per_unit ASC
		LIMIT 1
	`

	return m.scanDimension(ctx, query, service, region, instanceType, os, tenancy)
}

// scanDimension scans a single pricing dimension from a query result
func (m *Matcher) scanDimension(ctx context.Context, query string, args ...interface{}) (*PricingDimension, error) {
	row := m.pool.QueryRow(ctx, query, args...)

	dim := &PricingDimension{
		Attributes: make(map[string]string),
	}

	var attrJSON []byte
	err := row.Scan(
		&dim.ID, &dim.Service, &dim.RegionCode, &dim.UsageType, &dim.Operation,
		&dim.Unit, &dim.PricePerUnit, &dim.Currency, &dim.BeginRange, &dim.EndRange,
		&dim.TermType, &dim.SKU, &dim.RateCode, &dim.ProductFamily, &attrJSON,
	)

	if err != nil {
		if err.Error() == "no rows in result set" {
			return nil, nil
		}
		return nil, err
	}

	return dim, nil
}

// normalizeRegion converts AWS region codes to pricing region format
func normalizeRegion(region string) string {
	// The pricing data uses region codes like "us-east-1"
	// so we just return as-is
	return region
}

// removeRegionPrefix removes common region prefixes from usage type
func removeRegionPrefix(usageType string) string {
	prefixes := []string{
		"USE1-", "USE2-", "USW1-", "USW2-",
		"EUW1-", "EUW2-", "EUW3-",
		"APN1-", "APN2-", "APS1-", "APS2-",
	}

	for _, prefix := range prefixes {
		if strings.HasPrefix(usageType, prefix) {
			return strings.TrimPrefix(usageType, prefix)
		}
	}

	return usageType
}

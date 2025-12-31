// Package pricing provides the pricing match engine that queries
// the pricing warehouse and matches usage vectors to prices
package pricing

import (
	"context"
	"fmt"
	"log"
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
	ID           int64
	Service      string
	RegionCode   string
	UsageType    string
	Operation    *string
	Unit         string
	PricePerUnit float64
	Currency     string
	BeginRange   *float64
	EndRange     *float64
	TermType     string
	SKU          string
	Description  *string
}

// Match finds the best pricing match for a usage vector
func (m *Matcher) Match(ctx context.Context, vector types.UsageVector) (*types.PricedItem, error) {
	// Try multiple matching strategies
	dim, score, err := m.findBestMatch(ctx, vector)
	if err != nil {
		log.Printf("Match error for %s: %v", vector.UsageType, err)
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

// findBestMatch searches for the best pricing match using multiple strategies
func (m *Matcher) findBestMatch(ctx context.Context, vector types.UsageVector) (*PricingDimension, float64, error) {
	// Strategy 1: For EC2 BoxUsage, match by instanceType attribute
	if strings.HasPrefix(vector.UsageType, "BoxUsage:") {
		instanceType := strings.TrimPrefix(vector.UsageType, "BoxUsage:")
		dim, err := m.queryEC2ByInstanceType(ctx, vector.Region, instanceType, vector.Attributes)
		if err != nil {
			log.Printf("EC2 instance query error: %v", err)
		} else if dim != nil {
			return dim, 0.95, nil
		}
	}

	// Strategy 2: For EBS, match by volume type in usage_type
	if strings.HasPrefix(vector.UsageType, "EBS:VolumeUsage.") {
		volumeType := strings.TrimPrefix(vector.UsageType, "EBS:VolumeUsage.")
		dim, err := m.queryEBSVolume(ctx, vector.Region, volumeType)
		if err != nil {
			log.Printf("EBS query error: %v", err)
		} else if dim != nil {
			return dim, 0.9, nil
		}
	}

	// Strategy 3: Generic pattern match
	dim, err := m.queryGenericPattern(ctx, vector.Service, vector.Region, vector.UsageType)
	if err != nil {
		log.Printf("Generic pattern error: %v", err)
	} else if dim != nil {
		return dim, 0.7, nil
	}

	return nil, 0, nil
}

// queryEC2ByInstanceType finds EC2 pricing by instance type and attributes
func (m *Matcher) queryEC2ByInstanceType(ctx context.Context, region, instanceType string, attrs map[string]string) (*PricingDimension, error) {
	os := attrs["operatingSystem"]
	if os == "" {
		os = "Linux"
	}
	tenancy := attrs["tenancy"]
	if tenancy == "" {
		tenancy = "Shared"
	}

	// First try: Match using JSONB attributes
	query := `
		SELECT id, service, region_code, usage_type, operation, unit, 
		       price_per_unit, currency, begin_range, end_range, term_type, 
		       sku, description
		FROM pricing_dimensions
		WHERE service = 'AmazonEC2'
		  AND region_code = $1
		  AND attributes->>'instanceType' = $2
		  AND attributes->>'operatingSystem' = $3
		  AND attributes->>'tenancy' = $4
		  AND term_type = 'OnDemand'
		  AND price_per_unit > 0
		ORDER BY price_per_unit ASC
		LIMIT 1
	`

	dim, err := m.scanDimension(ctx, query, region, instanceType, os, tenancy)
	if err != nil || dim != nil {
		return dim, err
	}

	// Second try: Match any OS with the instance type
	query2 := `
		SELECT id, service, region_code, usage_type, operation, unit, 
		       price_per_unit, currency, begin_range, end_range, term_type, 
		       sku, description
		FROM pricing_dimensions
		WHERE service = 'AmazonEC2'
		  AND region_code = $1
		  AND attributes->>'instanceType' = $2
		  AND term_type = 'OnDemand'
		  AND price_per_unit > 0
		ORDER BY price_per_unit ASC
		LIMIT 1
	`

	return m.scanDimension(ctx, query2, region, instanceType)
}

// queryEBSVolume finds EBS volume pricing
func (m *Matcher) queryEBSVolume(ctx context.Context, region, volumeType string) (*PricingDimension, error) {
	query := `
		SELECT id, service, region_code, usage_type, operation, unit, 
		       price_per_unit, currency, begin_range, end_range, term_type, 
		       sku, description
		FROM pricing_dimensions
		WHERE service = 'AmazonEC2'
		  AND region_code = $1
		  AND usage_type ILIKE $2
		  AND term_type = 'OnDemand'
		  AND price_per_unit > 0
		ORDER BY price_per_unit ASC
		LIMIT 1
	`

	return m.scanDimension(ctx, query, region, "%"+volumeType+"%")
}

// queryGenericPattern performs a generic pattern match
func (m *Matcher) queryGenericPattern(ctx context.Context, service, region, usageType string) (*PricingDimension, error) {
	query := `
		SELECT id, service, region_code, usage_type, operation, unit, 
		       price_per_unit, currency, begin_range, end_range, term_type, 
		       sku, description
		FROM pricing_dimensions
		WHERE service = $1
		  AND region_code = $2
		  AND usage_type ILIKE $3
		  AND term_type = 'OnDemand'
		  AND price_per_unit > 0
		ORDER BY price_per_unit ASC
		LIMIT 1
	`

	return m.scanDimension(ctx, query, service, region, "%"+usageType+"%")
}

// scanDimension scans a single pricing dimension from a query result
func (m *Matcher) scanDimension(ctx context.Context, query string, args ...interface{}) (*PricingDimension, error) {
	row := m.pool.QueryRow(ctx, query, args...)

	dim := &PricingDimension{}

	err := row.Scan(
		&dim.ID, &dim.Service, &dim.RegionCode, &dim.UsageType, &dim.Operation,
		&dim.Unit, &dim.PricePerUnit, &dim.Currency, &dim.BeginRange, &dim.EndRange,
		&dim.TermType, &dim.SKU, &dim.Description,
	)

	if err != nil {
		if err.Error() == "no rows in result set" {
			return nil, nil
		}
		return nil, err
	}

	return dim, nil
}

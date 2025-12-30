package pricing

import (
	"database/sql"
	"fmt"

	"github.com/aws-cost-estimation/cost-engine/pkg/database"
	"github.com/aws-cost-estimation/cost-engine/pkg/types"
	log "github.com/sirupsen/logrus"
)

// Engine matches usage vectors to pricing data
type Engine struct {
	db *database.DB
}

func NewEngine(db *database.DB) *Engine {
	return &Engine{db: db}
}

// CalculateCost matches usage vectors to pricing and calculates costs
func (e *Engine) CalculateCost(vectors []types.UsageVector) ([]types.CostItem, error) {
	var costItems []types.CostItem

	for _, vector := range vectors {
		item, err := e.calculateSingle(vector)
		if err != nil {
			log.WithFields(log.Fields{
				"service":    vector.Service,
				"usage_type": vector.UsageType,
				"error":      err.Error(),
			}).Warn("Failed to calculate cost for usage vector")
			continue
		}

		costItems = append(costItems, item)
	}

	return costItems, nil
}

func (e *Engine) calculateSingle(vector types.UsageVector) (types.CostItem, error) {
	// Try to match pricing
	priceMatch, err := e.matchPricing(vector)
	if err != nil {
		return types.CostItem{}, err
	}

	// Calculate tiered cost
	totalCost := e.calculateTieredCost(vector.Quantity, priceMatch)

	// Determine overall confidence (lowest of usage vector and pricing match)
	confidence := vector.Confidence
	if priceMatch.MatchType == types.MatchHeuristic {
		confidence = types.ConfidenceLow
	}

	item := types.CostItem{
		Service:      vector.Service,
		Region:       vector.Region,
		UsageType:    vector.UsageType,
		Quantity:     vector.Quantity,
		Unit:         vector.Unit,
		PricePerUnit: priceMatch.PricePerUnit,
		TotalCost:    totalCost,
		SKU:          priceMatch.SKU,
		Confidence:   confidence,
		MatchType:    priceMatch.MatchType,
		Explanation:  e.generateExplanation(vector, priceMatch, totalCost),
	}

	if resourceAddr, ok := vector.Metadata["resource"].(string); ok {
		item.ResourceAddress = resourceAddr
	}

	return item, nil
}

func (e *Engine) matchPricing(vector types.UsageVector) (*types.PricingMatch, error) {
	// Try exact match first
	match, err := e.exactMatch(vector)
	if err == nil {
		match.MatchType = types.MatchExact
		return match, nil
	}

	// Try fallback match (relax some attributes)
	match, err = e.fallbackMatch(vector)
	if err == nil {
		match.MatchType = types.MatchFallback
		log.WithField("usage_type", vector.UsageType).Info("Using fallback pricing match")
		return match, nil
	}

	// No match found - NEVER return zero silently
	return nil, fmt.Errorf("no pricing found for %s in %s (usage: %s)", vector.Service, vector.Region, vector.UsageType)
}

func (e *Engine) exactMatch(vector types.UsageVector) (*types.PricingMatch, error) {
	query := `
		SELECT sku, service, region_code, usage_type, unit, price_per_unit, begin_range, end_range, attributes
		FROM pricing_dimensions pd
		INNER JOIN latest_pricing_versions lpv ON pd.catalog_version = lpv.version_id
		WHERE pd.service = $1
		  AND pd.region_code = $2
		  AND pd.usage_type = $3
		  AND pd.term_type = 'OnDemand'
		ORDER BY pd.begin_range
		LIMIT 1
	`

	row := e.db.QueryRow(query, vector.Service, vector.Region, vector.UsageType)

	var match types.PricingMatch
	var endRange sql.NullFloat64
	var attributes string

	err := row.Scan(
		&match.SKU,
		&match.Service,
		&match.RegionCode,
		&match.UsageType,
		&match.Unit,
		&match.PricePerUnit,
		&match.BeginRange,
		&endRange,
		&attributes,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("no exact match found")
	}
	if err != nil {
		return nil, err
	}

	if endRange.Valid {
		val := endRange.Float64
		match.EndRange = &val
	}

	return &match, nil
}

func (e *Engine) fallbackMatch(vector types.UsageVector) (*types.PricingMatch, error) {
	// Try to find similar usage types (fuzzy matching)
	// For now, just return error - heuristic matching would go here
	return nil, fmt.Errorf("fallback matching not implemented")
}

func (e *Engine) calculateTieredCost(quantity float64, match *types.PricingMatch) float64 {
	// For now, simple calculation (not tiered)
	// Full tiered logic would sum across tiers
	return quantity * match.PricePerUnit
}

func (e *Engine) generateExplanation(vector types.UsageVector, match *types.PricingMatch, totalCost float64) string {
	return fmt.Sprintf(
		"%s: %.2f %s × $%.6f/%s = $%.2f/mo",
		vector.Service,
		vector.Quantity,
		vector.Unit,
		match.PricePerUnit,
		match.Unit,
		totalCost,
	)
}

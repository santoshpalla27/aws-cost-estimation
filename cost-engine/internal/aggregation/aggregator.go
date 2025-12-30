// Package aggregation provides cost aggregation and confidence propagation
package aggregation

import (
	"github.com/santoshpalla27/aws-cost-estimation/cost-engine/internal/types"
)

// Aggregator combines priced items into resource and service-level costs
type Aggregator struct{}

// NewAggregator creates a new cost aggregator
func NewAggregator() *Aggregator {
	return &Aggregator{}
}

// Aggregate combines all priced items into a complete cost estimate
func (a *Aggregator) Aggregate(items []types.PricedItem, metadata types.EstimateMetadata) types.CostEstimate {
	estimate := types.CostEstimate{
		Currency:    "USD",
		ByService:   make(map[string]types.ServiceCost),
		ByResource:  []types.ResourceCost{},
		Assumptions: []string{},
		Warnings:    []string{},
		Metadata:    metadata,
	}

	// Group items by resource address
	resourceMap := make(map[string]*types.ResourceCost)

	for _, item := range items {
		// Get or create resource cost
		rc, exists := resourceMap[item.ResourceAddress]
		if !exists {
			rc = &types.ResourceCost{
				Address:     item.ResourceAddress,
				Service:     item.Service,
				LineItems:   []types.PricedItem{},
				Assumptions: []string{},
			}
			
			// Extract type and name from address
			rc.Type, rc.Name = parseResourceAddress(item.ResourceAddress)
			resourceMap[item.ResourceAddress] = rc
		}

		// Add line item
		rc.LineItems = append(rc.LineItems, item)
		rc.MonthlyCost += item.MonthlyCost

		// Collect assumptions
		rc.Assumptions = append(rc.Assumptions, item.Assumptions...)

		// Update total
		estimate.TotalMonthlyCost += item.MonthlyCost
	}

	// Calculate resource confidence and convert to slice
	for _, rc := range resourceMap {
		rc.Confidence = a.calculateResourceConfidence(rc.LineItems)
		estimate.ByResource = append(estimate.ByResource, *rc)
		estimate.Assumptions = append(estimate.Assumptions, rc.Assumptions...)

		// Aggregate by service
		if sc, exists := estimate.ByService[rc.Service]; exists {
			sc.MonthlyCost += rc.MonthlyCost
			sc.ResourceCount++
			sc.Confidence = a.lowerConfidence(sc.Confidence, rc.Confidence)
			estimate.ByService[rc.Service] = sc
		} else {
			estimate.ByService[rc.Service] = types.ServiceCost{
				Service:       rc.Service,
				MonthlyCost:   rc.MonthlyCost,
				ResourceCount: 1,
				Confidence:    rc.Confidence,
			}
		}
	}

	// Calculate overall confidence
	estimate.OverallConfidence = a.calculateOverallConfidence(estimate.ByResource)

	// Deduplicate assumptions
	estimate.Assumptions = uniqueStrings(estimate.Assumptions)

	return estimate
}

// calculateResourceConfidence determines confidence for a resource based on its line items
func (a *Aggregator) calculateResourceConfidence(items []types.PricedItem) types.Confidence {
	if len(items) == 0 {
		return types.ConfidenceUnknown
	}

	lowestConfidence := types.ConfidenceHigh

	for _, item := range items {
		lowestConfidence = a.lowerConfidence(lowestConfidence, item.MatchConfidence)
	}

	return lowestConfidence
}

// calculateOverallConfidence determines overall confidence from all resources
func (a *Aggregator) calculateOverallConfidence(resources []types.ResourceCost) types.Confidence {
	if len(resources) == 0 {
		return types.ConfidenceUnknown
	}

	lowestConfidence := types.ConfidenceHigh

	for _, rc := range resources {
		lowestConfidence = a.lowerConfidence(lowestConfidence, rc.Confidence)
	}

	return lowestConfidence
}

// lowerConfidence returns the lower of two confidence levels
func (a *Aggregator) lowerConfidence(a1, b types.Confidence) types.Confidence {
	confidenceOrder := map[types.Confidence]int{
		types.ConfidenceUnknown: 0,
		types.ConfidenceLow:     1,
		types.ConfidenceMedium:  2,
		types.ConfidenceHigh:    3,
	}

	if confidenceOrder[a1] < confidenceOrder[b] {
		return a1
	}
	return b
}

// parseResourceAddress extracts type and name from a Terraform resource address
func parseResourceAddress(address string) (resourceType, name string) {
	// Handle indexed resources like aws_instance.web[0]
	if idx := indexOfByte(address, '['); idx >= 0 {
		address = address[:idx]
	}

	// Split by dot
	if dot := indexOfByte(address, '.'); dot >= 0 {
		return address[:dot], address[dot+1:]
	}

	return address, ""
}

// indexOfByte returns the index of the first occurrence of c in s
func indexOfByte(s string, c byte) int {
	for i := 0; i < len(s); i++ {
		if s[i] == c {
			return i
		}
	}
	return -1
}

// uniqueStrings removes duplicates from a string slice
func uniqueStrings(strings []string) []string {
	seen := make(map[string]bool)
	result := []string{}

	for _, s := range strings {
		if !seen[s] {
			seen[s] = true
			result = append(result, s)
		}
	}

	return result
}

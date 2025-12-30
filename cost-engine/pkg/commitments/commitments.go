package commitments

import (
	"github.com/aws-cost-estimation/cost-engine/pkg/types"
)

// PricingScenario represents different pricing strategies
type PricingScenario string

const (
	ScenarioOnDemand            PricingScenario = "ON_DEMAND"
	ScenarioWithSavingsPlans    PricingScenario = "WITH_SAVINGS_PLANS"
	ScenarioWithReservedInstances PricingScenario = "WITH_RESERVED_INSTANCES"
	ScenarioWithOverrides       PricingScenario = "WITH_OVERRIDES"
)

// SavingsPlan represents a compute savings plan
type SavingsPlan struct {
	ID               string
	Type             string  // Compute or EC2Instance
	HourlyCommitment float64 // USD per hour
	DiscountPercent  float64 // e.g., 0.28 for 28%
	Term             string  // 1yr or 3yr
	PaymentOption    string  // All Upfront, Partial Upfront, No Upfront
	AppliesTo        []string // Service names (e.g., ["AmazonEC2", "AWSLambda"])
}

// ReservedInstance represents an EC2 reserved instance
type ReservedInstance struct {
	ID              string
	InstanceType    string
	Region          string
	AvailabilityZone string
	Quantity        int
	DiscountPercent float64
	Term            string
	PaymentOption   string
}

// PriceOverride represents manual pricing overrides
type PriceOverride struct {
	Type          OverrideType
	ResourceAddr  string  // Specific resource address (if per-resource)
	Service       string  // Service name (if service-level)
	DiscountPercent *float64 // Percentage discount (e.g., 0.10 for 10% off)
	AbsolutePrice *float64 // Absolute price override
	Reason        string  // Why this override exists
}

type OverrideType string

const (
	OverridePerResource OverrideType = "PER_RESOURCE"
	OverridePerService  OverrideType = "PER_SERVICE"
	OverrideGlobal      OverrideType = "GLOBAL"
)

// CommitmentEngine applies savings plans, RIs, and overrides
type CommitmentEngine struct {
	savingsPlans       []SavingsPlan
	reservedInstances  []ReservedInstance
	overrides          []PriceOverride
}

func NewCommitmentEngine() *CommitmentEngine {
	return &CommitmentEngine{
		savingsPlans:      []SavingsPlan{},
		reservedInstances: []ReservedInstance{},
		overrides:         []PriceOverride{},
	}
}

// LoadSavingsPlans loads savings plan definitions
func (ce *CommitmentEngine) LoadSavingsPlans(plans []SavingsPlan) {
	ce.savingsPlans = plans
}

// LoadReservedInstances loads reserved instance definitions
func (ce *CommitmentEngine) LoadReservedInstances(ris []ReservedInstance) {
	ce.reservedInstances = ris
}

// LoadOverrides loads price overrides
func (ce *CommitmentEngine) LoadOverrides(overrides []PriceOverride) {
	ce.overrides = overrides
}

// ApplySavingsPlans applies savings plans to cost items
func (ce *CommitmentEngine) ApplySavingsPlans(costItems []types.CostItem) []types.CostItem {
	result := make([]types.CostItem, len(costItems))
	copy(result, costItems)

	for i := range result {
		item := &result[i]

		// Check if any savings plan applies to this service
		for _, plan := range ce.savingsPlans {
			if ce.planApplies(plan, item.Service) {
				// Apply discount
				originalCost := item.TotalCost
				item.TotalCost *= (1 - plan.DiscountPercent)
				
				// Update explanation
				item.Explanation += " | Savings Plan applied: " + 
					formatPercent(plan.DiscountPercent) + " discount"
				
				// Add metadata
				if item.ResourceAddress != "" {
					item.Explanation += " (Saved $" + formatCurrency(originalCost - item.TotalCost) + ")"
				}
			}
		}
	}

	return result
}

// ApplyReservedInstances applies RIs to EC2 instances
func (ce *CommitmentEngine) ApplyReservedInstances(costItems []types.CostItem) []types.CostItem {
	result := make([]types.CostItem, len(costItems))
	copy(result, costItems)

	// Track RI usage
	riUsage := make(map[string]int) // RI ID -> quantity used

	for i := range result {
		item := &result[i]

		// Only apply to EC2 instances
		if item.Service == "AmazonEC2" && item.UsageType != "" {
			// Try to match with RIs
			for _, ri := range ce.reservedInstances {
				if ce.riMatches(ri, item) {
					// Check if RI has remaining capacity
					used := riUsage[ri.ID]
					if used < ri.Quantity {
						// Apply RI pricing
						originalCost := item.TotalCost
						item.TotalCost *= (1 - ri.DiscountPercent)
						
						item.Explanation += " | Reserved Instance applied: " +
							formatPercent(ri.DiscountPercent) + " discount"
						
						riUsage[ri.ID]++
						break
					}
				}
			}
		}
	}

	return result
}

// ApplyOverrides applies manual price overrides
func (ce *CommitmentEngine) ApplyOverrides(costItems []types.CostItem) []types.CostItem {
	result := make([]types.CostItem, len(costItems))
	copy(result, costItems)

	for i := range result {
		item := &result[i]

		for _, override := range ce.overrides {
			if ce.overrideApplies(override, item) {
				originalCost := item.TotalCost

				// Apply absolute price override
				if override.AbsolutePrice != nil {
					item.TotalCost = *override.AbsolutePrice
					item.Explanation += " | Price override: $" + 
						formatCurrency(*override.AbsolutePrice) + 
						" (" + override.Reason + ")"
				}

				// Apply percentage discount
				if override.DiscountPercent != nil {
					item.TotalCost *= (1 - *override.DiscountPercent)
					item.Explanation += " | Discount override: " + 
						formatPercent(*override.DiscountPercent) + 
						" (" + override.Reason + ")"
				}

				// Note the change
				if originalCost != item.TotalCost {
					item.Explanation += " (Originally $" + formatCurrency(originalCost) + ")"
				}
			}
		}
	}

	return result
}

// GenerateScenarios creates multiple pricing scenarios
func (ce *CommitmentEngine) GenerateScenarios(baseCostItems []types.CostItem) map[PricingScenario][]types.CostItem {
	scenarios := make(map[PricingScenario][]types.CostItem)

	// Scenario 1: On-demand (baseline)
	scenarios[ScenarioOnDemand] = baseCostItems

	// Scenario 2: With Savings Plans
	if len(ce.savingsPlans) > 0 {
		scenarios[ScenarioWithSavingsPlans] = ce.ApplySavingsPlans(baseCostItems)
	}

	// Scenario 3: With Reserved Instances
	if len(ce.reservedInstances) > 0 {
		scenarios[ScenarioWithReservedInstances] = ce.ApplyReservedInstances(baseCostItems)
	}

	// Scenario 4: With Overrides
	if len(ce.overrides) > 0 {
		scenarios[ScenarioWithOverrides] = ce.ApplyOverrides(baseCostItems)
	}

	return scenarios
}

// Helper functions

func (ce *CommitmentEngine) planApplies(plan SavingsPlan, service string) bool {
	if len(plan.AppliesTo) == 0 {
		return true // Applies to all
	}
	
	for _, s := range plan.AppliesTo {
		if s == service {
			return true
		}
	}
	return false
}

func (ce *CommitmentEngine) riMatches(ri ReservedInstance, item *types.CostItem) bool {
	// Match by instance type and region
	// In production, this would parse usage_type more carefully
	return item.Region == ri.Region
}

func (ce *CommitmentEngine) overrideApplies(override PriceOverride, item *types.CostItem) bool {
	switch override.Type {
	case OverridePerResource:
		return item.ResourceAddress == override.ResourceAddr
	case OverridePerService:
		return item.Service == override.Service
	case OverrideGlobal:
		return true
	}
	return false
}

func formatPercent(p float64) string {
	return formatFloat(p * 100) + "%"
}

func formatCurrency(amount float64) string {
	return formatFloat(amount)
}

func formatFloat(f float64) string {
	return "" // Placeholder - use fmt.Sprintf in production
}

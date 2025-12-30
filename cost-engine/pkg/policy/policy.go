package policy

import (
	"fmt"

	"github.com/aws-cost-estimation/cost-engine/pkg/types"
)

// PolicyEngine evaluates cost estimates against defined policies
type PolicyEngine struct {
	policies []Policy
}

func New() *PolicyEngine {
	return &PolicyEngine{
		policies: []Policy{},
	}
}

// LoadPolicies loads policy definitions
func (pe *PolicyEngine) LoadPolicies(policies []Policy) {
	pe.policies = policies
}

// Evaluate checks estimate against all policies
func (pe *PolicyEngine) Evaluate(estimate *types.Estimate) []types.PolicyResult {
	var results []types.PolicyResult

	for _, policy := range pe.policies {
		result := pe.evaluatePolicy(policy, estimate)
		results = append(results, result)
	}

	return results
}

// HasFailures checks if any policy failed
func (pe *PolicyEngine) HasFailures(results []types.PolicyResult) bool {
	for _, result := range results {
		if result.Outcome == types.PolicyFail {
			return true
		}
	}
	return false
}

func (pe *PolicyEngine) evaluatePolicy(policy Policy, estimate *types.Estimate) types.PolicyResult {
	switch policy.Type {
	case PolicyTypeServiceBudget:
		return pe.evaluateServiceBudget(policy, estimate)
	case PolicyTypeResourceCount:
		return pe.evaluateResourceCount(policy, estimate)
	case PolicyTypeTotalBudget:
		return pe.evaluateTotalBudget(policy, estimate)
	case PolicyTypePercentageGrowth:
		// Requires previous estimate - not implemented in this version
		return types.PolicyResult{
			PolicyName: policy.Name,
			Outcome:    types.PolicyPass,
			Message:    "Growth policies require historical data",
		}
	default:
		return types.PolicyResult{
			PolicyName: policy.Name,
			Outcome:    types.PolicyFail,
			Message:    fmt.Sprintf("Unknown policy type: %s", policy.Type),
		}
	}
}

func (pe *PolicyEngine) evaluateServiceBudget(policy Policy, estimate *types.Estimate) types.PolicyResult {
	serviceCost := estimate.ServiceBreakdown[policy.Service]

	if serviceCost > policy.MaxCost {
		return types.PolicyResult{
			PolicyName: policy.Name,
			Outcome:    types.PolicyFail,
			Message: fmt.Sprintf(
				"%s cost $%.2f exceeds budget of $%.2f (%.1f%% over)",
				policy.Service,
				serviceCost,
				policy.MaxCost,
				((serviceCost-policy.MaxCost)/policy.MaxCost)*100,
			),
		}
	}

	if policy.WarnThreshold > 0 && serviceCost > policy.WarnThreshold {
		return types.PolicyResult{
			PolicyName: policy.Name,
			Outcome:    types.PolicyWarn,
			Message: fmt.Sprintf(
				"%s cost $%.2f exceeds warning threshold of $%.2f",
				policy.Service,
				serviceCost,
				policy.WarnThreshold,
			),
		}
	}

	return types.PolicyResult{
		PolicyName: policy.Name,
		Outcome:    types.PolicyPass,
		Message: fmt.Sprintf(
			"%s cost $%.2f within budget of $%.2f",
			policy.Service,
			serviceCost,
			policy.MaxCost,
		),
	}
}

func (pe *PolicyEngine) evaluateResourceCount(policy Policy, estimate *types.Estimate) types.PolicyResult {
	// Count resources of specific type
	count := 0
	for _, resource := range estimate.Resources {
		if resource.Type == policy.ResourceType {
			count++
		}
	}

	if count > policy.MaxCount {
		return types.PolicyResult{
			PolicyName: policy.Name,
			Outcome:    types.PolicyFail,
			Message: fmt.Sprintf(
				"%d %s resources exceeds limit of %d",
				count,
				policy.ResourceType,
				policy.MaxCount,
			),
		}
	}

	return types.PolicyResult{
		PolicyName: policy.Name,
		Outcome:    types.PolicyPass,
		Message: fmt.Sprintf(
			"%d %s resources within limit of %d",
			count,
			policy.ResourceType,
			policy.MaxCount,
		),
	}
}

func (pe *PolicyEngine) evaluateTotalBudget(policy Policy, estimate *types.Estimate) types.PolicyResult {
	if estimate.TotalCost > policy.MaxCost {
		return types.PolicyResult{
			PolicyName: policy.Name,
			Outcome:    types.PolicyFail,
			Message: fmt.Sprintf(
				"Total cost $%.2f exceeds budget of $%.2f (%.1f%% over)",
				estimate.TotalCost,
				policy.MaxCost,
				((estimate.TotalCost-policy.MaxCost)/policy.MaxCost)*100,
			),
		}
	}

	if policy.WarnThreshold > 0 && estimate.TotalCost > policy.WarnThreshold {
		return types.PolicyResult{
			PolicyName: policy.Name,
			Outcome:    types.PolicyWarn,
			Message: fmt.Sprintf(
				"Total cost $%.2f exceeds warning threshold of $%.2f",
				estimate.TotalCost,
				policy.WarnThreshold,
			),
		}
	}

	return types.PolicyResult{
		PolicyName: policy.Name,
		Outcome:    types.PolicyPass,
		Message: fmt.Sprintf(
			"Total cost $%.2f within budget of $%.2f",
			estimate.TotalCost,
			policy.MaxCost,
		),
	}
}

// Policy definitions

type PolicyType string

const (
	PolicyTypeServiceBudget    PolicyType = "SERVICE_BUDGET"
	PolicyTypeResourceCount    PolicyType = "RESOURCE_COUNT"
	PolicyTypeTotalBudget      PolicyType = "TOTAL_BUDGET"
	PolicyTypePercentageGrowth PolicyType = "PERCENTAGE_GROWTH"
)

type Policy struct {
	Name          string
	Type          PolicyType
	Service       string  // For SERVICE_BUDGET
	ResourceType  string  // For RESOURCE_COUNT
	MaxCost       float64 // For budget policies
	WarnThreshold float64 // Optional warning threshold
	MaxCount      int     // For RESOURCE_COUNT
	MaxGrowth     float64 // For PERCENTAGE_GROWTH (e.g., 0.20 for 20%)
}

// Helper to create common policies

func NewServiceBudgetPolicy(name, service string, maxCost, warnThreshold float64) Policy {
	return Policy{
		Name:          name,
		Type:          PolicyTypeServiceBudget,
		Service:       service,
		MaxCost:       maxCost,
		WarnThreshold: warnThreshold,
	}
}

func NewResourceCountPolicy(name, resourceType string, maxCount int) Policy {
	return Policy{
		Name:         name,
		Type:         PolicyTypeResourceCount,
		ResourceType: resourceType,
		MaxCount:     maxCount,
	}
}

func NewTotalBudgetPolicy(name string, maxCost, warnThreshold float64) Policy {
	return Policy{
		Name:          name,
		Type:          PolicyTypeTotalBudget,
		MaxCost:       maxCost,
		WarnThreshold: warnThreshold,
	}
}

package explainability

import (
	"fmt"
	"strings"

	"github.com/aws-cost-estimation/cost-engine/pkg/types"
)

// Explainer generates detailed explanations for cost calculations
type Explainer struct{}

func New() *Explainer {
	return &Explainer{}
}

// ExplainEstimate generates comprehensive explanation for entire estimate
func (e *Explainer) ExplainEstimate(estimate *types.Estimate) *EstimateExplanation {
	explanation := &EstimateExplanation{
		EstimateID:     estimate.ID,
		InputHash:      estimate.InputHash,
		CatalogVersion: estimate.CatalogVersion,
		TotalCost:      estimate.TotalCost,
		Currency:       estimate.Currency,
		Confidence:     estimate.Confidence,
		ResourceCount:  len(estimate.Resources),
		CostItemCount:  len(estimate.CostItems),
	}

	// Explain each cost item
	for _, item := range estimate.CostItems {
		itemExplanation := e.ExplainCostItem(&item)
		explanation.CostItems = append(explanation.CostItems, itemExplanation)
	}

	// Service breakdown
	explanation.ServiceBreakdown = estimate.ServiceBreakdown

	// Assumptions
	explanation.Assumptions = estimate.Assumptions

	// Confidence analysis
	explanation.ConfidenceAnalysis = e.analyzeConfidence(estimate)

	return explanation
}

// ExplainCostItem generates detailed explanation for a single cost item
func (e *Explainer) ExplainCostItem(item *types.CostItem) CostItemExplanation {
	return CostItemExplanation{
		ResourceAddress: item.ResourceAddress,
		Service:         item.Service,
		Region:          item.Region,
		
		// WHAT was calculated
		What: e.explainWhat(item),
		
		// WHY it was calculated
		Why: e.explainWhy(item),
		
		// HOW it was calculated
		How: e.explainHow(item),
		
		// Breakdown
		Breakdown: e.explainBreakdown(item),
		
		// Metadata
		SKU:        item.SKU,
		Confidence: item.Confidence,
		MatchType:  item.MatchType,
	}
}

// ExplainResource explains why a resource has certain costs
func (e *Explainer) ExplainResource(resource *types.Resource, relatedCosts []types.CostItem) *ResourceExplanation {
	explanation := &ResourceExplanation{
		Address:      resource.Address,
		Type:         resource.Type,
		IsMocked:     resource.IsMocked,
		MockMetadata: resource.MockMetadata,
	}

	// Calculate total cost for this resource
	totalCost := 0.0
	for _, cost := range relatedCosts {
		if cost.ResourceAddress == resource.Address {
			totalCost += cost.TotalCost
			explanation.CostItems = append(explanation.CostItems, e.ExplainCostItem(&cost))
		}
	}
	explanation.TotalCost = totalCost

	// Explain key attributes
	explanation.KeyAttributes = e.extractKeyAttributes(resource)

	return explanation
}

// Private helper methods

func (e *Explainer) explainWhat(item *types.CostItem) string {
	return fmt.Sprintf(
		"%s usage in %s: %.2f %s",
		item.Service,
		item.Region,
		item.Quantity,
		item.Unit,
	)
}

func (e *Explainer) explainWhy(item *types.CostItem) string {
	var reasons []string

	// Explain based on service type
	switch item.Service {
	case "AmazonEC2":
		if strings.Contains(item.UsageType, "BoxUsage") {
			reasons = append(reasons, "EC2 instance running continuously (730 hours/month)")
		}
		if strings.Contains(item.UsageType, "EBS") {
			reasons = append(reasons, "Attached EBS volume storage")
		}
		
	case "AWSLambda":
		reasons = append(reasons, "Lambda function invocations and compute time")
		
	case "AmazonRDS":
		if strings.Contains(item.UsageType, "InstanceUsage") {
			reasons = append(reasons, "RDS database instance continuously running")
		}
		if strings.Contains(item.UsageType, "Storage") {
			reasons = append(reasons, "RDS database storage")
		}
	}

	if len(reasons) == 0 {
		return "Standard AWS service usage"
	}

	return strings.Join(reasons, "; ")
}

func (e *Explainer) explainHow(item *types.CostItem) string {
	return fmt.Sprintf(
		"Calculation: %.6f %s × $%.9f per %s = $%.2f/month",
		item.Quantity,
		item.Unit,
		item.PricePerUnit,
		item.Unit,
		item.TotalCost,
	)
}

func (e *Explainer) explainBreakdown(item *types.CostItem) CalculationBreakdown {
	return CalculationBreakdown{
		Quantity:     item.Quantity,
		Unit:         item.Unit,
		PricePerUnit: item.PricePerUnit,
		TotalCost:    item.TotalCost,
		SKU:          item.SKU,
		Formula:      fmt.Sprintf("%.2f %s × $%.9f/%s", item.Quantity, item.Unit, item.PricePerUnit, item.Unit),
	}
}

func (e *Explainer) analyzeConfidence(estimate *types.Estimate) ConfidenceAnalysis {
	analysis := ConfidenceAnalysis{
		OverallConfidence: estimate.Confidence,
	}

	// Count items by confidence level
	highCount := 0
	mediumCount := 0
	lowCount := 0

	for _, item := range estimate.CostItems {
		switch item.Confidence {
		case types.ConfidenceHigh:
			highCount++
		case types.ConfidenceMedium:
			mediumCount++
		case types.ConfidenceLow:
			lowCount++
		}
	}

	analysis.HighConfidenceCount = highCount
	analysis.MediumConfidenceCount = mediumCount
	analysis.LowConfidenceCount = lowCount

	// Generate recommendations
	if lowCount > 0 {
		analysis.Recommendations = append(analysis.Recommendations,
			fmt.Sprintf("%d cost items have LOW confidence - consider providing usage profiles", lowCount))
	}
	if mediumCount > 0 {
		analysis.Recommendations = append(analysis.Recommendations,
			fmt.Sprintf("%d cost items have MEDIUM confidence - some values were mocked or inferred", mediumCount))
	}

	return analysis
}

func (e *Explainer) extractKeyAttributes(resource *types.Resource) map[string]interface{} {
	keyAttrs := make(map[string]interface{})

	// Extract important attributes based on resource type
	switch resource.Type {
	case "aws_instance":
		if it, ok := resource.Attributes["instance_type"]; ok {
			keyAttrs["instance_type"] = it
		}
		if ami, ok := resource.Attributes["ami"]; ok {
			keyAttrs["ami"] = ami
		}
		
	case "aws_lambda_function":
		if mem, ok := resource.Attributes["memory_size"]; ok {
			keyAttrs["memory_size"] = mem
		}
		if runtime, ok := resource.Attributes["runtime"]; ok {
			keyAttrs["runtime"] = runtime
		}
		
	case "aws_db_instance":
		if ic, ok := resource.Attributes["instance_class"]; ok {
			keyAttrs["instance_class"] = ic
		}
		if engine, ok := resource.Attributes["engine"]; ok {
			keyAttrs["engine"] = engine
		}
	}

	return keyAttrs
}

// Data structures for explanations

type EstimateExplanation struct {
	EstimateID         string
	InputHash          string
	CatalogVersion     string
	TotalCost          float64
	Currency           string
	Confidence         types.ConfidenceLevel
	ResourceCount      int
	CostItemCount      int
	CostItems          []CostItemExplanation
	ServiceBreakdown   map[string]float64
	Assumptions        []string
	ConfidenceAnalysis ConfidenceAnalysis
}

type CostItemExplanation struct {
	ResourceAddress string
	Service         string
	Region          string
	What            string // What was calculated
	Why             string // Why it was calculated
	How             string // How it was calculated
	Breakdown       CalculationBreakdown
	SKU             string
	Confidence      types.ConfidenceLevel
	MatchType       types.MatchType
}

type CalculationBreakdown struct {
	Quantity     float64
	Unit         string
	PricePerUnit float64
	TotalCost    float64
	SKU          string
	Formula      string
}

type ResourceExplanation struct {
	Address       string
	Type          string
	TotalCost     float64
	IsMocked      bool
	MockMetadata  []types.MockAnnotation
	KeyAttributes map[string]interface{}
	CostItems     []CostItemExplanation
}

type ConfidenceAnalysis struct {
	OverallConfidence    types.ConfidenceLevel
	HighConfidenceCount  int
	MediumConfidenceCount int
	LowConfidenceCount   int
	Recommendations      []string
}

// Package types defines core types used across the cost engine
package types

// Confidence represents how confident we are in a pricing match or estimate
type Confidence string

const (
	ConfidenceHigh     Confidence = "HIGH"       // Exact match found
	ConfidenceMedium   Confidence = "MEDIUM"     // Partial match or assumption made
	ConfidenceLow      Confidence = "LOW"        // Heuristic or best guess
	ConfidenceUnknown  Confidence = "UNKNOWN"    // No data available
)

// UsageVector represents a single usage dimension to be priced
type UsageVector struct {
	ResourceAddress string            `json:"resource_address"` // e.g., aws_instance.web[0]
	Service         string            `json:"service"`          // e.g., AmazonEC2
	UsageType       string            `json:"usage_type"`       // e.g., BoxUsage:t3.micro
	Operation       string            `json:"operation,omitempty"`
	Region          string            `json:"region"`           // e.g., us-east-1
	Unit            string            `json:"unit"`             // e.g., Hrs
	Quantity        float64           `json:"quantity"`         // e.g., 730 (hours/month)
	Attributes      map[string]string `json:"attributes,omitempty"`
	Confidence      Confidence        `json:"confidence"`
	Assumptions     []string          `json:"assumptions,omitempty"`
}

// PricedItem represents a usage vector with pricing applied
type PricedItem struct {
	UsageVector
	PricePerUnit    float64    `json:"price_per_unit"`
	MonthlyCost     float64    `json:"monthly_cost"`
	Currency        string     `json:"currency"`
	MatchConfidence Confidence `json:"match_confidence"`
	MatchScore      float64    `json:"match_score"`      // 0-1 score
	PricingSource   string     `json:"pricing_source"`   // SKU or rate code
	Formula         string     `json:"formula"`           // e.g., "730 hrs × $0.0116/hr"
}

// ResourceCost aggregates all costs for a single Terraform resource
type ResourceCost struct {
	Address      string        `json:"address"`       // e.g., aws_instance.web
	Type         string        `json:"type"`          // e.g., aws_instance
	Name         string        `json:"name"`          // e.g., web
	Service      string        `json:"service"`       // e.g., AmazonEC2
	MonthlyCost  float64       `json:"monthly_cost"`
	Confidence   Confidence    `json:"confidence"`
	LineItems    []PricedItem  `json:"line_items"`
	Assumptions  []string      `json:"assumptions,omitempty"`
}

// ServiceCost aggregates costs by AWS service
type ServiceCost struct {
	Service      string        `json:"service"`
	MonthlyCost  float64       `json:"monthly_cost"`
	ResourceCount int          `json:"resource_count"`
	Confidence   Confidence    `json:"confidence"`
}

// CostEstimate is the complete cost estimation result
type CostEstimate struct {
	TotalMonthlyCost float64               `json:"total_monthly_cost"`
	Currency         string                `json:"currency"`
	ByService        map[string]ServiceCost `json:"by_service"`
	ByResource       []ResourceCost        `json:"by_resource"`
	OverallConfidence Confidence           `json:"overall_confidence"`
	Assumptions      []string              `json:"assumptions"`
	Warnings         []string              `json:"warnings,omitempty"`
	Metadata         EstimateMetadata      `json:"metadata"`
}

// EstimateMetadata contains reproducibility information
type EstimateMetadata struct {
	CatalogVersion string `json:"catalog_version"`
	InputHash      string `json:"input_hash"`
	EvaluatedAt    string `json:"evaluated_at"`
	EngineVersion  string `json:"engine_version"`
}

// TerraformResource represents a parsed Terraform resource
type TerraformResource struct {
	Type       string                 `json:"type"`       // e.g., aws_instance
	Name       string                 `json:"name"`       // e.g., web
	Address    string                 `json:"address"`    // e.g., aws_instance.web
	Provider   string                 `json:"provider"`   // e.g., aws
	Config     map[string]interface{} `json:"config"`     // Evaluated configuration
	Count      int                    `json:"count"`      // Number of instances
	ForEach    []string               `json:"for_each,omitempty"` // Keys if for_each used
	DependsOn  []string               `json:"depends_on,omitempty"`
	Module     string                 `json:"module,omitempty"` // Module path if nested
}

// TerraformPlan represents a fully parsed Terraform configuration
type TerraformPlan struct {
	Resources  []TerraformResource `json:"resources"`
	Variables  map[string]interface{} `json:"variables"`
	Locals     map[string]interface{} `json:"locals"`
	DataSources []TerraformResource  `json:"data_sources"`
	Outputs    map[string]interface{} `json:"outputs"`
	Modules    []string              `json:"modules"`
}

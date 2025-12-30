package types

// Resource represents a fully expanded Terraform resource
type Resource struct {
	Address      string                 // e.g., aws_instance.web[0]
	Type         string                 // e.g., aws_instance
	Name         string                 // e.g., web
	Index        interface{}            // nil, int for count, string for for_each
	Provider     string                 // e.g., aws
	Region       string                 // REQUIRED: e.g., us-east-1 (injected by loader/mocker)
	Attributes   map[string]interface{} // Resource attributes
	Dependencies []string               // Resource addresses this depends on
	IsMocked     bool                   // True if contains mocked values
	MockMetadata []MockAnnotation       // Metadata about mocked values
}

// MockAnnotation tracks mocked/inferred values
type MockAnnotation struct {
	Field      string         // Which field was mocked
	Value      interface{}    // Mocked value
	Reason     string         // Why it was mocked
	Confidence ConfidenceLevel // Confidence in the mock
}

// ConfidenceLevel represents certainty in cost calculation
type ConfidenceLevel string

const (
	ConfidenceHigh   ConfidenceLevel = "HIGH"
	ConfidenceMedium ConfidenceLevel = "MEDIUM"
	ConfidenceLow    ConfidenceLevel = "LOW"
)

// UsageVector represents billable usage
type UsageVector struct {
	Service    string                 // e.g., AmazonEC2
	Region     string                 // e.g., us-east-1
	UsageType  string                 // e.g., BoxUsage:t3.micro
	Unit       string                 // e.g., Hrs
	Quantity   float64                // e.g., 730
	Metadata   map[string]interface{} // Additional context
	Confidence ConfidenceLevel
}

// PricingMatch represents a matched price from database
type PricingMatch struct {
	SKU          string
	Service      string
	RegionCode   string
	UsageType    string
	Unit         string
	PricePerUnit float64
	BeginRange   float64
	EndRange     *float64
	Attributes   map[string]interface{}
	MatchType    MatchType // How the price was matched
}

// MatchType indicates pricing match quality
type MatchType string

const (
	MatchExact     MatchType = "EXACT"
	MatchFallback  MatchType = "FALLBACK"
	MatchHeuristic MatchType = "HEURISTIC"
	MatchNone      MatchType = "NONE"
)

// CostItem represents calculated cost for a resource
type CostItem struct {
	ResourceAddress string
	Service         string
	Region          string
	UsageType       string
	Quantity        float64
	Unit            string
	PricePerUnit    float64
	TotalCost       float64
	SKU             string
	Confidence      ConfidenceLevel
	MatchType       MatchType
	Explanation     string
}

// Estimate represents complete cost estimation result
type Estimate struct {
	ID              string               // Unique estimate ID
	InputHash       string               // SHA256 of input for determinism
	CatalogVersion  string               // Pricing catalog version used
	Resources       []Resource           // All expanded resources
	CostItems       []CostItem           // Individual cost items
	ServiceBreakdown map[string]float64  // Cost per service
	TotalCost       float64              // Total monthly cost
	Currency        string               // USD
	Confidence      ConfidenceLevel      // Overall confidence
	Assumptions     []string             // List of all assumptions made
	PolicyResults   []PolicyResult       // Policy evaluation results
}

// PolicyResult represents policy evaluation outcome
type PolicyResult struct {
	PolicyName string
	Outcome    PolicyOutcome
	Message    string
}

// PolicyOutcome represents policy evaluation result
type PolicyOutcome string

const (
	PolicyPass PolicyOutcome = "PASS"
	PolicyWarn PolicyOutcome = "WARN"
	PolicyFail PolicyOutcome = "FAIL"
)

// CostDiff represents cost delta between two estimates
type CostDiff struct {
	AddedResources    []Resource
	RemovedResources  []Resource
	ModifiedResources []ResourceDiff
	AddedCost         float64
	RemovedCost       float64
	TotalDelta        float64
	ServiceDeltas     map[string]float64
}

// ResourceDiff represents change in a single resource
type ResourceDiff struct {
	Address   string
	OldCost   float64
	NewCost   float64
	Delta     float64
	Changes   map[string]interface{}
}

package types

// EvaluationMode determines behavior for missing/ambiguous data
type EvaluationMode string

const (
	// EvaluationStrict fails on any missing required value
	EvaluationStrict EvaluationMode = "STRICT"
	
	// EvaluationConservative prefers higher cost assumptions
	EvaluationConservative EvaluationMode = "CONSERVATIVE"
	
	// EvaluationOptimistic prefers lower cost assumptions
	EvaluationOptimistic EvaluationMode = "OPTIMISTIC"
)

// ModeDefaults returns default values based on evaluation mode
type ModeDefaults struct {
	Mode EvaluationMode
}

// GetEC2RuntimeHours returns default runtime hours based on mode
func (m *ModeDefaults) GetEC2RuntimeHours() float64 {
	switch m.Mode {
	case EvaluationStrict:
		// Strict mode should not provide defaults, but if it does, be explicit
		return 730.0 // Full month
	case EvaluationConservative:
		return 730.0 // Always-on assumption
	case EvaluationOptimistic:
		return 365.0 // 50% utilization
	default:
		return 730.0
	}
}

// GetLambdaDefaultRequests returns default Lambda requests based on mode
func (m *ModeDefaults) GetLambdaDefaultRequests() float64 {
	switch m.Mode {
	case EvaluationStrict:
		// Strict should error, not provide default
		return 0
	case EvaluationConservative:
		return 10000.0 // Higher estimate
	case EvaluationOptimistic:
		return 1000.0 // Lower estimate
	default:
		return 1000.0
	}
}

// GetDataTransferGB returns default data transfer based on mode
func (m *ModeDefaults) GetDataTransferGB() float64 {
	switch m.Mode {
	case EvaluationStrict:
		return 0
	case EvaluationConservative:
		return 100.0 // Conservative estimate
	case EvaluationOptimistic:
		return 10.0 // Optimistic estimate
	default:
		return 50.0
	}
}

// ShouldFailOnMissingValue determines if missing value should error
func (m *ModeDefaults) ShouldFailOnMissingValue(field string) bool {
	return m.Mode == EvaluationStrict
}

// GetConfidenceForDefault returns confidence level for a defaulted value
func (m *ModeDefaults) GetConfidenceForDefault() ConfidenceLevel {
	switch m.Mode {
	case EvaluationStrict:
		return ConfidenceHigh // Shouldn't reach here
	case EvaluationConservative:
		return ConfidenceMedium
	case EvaluationOptimistic:
		return ConfidenceMedium
	default:
		return ConfidenceLow
	}
}

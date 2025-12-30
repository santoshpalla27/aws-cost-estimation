package golden_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/aws-cost-estimation/cost-engine/pkg/config"
	"github.com/aws-cost-estimation/cost-engine/pkg/engine"
	"github.com/aws-cost-estimation/cost-engine/pkg/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// GoldenTest represents a single golden test case
type GoldenTest struct {
	Name              string                  `json:"name"`
	Description       string                  `json:"description"`
	TerraformPlanFile string                  `json:"terraform_plan_file"`
	EvaluationMode    types.EvaluationMode    `json:"evaluation_mode"`
	CatalogVersion    string                  `json:"catalog_version"`
	ExpectedOutput    *types.Estimate         `json:"expected_output"`
}

// TestGoldenCases runs all golden test cases
func TestGoldenCases(t *testing.T) {
	testCases := []string{
		"ec2-01-simple-explicit",
		"ec2-02-count-expansion",
		"ec2-03-missing-region",
		"ec2-04-nat-inference",
		"ec2-05-strict-mode-failure",
		"ec2-06-pricing-ambiguity",
		"ec2-07-diff-test",
	}

	for _, testName := range testCases {
		t.Run(testName, func(t *testing.T) {
			runGoldenTest(t, testName)
		})
	}
}

func runGoldenTest(t *testing.T, testName string) {
	// Load golden file
	goldenPath := filepath.Join("testdata", "golden", testName+".json")
	goldenData, err := os.ReadFile(goldenPath)
	require.NoError(t, err, "Failed to read golden file")

	var golden GoldenTest
	err = json.Unmarshal(goldenData, &golden)
	require.NoError(t, err, "Failed to parse golden file")

	// Load Terraform plan
	planPath := filepath.Join("testdata", "plans", golden.TerraformPlanFile)
	
	// Create config with evaluation mode
	cfg := &config.Config{
		DatabaseURL:    os.Getenv("TEST_DATABASE_URL"),
		EvaluationMode: golden.EvaluationMode,
	}

	// Run estimation
	eng, err := engine.New(cfg)
	require.NoError(t, err, "Failed to create engine")
	defer eng.Close()

	result, err := eng.EstimateFromPlan(planPath)
	
	// Some tests expect failures (e.g., STRICT mode)
	if testName == "ec2-05-strict-mode-failure" {
		assert.Error(t, err, "Expected error in STRICT mode with missing data")
		return
	}
	
	require.NoError(t, err, "Estimation failed")

	// Compare results
	compareEstimates(t, golden.ExpectedOutput, &result.Estimate)
}

func compareEstimates(t *testing.T, expected, actual *types.Estimate) {
	// Compare total cost (allow 0.01 difference for floating point)
	assert.InDelta(t, expected.TotalCost, actual.TotalCost, 0.01, 
		"Total cost mismatch")

	// Compare confidence
	assert.Equal(t, expected.Confidence, actual.Confidence,
		"Confidence level mismatch")

	// Compare resource count
	assert.Equal(t, len(expected.Resources), len(actual.Resources),
		"Resource count mismatch")

	// Compare cost item count
	assert.Equal(t, len(expected.CostItems), len(actual.CostItems),
		"Cost item count mismatch")

	// Compare service breakdown
	for service, expectedCost := range expected.ServiceBreakdown {
		actualCost, exists := actual.ServiceBreakdown[service]
		assert.True(t, exists, "Service %s missing in actual breakdown", service)
		assert.InDelta(t, expectedCost, actualCost, 0.01,
			"Service %s cost mismatch", service)
	}

	// Compare assumptions count (should have same number)
	assert.Equal(t, len(expected.Assumptions), len(actual.Assumptions),
		"Assumptions count mismatch")
}

// UpdateGoldenFile updates a golden file with new expected output
// Use with caution - only when pricing data or logic intentionally changes
func UpdateGoldenFile(t *testing.T, testName string, estimate *types.Estimate) {
	goldenPath := filepath.Join("testdata", "golden", testName+".json")
	
	var golden GoldenTest
	goldenData, err := os.ReadFile(goldenPath)
	require.NoError(t, err)
	
	err = json.Unmarshal(goldenData, &golden)
	require.NoError(t, err)
	
	// Update expected output
	golden.ExpectedOutput = estimate
	
	// Write back
	updatedData, err := json.MarshalIndent(golden, "", "  ")
	require.NoError(t, err)
	
	err = os.WriteFile(goldenPath, updatedData, 0644)
	require.NoError(t, err)
	
	t.Logf("Updated golden file: %s", goldenPath)
}

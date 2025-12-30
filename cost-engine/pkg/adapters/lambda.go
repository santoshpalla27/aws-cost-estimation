package adapters

import (
	"fmt"

	"github.com/aws-cost-estimation/cost-engine/pkg/types"
)

type LambdaAdapter struct{}

func NewLambdaAdapter() *LambdaAdapter {
	return &LambdaAdapter{}
}

func (a *LambdaAdapter) Supports(resourceType string) bool {
	return resourceType == "aws_lambda_function"
}

func (a *LambdaAdapter) Extract(resource *types.Resource) ([]types.UsageVector, error) {
	var vectors []types.UsageVector

	// Memory allocation (MB)
	memorySize := float64(GetIntAttr(resource, "memory_size", 128))

	// Region
	region := GetStringAttr(resource, "region", "us-east-1")

	// Determine confidence
	confidence := types.ConfidenceHigh
	if resource.IsMocked {
		confidence := types.ConfidenceMedium
	}

	// For Lambda, we need usage profiles to estimate:
	// 1. Number of requests per month
	// 2. Average duration per request
	// Without usage profile, we must either:
	// - Error out (correct but user-hostile)
	// - Use conservative defaults WITH explicit annotation (better)

	// Conservative defaults (will be explicit in output)
	requestsPerMonth := 1000.0      // Very conservative
	avgDurationSeconds := 1.0       // 1 second average

	// Calculate GB-seconds
	memoryGB := memorySize / 1024.0
	gbSeconds := (requestsPerMonth * avgDurationSeconds * memoryGB)

	// 1. Compute (GB-seconds)
	computeVector := types.UsageVector{
		Service:   "AWSLambda",
		Region:    region,
		UsageType: "Lambda-GB-Second",
		Unit:      "GB-s",
		Quantity:  gbSeconds,
		Metadata: map[string]interface{}{
			"memory_size_mb":     memorySize,
			"requests_per_month": requestsPerMonth,
			"avg_duration_sec":   avgDurationSeconds,
			"resource":           resource.Address,
			"assumption":         "Conservative default usage - override with usage profile",
		},
		Confidence: types.ConfidenceLow, // LOW because usage is assumed
	}
	vectors = append(vectors, computeVector)

	// 2. Requests
	requestsVector := types.UsageVector{
		Service:   "AWSLambda",
		Region:    region,
		UsageType: "Lambda-Requests",
		Unit:      "Requests",
		Quantity:  requestsPerMonth,
		Metadata: map[string]interface{}{
			"resource":   resource.Address,
			"assumption": "Conservative default usage - override with usage profile",
		},
		Confidence: types.ConfidenceLow,
	}
	vectors = append(vectors, requestsVector)

	// 3. Provisioned concurrency (if configured)
	if provisionedConcurrency := GetIntAttr(resource, "reserved_concurrent_executions", 0); provisionedConcurrency > 0 {
		pcVector := types.UsageVector{
			Service:   "AWSLambda",
			Region:    region,
			UsageType: "Lambda-Provisioned-Concurrency",
			Unit:      "Hours",
			Quantity:  float64(provisionedConcurrency) * 730, // Per unit-hour
			Metadata: map[string]interface{}{
				"concurrent_executions": provisionedConcurrency,
				"resource":              resource.Address,
			},
			Confidence: confidence,
		}
		vectors = append(vectors, pcVector)
	}

	return vectors, nil
}

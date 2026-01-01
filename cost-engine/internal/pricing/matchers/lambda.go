// Package matchers provides service-specific pricing matchers
package matchers

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/santoshpalla27/aws-cost-estimation/cost-engine/internal/types"
)

// LambdaMatcher handles aws_lambda_function resources
type LambdaMatcher struct {
	pool *pgxpool.Pool
}

// NewLambdaMatcher creates a Lambda matcher
func NewLambdaMatcher(pool *pgxpool.Pool) *LambdaMatcher {
	return &LambdaMatcher{pool: pool}
}

// ServiceName returns the AWS service code
func (m *LambdaMatcher) ServiceName() string {
	return "AWSLambda"
}

// Supports returns true for aws_lambda_function resources
func (m *LambdaMatcher) Supports(resourceType string) bool {
	return resourceType == "aws_lambda_function"
}

// Match generates usage vectors for a Lambda function
func (m *LambdaMatcher) Match(ctx context.Context, resource types.TerraformResource, region string) ([]types.UsageVector, error) {
	vectors := []types.UsageVector{}

	// Get memory size (default 128MB)
	memorySize := 128.0
	if mem, ok := resource.Config["memory_size"].(float64); ok {
		memorySize = mem
	} else if mem, ok := resource.Config["memory_size"].(int64); ok {
		memorySize = float64(mem)
	}

	// Assumed invocations per month (1M default)
	invocations := 1000000.0

	// Assumed duration per invocation (100ms default)
	durationMs := 100.0

	// Calculate GB-seconds
	// GB-seconds = (memory in MB / 1024) * (duration in ms / 1000) * invocations
	gbSeconds := (memorySize / 1024) * (durationMs / 1000) * invocations

	// Lambda requests
	vectors = append(vectors, types.UsageVector{
		Service:   "AWSLambda",
		Region:    region,
		UsageType: "Lambda-Requests",
		Unit:      "Requests",
		Quantity:  invocations,
	})

	// Lambda compute (GB-seconds)
	vectors = append(vectors, types.UsageVector{
		Service:   "AWSLambda",
		Region:    region,
		UsageType: "Lambda-GB-Second",
		Unit:      "GB-Second",
		Quantity:  gbSeconds,
		Attributes: map[string]string{
			"memorySize": func() string { return string(rune(int(memorySize))) + "MB" }(),
		},
	})

	// Ephemeral storage if configured above default (512MB)
	if storage, ok := resource.Config["ephemeral_storage"].(map[string]interface{}); ok {
		if size, ok := storage["size"].(float64); ok && size > 512 {
			extraStorage := size - 512
			storageGBSeconds := (extraStorage / 1024) * (durationMs / 1000) * invocations
			vectors = append(vectors, types.UsageVector{
				Service:   "AWSLambda",
				Region:    region,
				UsageType: "Lambda-Ephemeral-Storage-GB-Second",
				Unit:      "GB-Second",
				Quantity:  storageGBSeconds,
			})
		}
	}

	return vectors, nil
}

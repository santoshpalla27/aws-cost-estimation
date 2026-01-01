// Package matchers provides service-specific pricing matchers
package matchers

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/santoshpalla27/aws-cost-estimation/cost-engine/internal/types"
)

// DynamoDBMatcher handles aws_dynamodb_table resources
type DynamoDBMatcher struct {
	pool *pgxpool.Pool
}

// NewDynamoDBMatcher creates a DynamoDB matcher
func NewDynamoDBMatcher(pool *pgxpool.Pool) *DynamoDBMatcher {
	return &DynamoDBMatcher{pool: pool}
}

// ServiceName returns the AWS service code
func (m *DynamoDBMatcher) ServiceName() string {
	return "AmazonDynamoDB"
}

// Supports returns true for aws_dynamodb_table resources
func (m *DynamoDBMatcher) Supports(resourceType string) bool {
	return resourceType == "aws_dynamodb_table"
}

// Match generates usage vectors for a DynamoDB table
func (m *DynamoDBMatcher) Match(ctx context.Context, resource types.TerraformResource, region string) ([]types.UsageVector, error) {
	vectors := []types.UsageVector{}

	// Check billing mode
	billingMode := "PROVISIONED"
	if bm, ok := resource.Config["billing_mode"].(string); ok {
		billingMode = bm
	}

	if billingMode == "PAY_PER_REQUEST" {
		// On-demand capacity - assume 1M reads/writes per month
		vectors = append(vectors, types.UsageVector{
			Service:   "AmazonDynamoDB",
			Region:    region,
			UsageType: "PayPerRequest-ReadRequestUnits",
			Unit:      "ReadRequestUnits",
			Quantity:  1000000,
		})

		vectors = append(vectors, types.UsageVector{
			Service:   "AmazonDynamoDB",
			Region:    region,
			UsageType: "PayPerRequest-WriteRequestUnits",
			Unit:      "WriteRequestUnits",
			Quantity:  1000000,
		})
	} else {
		// Provisioned capacity
		readCapacity := 5.0 // default
		writeCapacity := 5.0

		if rc, ok := resource.Config["read_capacity"].(float64); ok {
			readCapacity = rc
		} else if rc, ok := resource.Config["read_capacity"].(int64); ok {
			readCapacity = float64(rc)
		}

		if wc, ok := resource.Config["write_capacity"].(float64); ok {
			writeCapacity = wc
		} else if wc, ok := resource.Config["write_capacity"].(int64); ok {
			writeCapacity = float64(wc)
		}

		// Read capacity units (RCU)
		vectors = append(vectors, types.UsageVector{
			Service:   "AmazonDynamoDB",
			Region:    region,
			UsageType: "ReadCapacityUnit-Hrs",
			Unit:      "RCU-Hrs",
			Quantity:  readCapacity * 730, // per month
		})

		// Write capacity units (WCU)
		vectors = append(vectors, types.UsageVector{
			Service:   "AmazonDynamoDB",
			Region:    region,
			UsageType: "WriteCapacityUnit-Hrs",
			Unit:      "WCU-Hrs",
			Quantity:  writeCapacity * 730,
		})
	}

	// Storage (assume 1GB)
	vectors = append(vectors, types.UsageVector{
		Service:   "AmazonDynamoDB",
		Region:    region,
		UsageType: "TimedStorage-ByteHrs",
		Unit:      "GB-Mo",
		Quantity:  1,
	})

	return vectors, nil
}

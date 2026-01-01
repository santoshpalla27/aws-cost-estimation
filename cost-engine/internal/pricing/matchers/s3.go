// Package matchers provides service-specific pricing matchers
package matchers

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/santoshpalla27/aws-cost-estimation/cost-engine/internal/types"
)

// S3Matcher handles aws_s3_bucket resources
type S3Matcher struct {
	pool *pgxpool.Pool
}

// NewS3Matcher creates an S3 matcher
func NewS3Matcher(pool *pgxpool.Pool) *S3Matcher {
	return &S3Matcher{pool: pool}
}

// ServiceName returns the AWS service code
func (m *S3Matcher) ServiceName() string {
	return "AmazonS3"
}

// Supports returns true for aws_s3_bucket resources
func (m *S3Matcher) Supports(resourceType string) bool {
	return resourceType == "aws_s3_bucket"
}

// Match generates usage vectors for an S3 bucket
func (m *S3Matcher) Match(ctx context.Context, resource types.TerraformResource, region string) ([]types.UsageVector, error) {
	vectors := []types.UsageVector{}

	// Assumed storage (1TB default - can't determine from Terraform)
	storageGB := 1000.0

	// Standard storage
	vectors = append(vectors, types.UsageVector{
		Service:   "AmazonS3",
		Region:    region,
		UsageType: "TimedStorage-ByteHrs",
		Unit:      "GB-Mo",
		Quantity:  storageGB,
		Attributes: map[string]string{
			"storageClass": "General Purpose",
		},
	})

	// Assumed requests (100K GET, 10K PUT per month)
	vectors = append(vectors, types.UsageVector{
		Service:   "AmazonS3",
		Region:    region,
		UsageType: "Requests-Tier1",
		Unit:      "Requests",
		Quantity:  10000,
	})

	vectors = append(vectors, types.UsageVector{
		Service:   "AmazonS3",
		Region:    region,
		UsageType: "Requests-Tier2",
		Unit:      "Requests",
		Quantity:  100000,
	})

	// Data transfer out (100GB assumed)
	vectors = append(vectors, types.UsageVector{
		Service:   "AWSDataTransfer",
		Region:    region,
		UsageType: "DataTransfer-Out-Bytes",
		Unit:      "GB",
		Quantity:  100,
	})

	return vectors, nil
}

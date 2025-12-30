package adapters

import (
	"github.com/aws-cost-estimation/cost-engine/pkg/types"
)

type S3Adapter struct{}

func NewS3Adapter() *S3Adapter {
	return &S3Adapter{}
}

func (a *S3Adapter) Supports(resourceType string) bool {
	return resourceType == "aws_s3_bucket"
}

func (a *S3Adapter) Extract(resource *types.Resource) ([]types.UsageVector, error) {
	// S3 requires usage profile - storage GB, requests, data transfer
	// Without usage profile, we CANNOT estimate accurately
	// We must explicitly state this

	region := GetStringAttr(resource, "region", "us-east-1")

	// Return empty vectors with explicit note
	// In production, this would integrate with usage modeling system
	return []types.UsageVector{
		{
			Service:    "AmazonS3",
			Region:     region,
			UsageType:  "TimedStorage-ByteHrs",
			Unit:       "GB-Mo",
			Quantity:   0,
			Metadata: map[string]interface{}{
				"resource":   resource.Address,
				"note":       "S3 bucket cost requires usage profile (storage GB, request count, data transfer)",
			},
			Confidence: types.ConfidenceLow,
		},
	}, nil
}

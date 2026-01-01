// Package matchers provides service-specific pricing matchers
package matchers

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/santoshpalla27/aws-cost-estimation/cost-engine/internal/types"
)

// EBSMatcher handles aws_ebs_volume resources
type EBSMatcher struct {
	pool *pgxpool.Pool
}

// NewEBSMatcher creates an EBS matcher
func NewEBSMatcher(pool *pgxpool.Pool) *EBSMatcher {
	return &EBSMatcher{pool: pool}
}

// ServiceName returns the AWS service code
func (m *EBSMatcher) ServiceName() string {
	return "AmazonEC2"
}

// Supports returns true for aws_ebs_volume resources
func (m *EBSMatcher) Supports(resourceType string) bool {
	return resourceType == "aws_ebs_volume"
}

// Match generates usage vectors for an EBS volume
func (m *EBSMatcher) Match(ctx context.Context, resource types.TerraformResource, region string) ([]types.UsageVector, error) {
	vectors := []types.UsageVector{}

	// Get volume size
	size := 20.0 // default
	if s, ok := resource.Config["size"].(float64); ok {
		size = s
	} else if s, ok := resource.Config["size"].(int64); ok {
		size = float64(s)
	}

	// Get volume type
	volumeType := "gp3" // default
	if vt, ok := resource.Config["type"].(string); ok {
		volumeType = vt
	}

	// Storage cost
	vectors = append(vectors, types.UsageVector{
		Service:   "AmazonEC2",
		Region:    region,
		UsageType: "EBS:VolumeUsage." + volumeType,
		Unit:      "GB-Mo",
		Quantity:  size,
	})

	// IOPS cost for io1/io2 volumes
	if volumeType == "io1" || volumeType == "io2" {
		iops := 3000.0 // default
		if i, ok := resource.Config["iops"].(float64); ok {
			iops = i
		} else if i, ok := resource.Config["iops"].(int64); ok {
			iops = float64(i)
		}
		vectors = append(vectors, types.UsageVector{
			Service:   "AmazonEC2",
			Region:    region,
			UsageType: "EBS:VolumeP-IOPS." + volumeType,
			Unit:      "IOPS-Mo",
			Quantity:  iops,
		})
	}

	// Throughput cost for gp3 volumes
	if volumeType == "gp3" {
		if throughput, ok := resource.Config["throughput"].(float64); ok && throughput > 125 {
			// Only charge for throughput above baseline 125 MB/s
			extraThroughput := throughput - 125
			vectors = append(vectors, types.UsageVector{
				Service:   "AmazonEC2",
				Region:    region,
				UsageType: "EBS:VolumeUsage.gp3.throughput",
				Unit:      "MiBps-Mo",
				Quantity:  extraThroughput,
			})
		}
	}

	return vectors, nil
}

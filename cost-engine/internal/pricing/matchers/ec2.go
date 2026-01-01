// Package matchers provides service-specific pricing matchers
package matchers

import (
	"context"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/santoshpalla27/aws-cost-estimation/cost-engine/internal/types"
)

// EC2Matcher handles aws_instance resources
type EC2Matcher struct {
	pool *pgxpool.Pool
}

// NewEC2Matcher creates an EC2 matcher
func NewEC2Matcher(pool *pgxpool.Pool) *EC2Matcher {
	return &EC2Matcher{pool: pool}
}

// ServiceName returns the AWS service code
func (m *EC2Matcher) ServiceName() string {
	return "AmazonEC2"
}

// Supports returns true for aws_instance resources
func (m *EC2Matcher) Supports(resourceType string) bool {
	return resourceType == "aws_instance"
}

// Match generates usage vectors for an EC2 instance
func (m *EC2Matcher) Match(ctx context.Context, resource types.TerraformResource, region string) ([]types.UsageVector, error) {
	vectors := []types.UsageVector{}

	// Get instance type
	instanceType := "t3.micro" // default
	if it, ok := resource.Config["instance_type"].(string); ok {
		instanceType = it
	}

	// Get OS from AMI (simplified - assume Linux)
	os := "Linux"
	if ami, ok := resource.Config["ami"].(string); ok {
		if strings.Contains(ami, "windows") {
			os = "Windows"
		}
	}

	// Compute hours (730 hours/month)
	vectors = append(vectors, types.UsageVector{
		Service:   "AmazonEC2",
		Region:    region,
		UsageType: "BoxUsage:" + instanceType,
		Unit:      "Hrs",
		Quantity:  730,
		Attributes: map[string]string{
			"instanceType":    instanceType,
			"operatingSystem": os,
			"tenancy":         "Shared",
		},
	})

	// Root EBS volume
	rootVolumeSize := 8.0 // default
	rootVolumeType := "gp3"
	if rootBlock, ok := resource.Config["root_block_device"].(map[string]interface{}); ok {
		if size, ok := rootBlock["volume_size"].(float64); ok {
			rootVolumeSize = size
		} else if size, ok := rootBlock["volume_size"].(int64); ok {
			rootVolumeSize = float64(size)
		}
		if vt, ok := rootBlock["volume_type"].(string); ok {
			rootVolumeType = vt
		}
	}

	vectors = append(vectors, types.UsageVector{
		Service:   "AmazonEC2",
		Region:    region,
		UsageType: "EBS:VolumeUsage." + rootVolumeType,
		Unit:      "GB-Mo",
		Quantity:  rootVolumeSize,
	})

	// Additional EBS volumes
	if ebsDevices, ok := resource.Config["ebs_block_device"].([]interface{}); ok {
		for _, dev := range ebsDevices {
			if devMap, ok := dev.(map[string]interface{}); ok {
				size := 20.0
				volType := "gp3"
				if s, ok := devMap["volume_size"].(float64); ok {
					size = s
				} else if s, ok := devMap["volume_size"].(int64); ok {
					size = float64(s)
				}
				if vt, ok := devMap["volume_type"].(string); ok {
					volType = vt
				}
				vectors = append(vectors, types.UsageVector{
					Service:   "AmazonEC2",
					Region:    region,
					UsageType: "EBS:VolumeUsage." + volType,
					Unit:      "GB-Mo",
					Quantity:  size,
				})
			}
		}
	}

	// Data transfer (assumed 100GB out)
	vectors = append(vectors, types.UsageVector{
		Service:   "AWSDataTransfer",
		Region:    region,
		UsageType: "DataTransfer-Out-Bytes",
		Unit:      "GB",
		Quantity:  100,
	})

	return vectors, nil
}

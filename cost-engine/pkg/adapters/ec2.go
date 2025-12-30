package adapters

import (
	"fmt"

	"github.com/aws-cost-estimation/cost-engine/pkg/types"
)

type EC2Adapter struct{}

func NewEC2Adapter() *EC2Adapter {
	return &EC2Adapter{}
}

func (a *EC2Adapter) Supports(resourceType string) bool {
	return resourceType == "aws_instance"
}

func (a *EC2Adapter) Extract(resource *types.Resource) ([]types.UsageVector, error) {
	var vectors []types.UsageVector

	// Extract instance type (REQUIRED)
	instanceType := GetStringAttr(resource, "instance_type", "")
	if instanceType == "" {
		return nil, fmt.Errorf("instance_type is required for aws_instance")
	}

	// Extract region (fallback to us-east-1)
	region := GetStringAttr(resource, "region", "us-east-1")

	// Extract tenancy (affects pricing)
	tenancy := GetStringAttr(resource, "tenancy", "default")

	// Determine confidence based on mocks
	confidence := types.ConfidenceHigh
	if resource.IsMocked {
		confidence = types.ConfidenceMedium
	}

	// 1. Compute hours (730 hours/month for always-on instance)
	computeVector := types.UsageVector{
		Service:   "AmazonEC2",
		Region:    region,
		UsageType: fmt.Sprintf("BoxUsage:%s", instanceType),
		Unit:      "Hrs",
		Quantity:  730, // Full month
		Metadata: map[string]interface{}{
			"instance_type": instanceType,
			"tenancy":       tenancy,
			"resource":      resource.Address,
		},
		Confidence: confidence,
	}
	vectors = append(vectors, computeVector)

	// 2. EBS volumes (if specified)
	if rootBlockDevice, ok := resource.Attributes["root_block_device"].(map[string]interface{}); ok {
		ebsVectors := a.extractEBS(rootBlockDevice, region, resource.Address, confidence)
		vectors = append(vectors, ebsVectors...)
	}

	if ebsBlockDevices, ok := resource.Attributes["ebs_block_device"].([]interface{}); ok {
		for _, dev := range ebsBlockDevices {
			if device, ok := dev.(map[string]interface{}); ok {
				ebsVectors := a.extractEBS(device, region, resource.Address, confidence)
				vectors = append(vectors, ebsVectors...)
			}
		}
	}

	// 3. Data transfer (simplified - outbound data transfer)
	// In production, this would be configurable via usage profiles
	// For now, we'll skip this or use a conservative default

	return vectors, nil
}

func (a *EC2Adapter) extractEBS(blockDevice map[string]interface{}, region string, resourceAddr string, confidence types.ConfidenceLevel) []types.UsageVector {
	var vectors []types.UsageVector

	volumeType := "gp3" // Default
	if vt, ok := blockDevice["volume_type"].(string); ok {
		volumeType = vt
	}

	volumeSize := 8.0 // Default
	if vs, ok := blockDevice["volume_size"].(float64); ok {
		volumeSize = vs
	} else if vs, ok := blockDevice["volume_size"].(int); ok {
		volumeSize = float64(vs)
	}

	// Storage vector
	storageVector := types.UsageVector{
		Service:   "AmazonEC2",
		Region:    region,
		UsageType: fmt.Sprintf("EBS:%s", volumeType),
		Unit:      "GB-Mo",
		Quantity:  volumeSize,
		Metadata: map[string]interface{}{
			"volume_type": volumeType,
			"resource":    resourceAddr,
		},
		Confidence: confidence,
	}
	vectors = append(vectors, storageVector)

	// IOPS for io1/io2 volumes
	if volumeType == "io1" || volumeType == "io2" {
		iops := 100.0 // Default
		if i, ok := blockDevice["iops"].(float64); ok {
			iops = i
		} else if i, ok := blockDevice["iops"].(int); ok {
			iops = float64(i)
		}

		iopsVector := types.UsageVector{
			Service:   "AmazonEC2",
			Region:    region,
			UsageType: fmt.Sprintf("IOPS:%s", volumeType),
			Unit:      "IOPS-Mo",
			Quantity:  iops,
			Metadata: map[string]interface{}{
				"volume_type": volumeType,
				"resource":    resourceAddr,
			},
			Confidence: confidence,
		}
		vectors = append(vectors, iopsVector)
	}

	return vectors
}

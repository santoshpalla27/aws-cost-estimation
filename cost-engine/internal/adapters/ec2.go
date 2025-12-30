// Package adapters provides service-specific adapters that convert
// Terraform resources into usage vectors for pricing
package adapters

import (
	"fmt"
	"strings"

	"github.com/santoshpalla27/aws-cost-estimation/cost-engine/internal/types"
)

// EC2Adapter converts aws_instance resources into usage vectors
type EC2Adapter struct {
	// Default hours per month (730 = 365.25/12 * 24)
	DefaultHoursPerMonth float64
}

// NewEC2Adapter creates a new EC2 adapter
func NewEC2Adapter() *EC2Adapter {
	return &EC2Adapter{
		DefaultHoursPerMonth: 730,
	}
}

// Adapt converts an aws_instance resource to usage vectors
func (a *EC2Adapter) Adapt(resource types.TerraformResource, region string) []types.UsageVector {
	if resource.Type != "aws_instance" {
		return nil
	}

	var vectors []types.UsageVector

	// Extract instance type
	instanceType := a.getStringAttr(resource.Config, "instance_type", "t3.micro")
	
	// EC2 Instance compute usage
	vectors = append(vectors, types.UsageVector{
		ResourceAddress: resource.Address,
		Service:         "AmazonEC2",
		UsageType:       fmt.Sprintf("BoxUsage:%s", instanceType),
		Region:          region,
		Unit:            "Hrs",
		Quantity:        a.DefaultHoursPerMonth,
		Confidence:      types.ConfidenceHigh,
		Attributes: map[string]string{
			"instanceType":    instanceType,
			"tenancy":         a.getStringAttr(resource.Config, "tenancy", "Shared"),
			"operatingSystem": a.guessOS(resource),
			"preInstalledSw":  "NA",
			"capacitystatus":  "Used",
		},
	})

	// EBS Root Volume
	rootBlockDevice := a.getBlockDevice(resource.Config, "root_block_device")
	if rootBlockDevice != nil {
		volumeType := a.getStringAttr(rootBlockDevice, "volume_type", "gp3")
		volumeSize := a.getIntAttr(rootBlockDevice, "volume_size", 8)
		
		vectors = append(vectors, types.UsageVector{
			ResourceAddress: resource.Address,
			Service:         "AmazonEC2",
			UsageType:       fmt.Sprintf("EBS:VolumeUsage.%s", volumeType),
			Region:          region,
			Unit:            "GB-Mo",
			Quantity:        float64(volumeSize),
			Confidence:      types.ConfidenceHigh,
			Attributes: map[string]string{
				"volumeType": volumeType,
			},
		})

		// IOPS for io1/io2/gp3
		if volumeType == "io1" || volumeType == "io2" {
			iops := a.getIntAttr(rootBlockDevice, "iops", 3000)
			vectors = append(vectors, types.UsageVector{
				ResourceAddress: resource.Address,
				Service:         "AmazonEC2",
				UsageType:       fmt.Sprintf("EBS:VolumeP-IOPS.%s", volumeType),
				Region:          region,
				Unit:            "IOPS-Mo",
				Quantity:        float64(iops),
				Confidence:      types.ConfidenceHigh,
			})
		}

		// Throughput for gp3
		if volumeType == "gp3" {
			throughput := a.getIntAttr(rootBlockDevice, "throughput", 125)
			if throughput > 125 { // First 125 MB/s is free
				vectors = append(vectors, types.UsageVector{
					ResourceAddress: resource.Address,
					Service:         "AmazonEC2",
					UsageType:       "EBS:VolumeP-Throughput.gp3",
					Region:          region,
					Unit:            "MiBps-Mo",
					Quantity:        float64(throughput - 125),
					Confidence:      types.ConfidenceHigh,
				})
			}
		}
	}

	// Additional EBS volumes
	ebsBlocks := a.getBlockDeviceList(resource.Config, "ebs_block_device")
	for i, block := range ebsBlocks {
		volumeType := a.getStringAttr(block, "volume_type", "gp3")
		volumeSize := a.getIntAttr(block, "volume_size", 100)

		vectors = append(vectors, types.UsageVector{
			ResourceAddress: fmt.Sprintf("%s.ebs[%d]", resource.Address, i),
			Service:         "AmazonEC2",
			UsageType:       fmt.Sprintf("EBS:VolumeUsage.%s", volumeType),
			Region:          region,
			Unit:            "GB-Mo",
			Quantity:        float64(volumeSize),
			Confidence:      types.ConfidenceHigh,
			Attributes: map[string]string{
				"volumeType": volumeType,
			},
		})
	}

	// Data transfer (assume minimal if not specified)
	vectors = append(vectors, types.UsageVector{
		ResourceAddress: resource.Address,
		Service:         "AmazonEC2",
		UsageType:       "DataTransfer-Out-Bytes",
		Region:          region,
		Unit:            "GB",
		Quantity:        100, // Default assumption: 100 GB/month
		Confidence:      types.ConfidenceLow,
		Assumptions:     []string{"Assumed 100 GB/month data transfer out (not specified)"},
	})

	return vectors
}

// guessOS attempts to determine the OS from the AMI or config
func (a *EC2Adapter) guessOS(resource types.TerraformResource) string {
	ami := a.getStringAttr(resource.Config, "ami", "")
	
	// Simple heuristics based on common AMI patterns
	amiLower := strings.ToLower(ami)
	if strings.Contains(amiLower, "windows") {
		return "Windows"
	}
	if strings.Contains(amiLower, "rhel") {
		return "RHEL"
	}
	if strings.Contains(amiLower, "suse") {
		return "SUSE"
	}
	
	// Default to Linux - most common
	return "Linux"
}

// getStringAttr safely extracts a string attribute
func (a *EC2Adapter) getStringAttr(config map[string]interface{}, key, defaultVal string) string {
	if val, ok := config[key]; ok {
		if str, ok := val.(string); ok {
			return str
		}
	}
	return defaultVal
}

// getIntAttr safely extracts an integer attribute
func (a *EC2Adapter) getIntAttr(config map[string]interface{}, key string, defaultVal int) int {
	if val, ok := config[key]; ok {
		switch v := val.(type) {
		case int:
			return v
		case int64:
			return int(v)
		case float64:
			return int(v)
		}
	}
	return defaultVal
}

// getBlockDevice extracts a single block device configuration
func (a *EC2Adapter) getBlockDevice(config map[string]interface{}, key string) map[string]interface{} {
	if val, ok := config[key]; ok {
		if block, ok := val.(map[string]interface{}); ok {
			return block
		}
		if arr, ok := val.([]interface{}); ok && len(arr) > 0 {
			if block, ok := arr[0].(map[string]interface{}); ok {
				return block
			}
		}
	}
	return nil
}

// getBlockDeviceList extracts a list of block devices
func (a *EC2Adapter) getBlockDeviceList(config map[string]interface{}, key string) []map[string]interface{} {
	var result []map[string]interface{}
	if val, ok := config[key]; ok {
		if arr, ok := val.([]interface{}); ok {
			for _, item := range arr {
				if block, ok := item.(map[string]interface{}); ok {
					result = append(result, block)
				}
			}
		} else if block, ok := val.(map[string]interface{}); ok {
			result = append(result, block)
		}
	}
	return result
}

// CanHandle returns true if this adapter can handle the resource type
func (a *EC2Adapter) CanHandle(resourceType string) bool {
	return resourceType == "aws_instance"
}

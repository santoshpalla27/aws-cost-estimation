package adapters

import (
	"fmt"

	"github.com/aws-cost-estimation/cost-engine/pkg/types"
)

type EC2Adapter struct {
	evalMode *types.ModeDefaults
}

func NewEC2Adapter() *EC2Adapter {
	return &EC2Adapter{
		evalMode: &types.ModeDefaults{Mode: types.EvaluationConservative},
	}
}

func NewEC2AdapterWithMode(mode types.EvaluationMode) *EC2Adapter {
	return &EC2Adapter{
		evalMode: &types.ModeDefaults{Mode: mode},
	}
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

	// Region - MUST be injected by terraform loader or mocker
	// NO DEFAULTS ALLOWED in adapters
	if resource.Region == "" {
		return nil, fmt.Errorf("region is required for %s but was empty - this is a loader/mocker bug", resource.Address)
	}
	region := resource.Region

	// Extract tenancy (affects pricing)
	tenancy := GetStringAttr(resource, "tenancy", "default")

	// Extract operating system (affects pricing)
	// In production, this would be inferred from AMI
	operatingSystem := GetStringAttr(resource, "os_type", "Linux") // Linux is typical default

	// Determine confidence based on mocks
	confidence := types.ConfidenceHigh
	if resource.IsMocked {
		confidence = types.ConfidenceMedium
	}

	// 1. COMPUTE: Instance hours (mode-aware)
	// Hours depend on evaluation mode
	hours := a.evalMode.GetEC2RuntimeHours()
	
	computeVector := types.UsageVector{
		Service:   "AmazonEC2",
		Region:    region,
		UsageType: fmt.Sprintf("BoxUsage:%s", instanceType),
		Unit:      "Hrs",
		Quantity:  hours,
		Metadata: map[string]interface{}{
			"instance_type":     instanceType,
			"tenancy":           tenancy,
			"operating_system":  operatingSystem,
			"resource":          resource.Address,
			"evaluation_mode":   string(a.evalMode.Mode),
			"formula":           fmt.Sprintf("%.0f hrs = runtime assumption (%s mode)", hours, a.evalMode.Mode),
		},
		Confidence: confidence,
	}
	vectors = append(vectors, computeVector)

	// 2. STORAGE: EBS volumes (if specified)
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

	// 3. NETWORK: Data transfer (mode-aware heuristic)
	// In production, this would come from usage profiles
	// For now, use mode-aware defaults
	dataTransferGB := a.evalMode.GetDataTransferGB()
	
	if dataTransferGB > 0 {
		dataTransferVector := types.UsageVector{
			Service:   "AmazonEC2",
			Region:    region,
			UsageType: "DataTransfer-Out-Bytes",
			Unit:      "GB",
			Quantity:  dataTransferGB,
			Metadata: map[string]interface{}{
				"resource":         resource.Address,
				"evaluation_mode":  string(a.evalMode.Mode),
				"assumption":       fmt.Sprintf("Data transfer estimated at %.0f GB/month (%s mode) - override with usage profile", dataTransferGB, a.evalMode.Mode),
				"formula":         fmt.Sprintf("%.0f GB outbound data transfer", dataTransferGB),
			},
			Confidence: types.ConfidenceLow, // Always LOW for heuristic data transfer
		}
		vectors = append(vectors, dataTransferVector)
	}

	return vectors, nil
}

func (a *EC2Adapter) extractEBS(blockDevice map[string]interface{}, region string, resourceAddr string, confidence types.ConfidenceLevel) []types.UsageVector {
	var vectors []types.UsageVector

	volumeType := "gp3" // Default modern type
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
		UsageType: fmt.Sprintf("EBS:VolumeUsage.%s", volumeType),
		Unit:      "GB-Mo",
		Quantity:  volumeSize,
		Metadata: map[string]interface{}{
			"volume_type": volumeType,
			"resource":    resourceAddr,
			"formula":     fmt.Sprintf("%.0f GB × 1 month = %.0f GB-Mo", volumeSize, volumeSize),
		},
		Confidence: confidence,
	}
	vectors = append(vectors, storageVector)

	// IOPS for io1/io2/gp3 volumes
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
				"formula":     fmt.Sprintf("%.0f provisioned IOPS × 1 month", iops),
			},
			Confidence: confidence,
		}
		vectors = append(vectors, iopsVector)
	}

	// gp3 allows custom IOPS above baseline
	if volumeType == "gp3" {
		if iops, ok := blockDevice["iops"].(float64); ok && iops > 3000 {
			// Charge for IOPS above baseline
			extraIOPS := iops - 3000
			iopsVector := types.UsageVector{
				Service:   "AmazonEC2",
				Region:    region,
				UsageType: "IOPS:gp3",
				Unit:      "IOPS-Mo",
				Quantity:  extraIOPS,
				Metadata: map[string]interface{}{
					"volume_type": volumeType,
					"resource":    resourceAddr,
					"formula":     fmt.Sprintf("%.0f IOPS - 3000 baseline = %.0f extra IOPS", iops, extraIOPS),
				},
				Confidence: confidence,
			}
			vectors = append(vectors, iopsVector)
		}

		// gp3 also allows custom throughput
		if throughput, ok := blockDevice["throughput"].(float64); ok && throughput > 125 {
			// Charge for throughput above baseline
			extraThroughput := throughput - 125
			throughputVector := types.UsageVector{
				Service:   "AmazonEC2",
				Region:    region,
				UsageType: "Throughput:gp3",
				Unit:      "MBps-Mo",
				Quantity:  extraThroughput,
				Metadata: map[string]interface{}{
					"volume_type": volumeType,
					"resource":    resourceAddr,
					"formula":     fmt.Sprintf("%.0f MBps - 125 baseline = %.0f extra MBps", throughput, extraThroughput),
				},
				Confidence: confidence,
			}
			vectors = append(vectors, throughputVector)
		}
	}

	return vectors
}

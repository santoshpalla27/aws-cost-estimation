package adapters

import (
	"fmt"

	"github.com/aws-cost-estimation/cost-engine/pkg/types"
)

type RDSAdapter struct{}

func NewRDSAdapter() *RDSAdapter {
	return &RDSAdapter{}
}

func (a *RDSAdapter) Supports(resourceType string) bool {
	return resourceType == "aws_db_instance"
}

func (a *RDSAdapter) Extract(resource *types.Resource) ([]types.UsageVector, error) {
	var vectors []types.UsageVector

	// Instance class (REQUIRED)
	instanceClass := GetStringAttr(resource, "instance_class", "")
	if instanceClass == "" {
		return nil, fmt.Errorf("instance_class is required for aws_db_instance")
	}

	// Database engine
	engine := GetStringAttr(resource, "engine", "mysql")

	// Region - MUST be injected by terraform loader or mocker
	// NO DEFAULTS ALLOWED in adapters
	if resource.Region == "" {
		return nil, fmt.Errorf("region is required for %s but was empty - this is a loader/mocker bug", resource.Address)
	}
	region := resource.Region

	// Multi-AZ
	multiAZ := GetBoolAttr(resource, "multi_az", false)

	// Confidence
	confidence := types.ConfidenceHigh
	if resource.IsMocked {
		confidence = types.ConfidenceMedium
	}

	// 1. Instance hours
	instanceVector := types.UsageVector{
		Service:   "AmazonRDS",
		Region:    region,
		UsageType: fmt.Sprintf("InstanceUsage:%s", instanceClass),
		Unit:      "Hrs",
		Quantity:  730,
		Metadata: map[string]interface{}{
			"instance_class": instanceClass,
			"engine":         engine,
			"multi_az":       multiAZ,
			"resource":       resource.Address,
		},
		Confidence: confidence,
	}
	vectors = append(vectors, instanceVector)

	// 2. Storage
	allocatedStorage := GetFloatAttr(resource, "allocated_storage", 20) // GB
	storageType := GetStringAttr(resource, "storage_type", "gp2")

	storageVector := types.UsageVector{
		Service:   "AmazonRDS",
		Region:    region,
		UsageType: fmt.Sprintf("Storage:%s", storageType),
		Unit:      "GB-Mo",
		Quantity:  allocatedStorage,
		Metadata: map[string]interface{}{
			"storage_type": storageType,
			"resource":     resource.Address,
		},
		Confidence: confidence,
	}
	vectors = append(vectors, storageVector)

	// 3. IOPS (if io1)
	if storageType == "io1" {
		iops := GetFloatAttr(resource, "iops", 1000)
		iopsVector := types.UsageVector{
			Service:   "AmazonRDS",
			Region:    region,
			UsageType: "PIOPS",
			Unit:      "IOPS-Mo",
			Quantity:  iops,
			Metadata: map[string]interface{}{
				"resource": resource.Address,
			},
			Confidence: confidence,
		}
		vectors = append(vectors, iopsVector)
	}

	// 4. Backup storage (estimated at 10% of allocated storage)
	backupVector := types.UsageVector{
		Service:   "AmazonRDS",
		Region:    region,
		UsageType: "BackupUsage",
		Unit:      "GB-Mo",
		Quantity:  allocatedStorage * 0.1,
		Metadata: map[string]interface{}{
			"resource":   resource.Address,
			"assumption": "Backup storage estimated at 10% of allocated storage",
		},
		Confidence: types.ConfidenceMedium, // Medium because it's estimated
	}
	vectors = append(vectors, backupVector)

	return vectors, nil
}

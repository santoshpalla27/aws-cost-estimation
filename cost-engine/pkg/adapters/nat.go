package adapters

import (
	"github.com/aws-cost-estimation/cost-engine/pkg/types"
)

type NATAdapter struct{}

func NewNATAdapter() *NATAdapter {
	return &NATAdapter{}
}

func (a *NATAdapter) Supports(resourceType string) bool {
	return resourceType == "aws_nat_gateway"
}

func (a *NATAdapter) Extract(resource *types.Resource) ([]types.UsageVector, error) {
	var vectors []types.UsageVector

	region := GetStringAttr(resource, "region", "us-east-1")

	// NAT Gateway has two components:
	// 1. Hourly charge
	// 2. Data processed charge (requires usage profile)

	confidence := types.ConfidenceHigh
	if resource.IsMocked {
		confidence = types.ConfidenceMedium
	}

	// 1. NAT Gateway hours
	hoursVector := types.UsageVector{
		Service:   "AmazonEC2",
		Region:    region,
		UsageType: "NatGateway-Hours",
		Unit:      "Hrs",
		Quantity:  730,
		Metadata: map[string]interface{}{
			"resource": resource.Address,
		},
		Confidence: confidence,
	}
	vectors = append(vectors, hoursVector)

	// 2. Data processed (conservative estimate: 100 GB/month)
	// This should come from usage profile in production
	dataProcessedGB := 100.0

	dataVector := types.UsageVector{
		Service:   "AmazonEC2",
		Region:    region,
		UsageType: "NatGateway-Bytes",
		Unit:      "GB",
		Quantity:  dataProcessedGB,
		Metadata: map[string]interface{}{
			"resource":   resource.Address,
			"assumption": "Data processed estimated at 100 GB/month - override with usage profile",
		},
		Confidence: types.ConfidenceLow, // LOW because data volume is assumed
	}
	vectors = append(vectors, dataVector)

	return vectors, nil
}

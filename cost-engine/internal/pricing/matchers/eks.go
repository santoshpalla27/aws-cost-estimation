// Package matchers provides service-specific pricing matchers
package matchers

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/santoshpalla27/aws-cost-estimation/cost-engine/internal/types"
)

// EKSMatcher handles aws_eks_cluster resources
type EKSMatcher struct {
	pool *pgxpool.Pool
}

// NewEKSMatcher creates an EKS matcher
func NewEKSMatcher(pool *pgxpool.Pool) *EKSMatcher {
	return &EKSMatcher{pool: pool}
}

// ServiceName returns the AWS service code
func (m *EKSMatcher) ServiceName() string {
	return "AmazonEKS"
}

// Supports returns true for aws_eks_cluster resources
func (m *EKSMatcher) Supports(resourceType string) bool {
	return resourceType == "aws_eks_cluster" ||
		resourceType == "aws_eks_node_group" ||
		resourceType == "aws_eks_fargate_profile"
}

// Match generates usage vectors for an EKS cluster
func (m *EKSMatcher) Match(ctx context.Context, resource types.TerraformResource, region string) ([]types.UsageVector, error) {
	vectors := []types.UsageVector{}

	switch resource.Type {
	case "aws_eks_cluster":
		// EKS control plane: $0.10/hour
		vectors = append(vectors, types.UsageVector{
			Service:   "AmazonEKS",
			Region:    region,
			UsageType: "AmazonEKS-Hours:perCluster",
			Unit:      "Hrs",
			Quantity:  730,
		})

	case "aws_eks_node_group":
		// Node group - cost is in EC2 instances
		instanceTypes := []string{"t3.medium"} // default
		if its, ok := resource.Config["instance_types"].([]interface{}); ok && len(its) > 0 {
			instanceTypes = []string{}
			for _, it := range its {
				if itStr, ok := it.(string); ok {
					instanceTypes = append(instanceTypes, itStr)
				}
			}
		}

		// Get scaling config
		desiredSize := 2.0
		if sc, ok := resource.Config["scaling_config"].(map[string]interface{}); ok {
			if ds, ok := sc["desired_size"].(float64); ok {
				desiredSize = ds
			} else if ds, ok := sc["desired_size"].(int64); ok {
				desiredSize = float64(ds)
			}
		}

		// Add EC2 compute cost for each instance type
		for _, instanceType := range instanceTypes {
			vectors = append(vectors, types.UsageVector{
				Service:   "AmazonEC2",
				Region:    region,
				UsageType: "BoxUsage:" + instanceType,
				Unit:      "Hrs",
				Quantity:  730 * desiredSize,
				Attributes: map[string]string{
					"instanceType":    instanceType,
					"operatingSystem": "Linux",
					"tenancy":         "Shared",
				},
			})
		}

	case "aws_eks_fargate_profile":
		// Fargate pods - assume 2 pods, 0.5 vCPU, 1GB memory each
		vCPUHours := 0.5 * 730 * 2   // 0.5 vCPU * 730 hours * 2 pods
		memoryGBHours := 1.0 * 730 * 2 // 1 GB * 730 hours * 2 pods

		vectors = append(vectors, types.UsageVector{
			Service:   "AmazonEKS",
			Region:    region,
			UsageType: "Fargate-vCPU-Hours:perCPU",
			Unit:      "vCPU-Hours",
			Quantity:  vCPUHours,
		})

		vectors = append(vectors, types.UsageVector{
			Service:   "AmazonEKS",
			Region:    region,
			UsageType: "Fargate-GB-Hours:perGB",
			Unit:      "GB-Hours",
			Quantity:  memoryGBHours,
		})
	}

	return vectors, nil
}

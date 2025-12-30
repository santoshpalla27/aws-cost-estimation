package mocker

import (
	"fmt"

	"github.com/aws-cost-estimation/cost-engine/pkg/types"
	log "github.com/sirupsen/logrus"
)

// Mocker handles detection and mocking of unresolved Terraform values
type Mocker struct {
	rules map[string]MockRule
}

// MockRule defines how to mock a specific pattern
type MockRule struct {
	Pattern    string
	MockValue  func(resource *types.Resource) interface{}
	Reason     string
	Confidence types.ConfidenceLevel
}

func New() *Mocker {
	return &Mocker{
		rules: defaultMockRules(),
	}
}

// ProcessResources detects and mocks unresolved values
func (m *Mocker) ProcessResources(resources []types.Resource) []types.Resource {
	processed := make([]types.Resource, len(resources))
	copy(processed, resources)

	for i := range processed {
		m.processResource(&processed[i])
	}

	return processed
}

func (m *Mocker) processResource(resource *types.Resource) {
	// Check for unresolved data sources
	if m.hasUnresolvedDataSource(resource) {
		m.mockDataSource(resource)
	}

	// Check for missing required attributes
	m.fillMissingAttributes(resource)

	// Infer implicit infrastructure
	m.inferImplicitResources(resource)
}

func (m *Mocker) hasUnresolvedDataSource(resource *types.Resource) bool {
	// Check if any attribute references a data source
	// In real implementation, this would check for data.* references
	return false
}

func (m *Mocker) mockDataSource(resource *types.Resource) {
	// Mock common data sources
	// Example: data.aws_ami.ubuntu
	annotation := types.MockAnnotation{
		Field:      "ami",
		Value:      "ami-mocked-12345678",
		Reason:     "AMI data source unresolved - using heuristic mock",
		Confidence: types.ConfidenceMedium,
	}

	resource.IsMocked = true
	resource.MockMetadata = append(resource.MockMetadata, annotation)

	log.WithFields(log.Fields{
		"resource": resource.Address,
		"field":    annotation.Field,
		"reason":   annotation.Reason,
	}).Warn("Mocked unresolved data source")
}

func (m *Mocker) fillMissingAttributes(resource *types.Resource) {
	// Fill in sensible defaults for missing required attributes
	switch resource.Type {
	case "aws_instance":
		m.fillEC2Defaults(resource)
	case "aws_rds_instance":
		m.fillRDSDefaults(resource)
	case "aws_lambda_function":
		m.fillLambdaDefaults(resource)
	}
}

func (m *Mocker) fillEC2Defaults(resource *types.Resource) {
	// If availability_zone is missing, infer from region
	if _, exists := resource.Attributes["availability_zone"]; !exists {
		resource.Attributes["availability_zone"] = "us-east-1a" // Default
		resource.IsMocked = true
		resource.MockMetadata = append(resource.MockMetadata, types.MockAnnotation{
			Field:      "availability_zone",
			Value:      "us-east-1a",
			Reason:     "Availability zone not specified - using default for region",
			Confidence: types.ConfidenceMedium,
		})
	}

	// If AMI is a reference, mock it
	if ami, ok := resource.Attributes["ami"].(string); ok {
		if len(ami) == 0 || ami == "" {
			resource.Attributes["ami"] = "ami-mocked-12345678"
			resource.IsMocked = true
			resource.MockMetadata = append(resource.MockMetadata, types.MockAnnotation{
				Field:      "ami",
				Value:      "ami-mocked-12345678",
				Reason:     "AMI not resolved - using mock value",
				Confidence: types.ConfidenceMedium,
			})
		}
	}
}

func (m *Mocker) fillRDSDefaults(resource *types.Resource) {
	// Mock database defaults
	if _, exists := resource.Attributes["allocated_storage"]; !exists {
		resource.Attributes["allocated_storage"] = 20 // Default 20 GB
		resource.IsMocked = true
		resource.MockMetadata = append(resource.MockMetadata, types.MockAnnotation{
			Field:      "allocated_storage",
			Value:      20,
			Reason:     "Allocated storage not specified - using RDS minimum",
			Confidence: types.ConfidenceHigh,
		})
	}
}

func (m *Mocker) fillLambdaDefaults(resource *types.Resource) {
	// Lambda defaults
	if _, exists := resource.Attributes["memory_size"]; !exists {
		resource.Attributes["memory_size"] = 128 // Default memory
		resource.IsMocked = true
		resource.MockMetadata = append(resource.MockMetadata, types.MockAnnotation{
			Field:      "memory_size",
			Value:      128,
			Reason:     "Memory size not specified - using Lambda default",
			Confidence: types.ConfidenceHigh,
		})
	}

	if _, exists := resource.Attributes["timeout"]; !exists {
		resource.Attributes["timeout"] = 3 // Default timeout
		resource.IsMocked = true
		resource.MockMetadata = append(resource.MockMetadata, types.MockAnnotation{
			Field:      "timeout",
			Value:      3,
			Reason:     "Timeout not specified - using Lambda default",
			Confidence: types.ConfidenceHigh,
		})
	}
}

func (m *Mocker) inferImplicitResources(resource *types.Resource) {
	// Detect implicit infrastructure that will exist
	// Example: NAT Gateway per public subnet
	// This would add synthetic resources to the list
	// For now, just log the detection

	switch resource.Type {
	case "aws_subnet":
		if mapPublicIP, ok := resource.Attributes["map_public_ip_on_launch"].(bool); ok && mapPublicIP {
			log.WithField("subnet", resource.Address).Info("Detected public subnet - may imply NAT Gateway cost")
		}
	}
}

// GetConfidenceLevel returns overall confidence for a resource
func (m *Mocker) GetConfidenceLevel(resource *types.Resource) types.ConfidenceLevel {
	if !resource.IsMocked || len(resource.MockMetadata) == 0 {
		return types.ConfidenceHigh
	}

	// Return lowest confidence from all mocks
	lowestConfidence := types.ConfidenceHigh
	for _, mock := range resource.MockMetadata {
		if mock.Confidence == types.ConfidenceLow {
			return types.ConfidenceLow
		}
		if mock.Confidence == types.ConfidenceMedium {
			lowestConfidence = types.ConfidenceMedium
		}
	}

	return lowestConfidence
}

func defaultMockRules() map[string]MockRule {
	return map[string]MockRule{
		"ami": {
			Pattern: "data.aws_ami.*",
			MockValue: func(r *types.Resource) interface{} {
				return "ami-mocked-12345678"
			},
			Reason:     "AMI data source unresolved",
			Confidence: types.ConfidenceMedium,
		},
		"vpc": {
			Pattern: "data.aws_vpc.*",
			MockValue: func(r *types.Resource) interface{} {
				return "vpc-mocked-12345678"
			},
			Reason:     "VPC data source unresolved",
			Confidence: types.ConfidenceMedium,
		},
	}
}

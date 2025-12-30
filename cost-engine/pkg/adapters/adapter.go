package adapters

import (
	"fmt"

	"github.com/aws-cost-estimation/cost-engine/pkg/types"
)

// Adapter converts Terraform resources into billable usage vectors
type Adapter interface {
	// Supports returns true if this adapter handles the given resource type
	Supports(resourceType string) bool

	// Extract converts resource into usage vectors
	// MUST NOT contain any pricing logic - only usage calculation
	Extract(resource *types.Resource) ([]types.UsageVector, error)
}

// Registry manages all service adapters
type Registry struct {
	adapters []Adapter
}

func NewRegistry() *Registry {
	r := &Registry{
		adapters: []Adapter{},
	}

	// Register all adapters
	r.Register(NewEC2Adapter())
	r.Register(NewLambdaAdapter())
	r.Register(NewS3Adapter())
	r.Register(NewRDSAdapter())
	r.Register(NewNATAdapter())

	return r
}

func (r *Registry) Register(adapter Adapter) {
	r.adapters = append(r.adapters, adapter)
}

// ExtractUsage finds appropriate adapter and extracts usage
func (r *Registry) ExtractUsage(resource *types.Resource) ([]types.UsageVector, error) {
	for _, adapter := range r.adapters {
		if adapter.Supports(resource.Type) {
			return adapter.Extract(resource)
		}
	}

	return nil, fmt.Errorf("no adapter found for resource type: %s", resource.Type)
}

// ExtractAll extracts usage from all resources
func (r *Registry) ExtractAll(resources []types.Resource) ([]types.UsageVector, error) {
	var allUsage []types.UsageVector

	for _, resource := range resources {
		usage, err := r.ExtractUsage(&resource)
		if err != nil {
			// Log but don't fail - some resources might not be billable
			continue
		}

		allUsage = append(allUsage, usage...)
	}

	return allUsage, nil
}

// Helper functions for common patterns

// GetStringAttr safely gets string attribute
func GetStringAttr(resource *types.Resource, key string, defaultValue string) string {
	if val, ok := resource.Attributes[key].(string); ok {
		return val
	}
	return defaultValue
}

// GetIntAttr safely gets int attribute
func GetIntAttr(resource *types.Resource, key string, defaultValue int) int {
	if val, ok := resource.Attributes[key].(int); ok {
		return val
	}
	if val, ok := resource.Attributes[key].(float64); ok {
		return int(val)
	}
	return defaultValue
}

// GetFloatAttr safely gets float attribute
func GetFloatAttr(resource *types.Resource, key string, defaultValue float64) float64 {
	if val, ok := resource.Attributes[key].(float64); ok {
		return val
	}
	if val, ok := resource.Attributes[key].(int); ok {
		return float64(val)
	}
	return defaultValue
}

// GetBoolAttr safely gets bool attribute
func GetBoolAttr(resource *types.Resource, key string, defaultValue bool) bool {
	if val, ok := resource.Attributes[key].(bool); ok {
		return val
	}
	return defaultValue
}

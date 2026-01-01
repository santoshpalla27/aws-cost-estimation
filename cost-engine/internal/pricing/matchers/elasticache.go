// Package matchers provides service-specific pricing matchers
package matchers

import (
	"context"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/santoshpalla27/aws-cost-estimation/cost-engine/internal/types"
)

// ElastiCacheMatcher handles aws_elasticache_cluster resources
type ElastiCacheMatcher struct {
	pool *pgxpool.Pool
}

// NewElastiCacheMatcher creates an ElastiCache matcher
func NewElastiCacheMatcher(pool *pgxpool.Pool) *ElastiCacheMatcher {
	return &ElastiCacheMatcher{pool: pool}
}

// ServiceName returns the AWS service code
func (m *ElastiCacheMatcher) ServiceName() string {
	return "AmazonElastiCache"
}

// Supports returns true for aws_elasticache_cluster resources
func (m *ElastiCacheMatcher) Supports(resourceType string) bool {
	return resourceType == "aws_elasticache_cluster" ||
		resourceType == "aws_elasticache_replication_group"
}

// Match generates usage vectors for an ElastiCache cluster
func (m *ElastiCacheMatcher) Match(ctx context.Context, resource types.TerraformResource, region string) ([]types.UsageVector, error) {
	vectors := []types.UsageVector{}

	// Get node type
	nodeType := "cache.t3.micro" // default
	if nt, ok := resource.Config["node_type"].(string); ok {
		nodeType = nt
	}

	// Get engine
	engine := "redis" // default
	if e, ok := resource.Config["engine"].(string); ok {
		engine = e
	}

	// Number of cache nodes
	numNodes := 1.0
	if nn, ok := resource.Config["num_cache_nodes"].(float64); ok {
		numNodes = nn
	} else if nn, ok := resource.Config["num_cache_nodes"].(int64); ok {
		numNodes = float64(nn)
	}

	// Node hours (730 hours/month * nodes)
	vectors = append(vectors, types.UsageVector{
		Service:   "AmazonElastiCache",
		Region:    region,
		UsageType: "NodeUsage:" + nodeType,
		Unit:      "Hrs",
		Quantity:  730 * numNodes,
		Attributes: map[string]string{
			"cacheEngine":  strings.Title(engine),
			"instanceType": nodeType,
		},
	})

	// Backup storage (assume 5GB if enabled)
	if snapRetention, ok := resource.Config["snapshot_retention_limit"]; ok {
		if retention, isNum := snapRetention.(float64); isNum && retention > 0 {
			vectors = append(vectors, types.UsageVector{
				Service:   "AmazonElastiCache",
				Region:    region,
				UsageType: "ElastiCache:BackupUsage",
				Unit:      "GB-Mo",
				Quantity:  5,
			})
		}
	}

	return vectors, nil
}

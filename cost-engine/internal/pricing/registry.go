// Package pricing provides the matcher registry for extensible service pricing
package pricing

import (
	"context"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/santoshpalla27/aws-cost-estimation/cost-engine/internal/pricing/matchers"
	"github.com/santoshpalla27/aws-cost-estimation/cost-engine/internal/types"
)

// ServiceMatcher interface for service-specific pricing matchers
type ServiceMatcher interface {
	// Match returns usage vectors for a Terraform resource
	Match(ctx context.Context, resource types.TerraformResource, region string) ([]types.UsageVector, error)
	// Supports returns true if this matcher handles the given resource type
	Supports(resourceType string) bool
	// ServiceName returns the AWS service code (e.g., "AmazonEC2")
	ServiceName() string
}

// MatcherRegistry holds all registered service matchers
type MatcherRegistry struct {
	pool     *pgxpool.Pool
	matchers []ServiceMatcher
}

// NewMatcherRegistry creates a new registry with all matchers registered
func NewMatcherRegistry(pool *pgxpool.Pool) *MatcherRegistry {
	registry := &MatcherRegistry{
		pool:     pool,
		matchers: []ServiceMatcher{},
	}

	// Register all matchers
	registry.Register(matchers.NewEC2Matcher(pool))
	registry.Register(matchers.NewEBSMatcher(pool))
	registry.Register(matchers.NewRDSMatcher(pool))
	registry.Register(matchers.NewLambdaMatcher(pool))
	registry.Register(matchers.NewS3Matcher(pool))
	registry.Register(matchers.NewDynamoDBMatcher(pool))
	registry.Register(matchers.NewElastiCacheMatcher(pool))
	registry.Register(matchers.NewEKSMatcher(pool))

	log.Printf("Registered %d service matchers", len(registry.matchers))
	return registry
}

// Register adds a matcher to the registry
func (r *MatcherRegistry) Register(m ServiceMatcher) {
	r.matchers = append(r.matchers, m)
}

// FindMatcher returns the appropriate matcher for a resource type
func (r *MatcherRegistry) FindMatcher(resourceType string) ServiceMatcher {
	for _, m := range r.matchers {
		if m.Supports(resourceType) {
			return m
		}
	}
	return nil
}

// GetPool returns the database pool for matchers
func (r *MatcherRegistry) GetPool() *pgxpool.Pool {
	return r.pool
}

// GetAllMatchers returns all registered matchers
func (r *MatcherRegistry) GetAllMatchers() []ServiceMatcher {
	return r.matchers
}


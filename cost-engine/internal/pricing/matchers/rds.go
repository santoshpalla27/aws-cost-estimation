// Package matchers provides service-specific pricing matchers
package matchers

import (
	"context"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/santoshpalla27/aws-cost-estimation/cost-engine/internal/types"
)

// RDSMatcher handles aws_db_instance resources
type RDSMatcher struct {
	pool *pgxpool.Pool
}

// NewRDSMatcher creates an RDS matcher
func NewRDSMatcher(pool *pgxpool.Pool) *RDSMatcher {
	return &RDSMatcher{pool: pool}
}

// ServiceName returns the AWS service code
func (m *RDSMatcher) ServiceName() string {
	return "AmazonRDS"
}

// Supports returns true for aws_db_instance resources
func (m *RDSMatcher) Supports(resourceType string) bool {
	return resourceType == "aws_db_instance" || resourceType == "aws_rds_cluster"
}

// Match generates usage vectors for an RDS instance
func (m *RDSMatcher) Match(ctx context.Context, resource types.TerraformResource, region string) ([]types.UsageVector, error) {
	vectors := []types.UsageVector{}

	// Get instance class
	instanceClass := "db.t3.medium" // default
	if ic, ok := resource.Config["instance_class"].(string); ok {
		instanceClass = ic
	}

	// Get engine
	engine := "postgres" // default
	if e, ok := resource.Config["engine"].(string); ok {
		engine = e
	}

	// Map engine to pricing dimension
	dbEngine := mapRDSEngine(engine)

	// Multi-AZ?
	multiAZ := false
	if maz, ok := resource.Config["multi_az"].(bool); ok {
		multiAZ = maz
	}

	// Compute hours (730 hours/month, double if multi-AZ)
	hours := 730.0
	if multiAZ {
		hours *= 2
	}

	vectors = append(vectors, types.UsageVector{
		Service:   "AmazonRDS",
		Region:    region,
		UsageType: "InstanceUsage:" + instanceClass,
		Unit:      "Hrs",
		Quantity:  hours,
		Attributes: map[string]string{
			"instanceType":   instanceClass,
			"databaseEngine": dbEngine,
			"deploymentOption": func() string {
				if multiAZ {
					return "Multi-AZ"
				}
				return "Single-AZ"
			}(),
		},
	})

	// Storage (default 20GB gp2)
	storageSize := 20.0
	if size, ok := resource.Config["allocated_storage"].(float64); ok {
		storageSize = size
	} else if size, ok := resource.Config["allocated_storage"].(int64); ok {
		storageSize = float64(size)
	}

	storageType := "gp2"
	if st, ok := resource.Config["storage_type"].(string); ok {
		storageType = st
	}

	vectors = append(vectors, types.UsageVector{
		Service:   "AmazonRDS",
		Region:    region,
		UsageType: "RDS:StorageUsage." + storageType,
		Unit:      "GB-Mo",
		Quantity:  storageSize,
	})

	// Backup storage (assume 1x storage size)
	vectors = append(vectors, types.UsageVector{
		Service:   "AmazonRDS",
		Region:    region,
		UsageType: "RDS:ChargedBackupUsage",
		Unit:      "GB-Mo",
		Quantity:  storageSize,
	})

	return vectors, nil
}

// mapRDSEngine maps Terraform engine names to AWS pricing engine names
func mapRDSEngine(engine string) string {
	engine = strings.ToLower(engine)
	switch {
	case strings.Contains(engine, "postgres"):
		return "PostgreSQL"
	case strings.Contains(engine, "mysql"):
		return "MySQL"
	case strings.Contains(engine, "mariadb"):
		return "MariaDB"
	case strings.Contains(engine, "oracle"):
		return "Oracle"
	case strings.Contains(engine, "sqlserver") || strings.Contains(engine, "sql-server"):
		return "SQL Server"
	case strings.Contains(engine, "aurora"):
		return "Aurora"
	default:
		return engine
	}
}

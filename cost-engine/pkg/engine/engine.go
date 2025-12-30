package engine

import (
	"fmt"

	"github.com/aws-cost-estimation/cost-engine/pkg/adapters"
	"github.com/aws-cost-estimation/cost-engine/pkg/config"
	"github.com/aws-cost-estimation/cost-engine/pkg/database"
	"github.com/aws-cost-estimation/cost-engine/pkg/mocker"
	"github.com/aws-cost-estimation/cost-engine/pkg/pricing"
	"github.com/aws-cost-estimation/cost-engine/pkg/terraform"
	"github.com/aws-cost-estimation/cost-engine/pkg/types"
	"github.com/google/uuid"
	log "github.com/sirupsen/logrus"
)

// Engine orchestrates the full cost estimation pipeline
type Engine struct {
	db              *database.DB
	terraformLoader *terraform.Loader
	mocker          *mocker.Mocker
	adapterRegistry *adapters.Registry
	pricingEngine   *pricing.Engine
}

func New(cfg *config.Config) (*Engine, error) {
	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	return &Engine{
		db:              db,
		terraformLoader: terraform.NewLoader(),
		mocker:          mocker.New(),
		adapterRegistry: adapters.NewRegistry(),
		pricingEngine:   pricing.NewEngine(db),
	}, nil
}

func (e *Engine) Close() error {
	return e.db.Close()
}

// EstimateFromDirectory runs full estimation pipeline from Terraform directory
func (e *Engine) EstimateFromDirectory(dir string) (*EstimateResult, error) {
	log.Info("Starting estimation from directory")

	// Stage 1: Load Terraform
	resources, inputHash, err := e.terraformLoader.LoadFromDirectory(dir)
	if err != nil {
		return nil, fmt.Errorf("terraform loading failed: %w", err)
	}

	return e.estimate(resources, inputHash)
}

// EstimateFromPlan runs full estimation pipeline from Terraform plan JSON
func (e *Engine) EstimateFromPlan(planFile string) (*EstimateResult, error) {
	log.Info("Starting estimation from plan")

	// Stage 1: Load Terraform
	resources, inputHash, err := e.terraformLoader.LoadFromPlan(planFile)
	if err != nil {
		return nil, fmt.Errorf("terraform loading failed: %w", err)
	}

	return e.estimate(resources, inputHash)
}

func (e *Engine) estimate(resources []types.Resource, inputHash string) (*EstimateResult, error) {
	// Stage 2: Smart Mocking
	log.Info("Processing resources with smart mocker")
	mockedResources := e.mocker.ProcessResources(resources)

	// Stage 3: Extract Usage Vectors
	log.Info("Extracting usage vectors")
	usageVectors, err := e.adapterRegistry.ExtractAll(mockedResources)
	if err != nil {
		return nil, fmt.Errorf("usage extraction failed: %w", err)
	}

	log.WithField("vectors", len(usageVectors)).Info("Extracted usage vectors")

	// Stage 4: Calculate Costs
	log.Info("Calculating costs")
	costItems, err := e.pricingEngine.CalculateCost(usageVectors)
	if err != nil {
		return nil, fmt.Errorf("cost calculation failed: %w", err)
	}

	// Stage 6: Aggregate and determine confidence
	totalCost := 0.0
	serviceBreakdown := make(map[string]float64)
	var assumptions []string

	for _, item := range costItems {
		totalCost += item.TotalCost
		serviceBreakdown[item.Service] += item.TotalCost

		// Collect assumptions from metadata
		for _, resource := range mockedResources {
			if resource.Address == item.ResourceAddress {
				for _, mock := range resource.MockMetadata {
					assumptions = append(assumptions, fmt.Sprintf("%s: %s", resource.Address, mock.Reason))
				}
			}
		}
	}

	// Determine overall confidence (lowest from all items)
	overallConfidence := types.ConfidenceHigh
	for _, item := range costItems {
		if item.Confidence == types.ConfidenceLow {
			overallConfidence = types.ConfidenceLow
			break
		}
		if item.Confidence == types.ConfidenceMedium && overallConfidence == types.ConfidenceHigh {
			overallConfidence = types.ConfidenceMedium
		}
	}

	// Create estimate
	estimate := types.Estimate{
		ID:               uuid.New().String(),
		InputHash:        inputHash,
		CatalogVersion:   "latest", // TODO: Get actual version from DB
		Resources:        mockedResources,
		CostItems:        costItems,
		ServiceBreakdown: serviceBreakdown,
		TotalCost:        totalCost,
		Currency:         "USD",
		Confidence:       overallConfidence,
		Assumptions:      assumptions,
	}

	return &EstimateResult{
		Estimate: estimate,
	}, nil
}

// Diff calculates cost delta between two estimates
func (e *Engine) Diff(before, after *EstimateResult) *DiffResult {
	delta := after.Estimate.TotalCost - before.Estimate.TotalCost

	return &DiffResult{
		BeforeTotal: before.Estimate.TotalCost,
		AfterTotal:  after.Estimate.TotalCost,
		Delta:       delta,
	}
}

// EstimateResult wraps estimate with output methods
type EstimateResult struct {
	Estimate types.Estimate
}

// DiffResult represents cost comparison
type DiffResult struct {
	BeforeTotal float64
	AfterTotal  float64
	Delta       float64
}

package commands

import (
	"fmt"

	"github.com/aws-cost-estimation/cost-engine/pkg/config"
	"github.com/aws-cost-estimation/cost-engine/pkg/engine"
	"github.com/spf13/cobra"
	log "github.com/sirupsen/logrus"
)

var (
	terraformDir  string
	terraformPlan string
	outputFormat  string
	catalogVersion string
)

var estimateCmd = &cobra.Command{
	Use:   "estimate",
	Short: "Estimate AWS costs from Terraform configuration",
	Long: `Analyze Terraform configuration or plan and produce detailed cost estimates.
	
Examples:
  # Estimate from Terraform directory
  cost-engine estimate --dir ./terraform

  # Estimate from Terraform plan JSON
  cost-engine estimate --plan plan.json

  # Specify output format
  cost-engine estimate --dir ./terraform --format json`,
	RunE: runEstimate,
}

func init() {
	estimateCmd.Flags().StringVar(&terraformDir, "dir", "", "Path to Terraform directory")
	estimateCmd.Flags().StringVar(&terraformPlan, "plan", "", "Path to Terraform plan JSON file")
	estimateCmd.Flags().StringVar(&outputFormat, "format", "cli", "Output format (cli, json)")
	estimateCmd.Flags().StringVar(&catalogVersion, "catalog-version", "", "Specific pricing catalog version to use")
}

func runEstimate(cmd *cobra.Command, args []string) error {
	if terraformDir == "" && terraformPlan == "" {
		return fmt.Errorf("either --dir or --plan must be specified")
	}

	log.Info("Starting cost estimation")

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("failed to load configuration: %w", err)
	}

	// Create estimation engine
	eng, err := engine.New(cfg)
	if err != nil {
		return fmt.Errorf("failed to initialize engine: %w", err)
	}
	defer eng.Close()

	// Run estimation
	var result *engine.EstimateResult
	if terraformDir != "" {
		result, err = eng.EstimateFromDirectory(terraformDir)
	} else {
		result, err = eng.EstimateFromPlan(terraformPlan)
	}

	if err != nil {
		return fmt.Errorf("estimation failed: %w", err)
	}

	// Output results
	switch outputFormat {
	case "json":
		return result.OutputJSON()
	case "cli":
		return result.OutputCLI()
	default:
		return fmt.Errorf("unsupported output format: %s", outputFormat)
	}
}

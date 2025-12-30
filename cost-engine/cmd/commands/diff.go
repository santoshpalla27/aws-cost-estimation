package commands

import (
	"fmt"

	"github.com/aws-cost-estimation/cost-engine/pkg/config"
	"github.com/aws-cost-estimation/cost-engine/pkg/engine"
	"github.com/spf13/cobra"
	log "github.com/sirupsen/logrus"
)

var (
	beforeDir  string
	beforePlan string
	afterDir   string
	afterPlan  string
)

var diffCmd = &cobra.Command{
	Use:   "diff",
	Short: "Compare cost difference between two Terraform states",
	Long: `Calculate the cost delta between before and after Terraform configurations.

Examples:
  # Diff two directories
  cost-engine diff --before ./terraform-old --after ./terraform-new

  # Diff two plan files
  cost-engine diff --before-plan old.json --after-plan new.json`,
	RunE: runDiff,
}

func init() {
	diffCmd.Flags().StringVar(&beforeDir, "before", "", "Path to before Terraform directory")
	diffCmd.Flags().StringVar(&beforePlan, "before-plan", "", "Path to before Terraform plan JSON")
	diffCmd.Flags().StringVar(&afterDir, "after", "", "Path to after Terraform directory")
	diffCmd.Flags().StringVar(&afterPlan, "after-plan", "", "Path to after Terraform plan JSON")
}

func runDiff(cmd *cobra.Command, args []string) error {
	if (beforeDir == "" && beforePlan == "") || (afterDir == "" && afterPlan == "") {
		return fmt.Errorf("both before and after configurations must be specified")
	}

	log.Info("Starting cost diff calculation")

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("failed to load configuration: %w", err)
	}

	// Create engine
	eng, err := engine.New(cfg)
	if err != nil {
		return fmt.Errorf("failed to initialize engine: %w", err)
	}
	defer eng.Close()

	// Calculate before costs
	var beforeResult *engine.EstimateResult
	if beforeDir != "" {
		beforeResult, err = eng.EstimateFromDirectory(beforeDir)
	} else {
		beforeResult, err = eng.EstimateFromPlan(beforePlan)
	}
	if err != nil {
		return fmt.Errorf("failed to estimate before state: %w", err)
	}

	// Calculate after costs
	var afterResult *engine.EstimateResult
	if afterDir != "" {
		afterResult, err = eng.EstimateFromDirectory(afterDir)
	} else {
		afterResult, err = eng.EstimateFromPlan(afterPlan)
	}
	if err != nil {
		return fmt.Errorf("failed to estimate after state: %w", err)
	}

	// Generate diff
	diff := eng.Diff(beforeResult, afterResult)
	return diff.OutputCLI()
}

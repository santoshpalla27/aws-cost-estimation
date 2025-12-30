package commands

import (
	"fmt"
	"os"

	"github.com/aws-cost-estimation/cost-engine/pkg/config"
	"github.com/aws-cost-estimation/cost-engine/pkg/engine"
	"github.com/aws-cost-estimation/cost-engine/pkg/policy"
	"github.com/spf13/cobra"
	log "github.com/sirupsen/logrus"
)

var (
	policyFile string
	failOnViolation bool
)

var policyCmd = &cobra.Command{
	Use:   "policy",
	Short: "Evaluate cost estimate against policies",
	Long: `Evaluate a cost estimate against defined budget and resource policies.
	
Policies can enforce:
- Service budget caps
- Total budget limits
- Resource count restrictions
- Cost growth thresholds

Example policy.json:
{
  "policies": [
    {
      "name": "EC2 Budget",
      "type": "SERVICE_BUDGET",
      "service": "AmazonEC2",
      "max_cost": 1000.00,
      "warn_threshold": 800.00
    },
    {
      "name": "Total Budget",
      "type": "TOTAL_BUDGET",
      "max_cost": 5000.00
    }
  ]
}`,
	RunE: runPolicy,
}

func init() {
	policyCmd.Flags().StringVar(&terraformDir, "dir", "", "Path to Terraform directory")
	policyCmd.Flags().StringVar(&terraformPlan, "plan", "", "Path to Terraform plan JSON file")
	policyCmd.Flags().StringVar(&policyFile, "policy-file", "policy.json", "Path to policy definition file")
	policyCmd.Flags().BoolVar(&failOnViolation, "fail-on-violation", true, "Exit with error code 1 on policy failure")
	policyCmd.Flags().StringVar(&outputFormat, "format", "cli", "Output format (cli, json, ci)")
}

func runPolicy(cmd *cobra.Command, args []string) error {
	if terraformDir == "" && terraformPlan == "" {
		return fmt.Errorf("either --dir or --plan must be specified")
	}

	log.Info("Starting policy evaluation")

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

	// Load policies
	policies, err := loadPolicies(policyFile)
	if err != nil {
		return fmt.Errorf("failed to load policies: %w", err)
	}

	// Evaluate policies
	policyEngine := policy.New()
	policyEngine.LoadPolicies(policies)
	policyResults := policyEngine.Evaluate(&result.Estimate)

	// Output results
	if err := outputPolicyResults(policyResults, &result.Estimate); err != nil {
		return err
	}

	// Check for failures
	if failOnViolation && policyEngine.HasFailures(policyResults) {
		log.Error("Policy evaluation failed - exiting with error code 1")
		os.Exit(1)
	}

	return nil
}

func loadPolicies(filename string) ([]policy.Policy, error) {
	// For now, return example policies
	// In production, this would parse JSON/YAML file
	return []policy.Policy{
		policy.NewServiceBudgetPolicy("EC2 Budget", "AmazonEC2", 1000.00, 800.00),
		policy.NewTotalBudgetPolicy("Total Budget", 5000.00, 4000.00),
		policy.NewResourceCountPolicy("EC2 Instance Limit", "aws_instance", 10),
	}, nil
}

func outputPolicyResults(results []policy.PolicyResult, estimate *types.Estimate) error {
	fmt.Println("\n╔════════════════════════════════════════════════════════════╗")
	fmt.Println("║           POLICY EVALUATION RESULTS                        ║")
	fmt.Println("╚════════════════════════════════════════════════════════════╝")

	fmt.Printf("\nTotal Cost: $%.2f/mo\n\n", estimate.TotalCost)

	passCount := 0
	warnCount := 0
	failCount := 0

	for _, result := range results {
		var symbol string
		switch result.Outcome {
		case types.PolicyPass:
			symbol = "✓"
			passCount++
		case types.PolicyWarn:
			symbol = "⚠"
			warnCount++
		case types.PolicyFail:
			symbol = "✗"
			failCount++
		}

		fmt.Printf("%s %s: %s\n", symbol, result.PolicyName, result.Message)
	}

	fmt.Printf("\nSummary: %d passed, %d warnings, %d failed\n\n", passCount, warnCount, failCount)

	if failCount > 0 {
		fmt.Println("❌ POLICY EVALUATION FAILED")
	} else if warnCount > 0 {
		fmt.Println("⚠️  POLICY EVALUATION PASSED WITH WARNINGS")
	} else {
		fmt.Println("✅ POLICY EVALUATION PASSED")
	}

	return nil
}

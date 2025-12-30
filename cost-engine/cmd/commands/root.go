package commands

import (
	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "cost-engine",
	Short: "AWS Cost Estimation Engine - Brain 2",
	Long: `Production-grade Terraform-aware AWS cost estimation engine.
Interprets Terraform configurations and produces accurate, explainable cost estimates.`,
}

func Execute() error {
	return rootCmd.Execute()
}

func init() {
	// Add subcommands
	rootCmd.AddCommand(estimateCmd)
	rootCmd.AddCommand(diffCmd)
	rootCmd.AddCommand(explainCmd)
	rootCmd.AddCommand(policyCmd)
	rootCmd.AddCommand(healthCmd)
}

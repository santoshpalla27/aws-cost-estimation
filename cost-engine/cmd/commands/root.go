package commands

import (
	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "cost-engine",
	Short: "AWS cost estimation engine",
	Long:  `Production-grade AWS cost estimation from Terraform configurations`,
}

func Execute() error {
	return rootCmd.Execute()
}

func init() {
	// Register subcommands
	rootCmd.AddCommand(estimateCmd)
	rootCmd.AddCommand(diffCmd)
	rootCmd.AddCommand(explainCmd)
	rootCmd.AddCommand(healthCmd)
	rootCmd.AddCommand(policyCmd)
	rootCmd.AddCommand(serverCmd) // HTTP API server
}

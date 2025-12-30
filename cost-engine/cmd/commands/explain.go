package commands

import (
	"github.com/spf13/cobra"
)

var explainCmd = &cobra.Command{
	Use:   "explain [resource_address]",
	Short: "Explain cost calculation for a specific resource",
	Long:  `Provide detailed breakdown of how a resource's cost was calculated.`,
	Args:  cobra.ExactArgs(1),
	RunE:  runExplain,
}

func runExplain(cmd *cobra.Command, args []string) error {
	// TODO: Implement after Stage 7
	return nil
}

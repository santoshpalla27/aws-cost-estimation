package engine

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/aws-cost-estimation/cost-engine/pkg/types"
)

// OutputJSON writes estimate as JSON
func (r *EstimateResult) OutputJSON() error {
	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	return encoder.Encode(r.Estimate)
}

// OutputCLI writes human-readable estimate to stdout
func (r *EstimateResult) OutputCLI() error {
	fmt.Println("\n╔════════════════════════════════════════════════════════════╗")
	fmt.Println("║           AWS COST ESTIMATION REPORT                       ║")
	fmt.Println("╚════════════════════════════════════════════════════════════╝")

	fmt.Printf("\nEstimate ID: %s\n", r.Estimate.ID)
	fmt.Printf("Input Hash:  %s\n", r.Estimate.InputHash)
	fmt.Printf("Catalog:     %s\n", r.Estimate.CatalogVersion)
	fmt.Printf("Confidence:  %s\n", confidenceSymbol(r.Estimate.Confidence))

	fmt.Println("\n┌─────────────────────────────────────────────────────────────┐")
	fmt.Println("│ COST BREAKDOWN BY SERVICE                                   │")
	fmt.Println("└─────────────────────────────────────────────────────────────┘")

	for service, cost := range r.Estimate.ServiceBreakdown {
		fmt.Printf("  %-30s  $%10.2f/mo\n", service, cost)
	}

	fmt.Println("\n┌─────────────────────────────────────────────────────────────┐")
	fmt.Println("│ DETAILED COST ITEMS                                         │")
	fmt.Println("└─────────────────────────────────────────────────────────────┘")

	for _, item := range r.Estimate.CostItems {
		fmt.Printf("\n  Resource: %s\n", item.ResourceAddress)
		fmt.Printf("  %s\n", item.Explanation)
		fmt.Printf("  Confidence: %s  Match: %s\n",
			confidenceSymbol(item.Confidence),
			item.MatchType)
	}

	if len(r.Estimate.Assumptions) > 0 {
		fmt.Println("\n┌─────────────────────────────────────────────────────────────┐")
		fmt.Println("│ ASSUMPTIONS                                                 │")
		fmt.Println("└─────────────────────────────────────────────────────────────┘")
		for _, assumption := range r.Estimate.Assumptions {
			fmt.Printf("  ⚠  %s\n", assumption)
		}
	}

	fmt.Println("\n╔════════════════════════════════════════════════════════════╗")
	fmt.Printf("║  TOTAL ESTIMATED COST:  $%-10.2f USD/month            ║\n", r.Estimate.TotalCost)
	fmt.Println("╚════════════════════════════════════════════════════════════╝\n")

	return nil
}

// OutputCLI for diff results
func (r *DiffResult) OutputCLI() error {
	fmt.Println("\n╔════════════════════════════════════════════════════════════╗")
	fmt.Println("║           COST DIFFERENCE REPORT                           ║")
	fmt.Println("╚════════════════════════════════════════════════════════════╝")

	fmt.Printf("\nBefore:  $%.2f/mo\n", r.BeforeTotal)
	fmt.Printf("After:   $%.2f/mo\n", r.AfterTotal)

	deltaSymbol := "↑"
	if r.Delta < 0 {
		deltaSymbol = "↓"
	}
	fmt.Printf("Delta:   %s $%.2f/mo (%.1f%%)\n",
		deltaSymbol,
		r.Delta,
		(r.Delta/r.BeforeTotal)*100)

	fmt.Println()
	return nil
}

func confidenceSymbol(c types.ConfidenceLevel) string {
	switch c {
	case types.ConfidenceHigh:
		return "✓ HIGH"
	case types.ConfidenceMedium:
		return "● MEDIUM"
	case types.ConfidenceLow:
		return "⚠ LOW"
	default:
		return "?"
	}
}

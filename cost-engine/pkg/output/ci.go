package output

import (
	"fmt"
	"strings"

	"github.com/aws-cost-estimation/cost-engine/pkg/diff"
	"github.com/aws-cost-estimation/cost-engine/pkg/types"
)

// CIAnnotator generates CI-friendly output formats
type CIAnnotator struct {
	ciType string // "github", "gitlab", "generic"
}

func NewCIAnnotator(ciType string) *CIAnnotator {
	return &CIAnnotator{
		ciType: ciType,
	}
}

// AnnotateEstimate generates CI annotations for estimate
func (ca *CIAnnotator) AnnotateEstimate(estimate *types.Estimate, policyResults []types.PolicyResult) string {
	switch ca.ciType {
	case "github":
		return ca.githubAnnotations(estimate, policyResults)
	case "gitlab":
		return ca.gitlabAnnotations(estimate, policyResults)
	default:
		return ca.genericAnnotations(estimate, policyResults)
	}
}

// AnnotateDiff generates CI annotations for cost diff
func (ca *CIAnnotator) AnnotateDiff(diff *diff.DetailedDiff) string {
	switch ca.ciType {
	case "github":
		return ca.githubDiffAnnotations(diff)
	case "gitlab":
		return ca.gitlabDiffAnnotations(diff)
	default:
		return ca.genericDiffAnnotations(diff)
	}
}

// GitHub Actions format
func (ca *CIAnnotator) githubAnnotations(estimate *types.Estimate, policyResults []types.PolicyResult) string {
	var output strings.Builder

	// Summary
	output.WriteString(fmt.Sprintf("::notice title=Cost Estimate::Total: $%.2f/mo (Confidence: %s)\n",
		estimate.TotalCost, estimate.Confidence))

	// Policy violations
	for _, result := range policyResults {
		switch result.Outcome {
		case types.PolicyFail:
			output.WriteString(fmt.Sprintf("::error title=Policy Violation::%s: %s\n",
				result.PolicyName, result.Message))
		case types.PolicyWarn:
			output.WriteString(fmt.Sprintf("::warning title=Policy Warning::%s: %s\n",
				result.PolicyName, result.Message))
		}
	}

	// Service breakdown
	for service, cost := range estimate.ServiceBreakdown {
		output.WriteString(fmt.Sprintf("::notice title=Service Cost::%s: $%.2f/mo\n",
			service, cost))
	}

	// Assumptions
	if len(estimate.Assumptions) > 0 {
		output.WriteString(fmt.Sprintf("::warning title=Assumptions::%d assumptions made - review for accuracy\n",
			len(estimate.Assumptions)))
	}

	return output.String()
}

func (ca *CIAnnotator) githubDiffAnnotations(diff *diff.DetailedDiff) string {
	var output strings.Builder

	deltaSymbol := "📈"
	deltaType := "increased"
	if diff.TotalDelta < 0 {
		deltaSymbol = "📉"
		deltaType = "decreased"
	}

	output.WriteString(fmt.Sprintf("::notice title=Cost Change::%s Cost %s by $%.2f/mo (%.1f%%)\n",
		deltaSymbol, deltaType, abs(diff.TotalDelta), abs(diff.PercentChange)))

	// Added resources
	if len(diff.AddedResources) > 0 {
		output.WriteString(fmt.Sprintf("::notice title=Resources Added::%d resources added (+$%.2f/mo)\n",
			len(diff.AddedResources), diff.AddedCost))
	}

	// Removed resources
	if len(diff.RemovedResources) > 0 {
		output.WriteString(fmt.Sprintf("::notice title=Resources Removed::%d resources removed (-$%.2f/mo)\n",
			len(diff.RemovedResources), abs(diff.RemovedCost)))
	}

	// Modified resources with significant changes
	for _, change := range diff.ModifiedResources {
		if abs(change.Delta) > 1.0 { // Only show changes > $1
			output.WriteString(fmt.Sprintf("::notice title=Resource Modified::%s: $%.2f → $%.2f (Δ $%.2f)\n",
				change.Address, change.OldCost, change.Cost, change.Delta))
		}
	}

	return output.String()
}

// GitLab CI format
func (ca *CIAnnotator) gitlabAnnotations(estimate *types.Estimate, policyResults []types.PolicyResult) string {
	// GitLab uses markdown in merge request comments
	return ca.markdownTable(estimate, policyResults)
}

func (ca *CIAnnotator) gitlabDiffAnnotations(diff *diff.DetailedDiff) string {
	return ca.markdownDiffTable(diff)
}

// Generic markdown format (works for most CI systems)
func (ca *CIAnnotator) genericAnnotations(estimate *types.Estimate, policyResults []types.PolicyResult) string {
	return ca.markdownTable(estimate, policyResults)
}

func (ca *CIAnnotator) genericDiffAnnotations(diff *diff.DetailedDiff) string {
	return ca.markdownDiffTable(diff)
}

// Markdown table generators

func (ca *CIAnnotator) markdownTable(estimate *types.Estimate, policyResults []types.PolicyResult) string {
	var output strings.Builder

	output.WriteString("## 💰 AWS Cost Estimate\n\n")
	
	// Summary
	output.WriteString(fmt.Sprintf("**Total Cost:** $%.2f/mo  \n", estimate.TotalCost))
	output.WriteString(fmt.Sprintf("**Confidence:** %s  \n", confidenceEmoji(estimate.Confidence)))
	output.WriteString(fmt.Sprintf("**Resources:** %d  \n\n", len(estimate.Resources)))

	// Service breakdown
	output.WriteString("### Service Breakdown\n\n")
	output.WriteString("| Service | Monthly Cost |\n")
	output.WriteString("|---------|-------------:|\n")
	for service, cost := range estimate.ServiceBreakdown {
		output.WriteString(fmt.Sprintf("| %s | $%.2f |\n", service, cost))
	}
	output.WriteString("\n")

	// Policy results
	if len(policyResults) > 0 {
		output.WriteString("### Policy Evaluation\n\n")
		output.WriteString("| Policy | Status | Message |\n")
		output.WriteString("|--------|--------|----------|\n")
		for _, result := range policyResults {
			emoji := policyEmoji(result.Outcome)
			output.WriteString(fmt.Sprintf("| %s | %s %s | %s |\n",
				result.PolicyName, emoji, result.Outcome, result.Message))
		}
		output.WriteString("\n")
	}

	// Assumptions
	if len(estimate.Assumptions) > 0 {
		output.WriteString("### ⚠️ Assumptions\n\n")
		for _, assumption := range estimate.Assumptions {
			output.WriteString(fmt.Sprintf("- %s\n", assumption))
		}
		output.WriteString("\n")
	}

	return output.String()
}

func (ca *CIAnnotator) markdownDiffTable(diff *diff.DetailedDiff) string {
	var output strings.Builder

	output.WriteString("## 📊 Cost Change Analysis\n\n")

	// Summary
	deltaSymbol := "📈"
	if diff.TotalDelta < 0 {
		deltaSymbol = "📉"
	}
	
	output.WriteString(fmt.Sprintf("%s **Total Change:** $%.2f → $%.2f (Δ $%.2f, %.1f%%)  \n\n",
		deltaSymbol, diff.BeforeTotal, diff.AfterTotal, diff.TotalDelta, diff.PercentChange))

	// Resource changes
	if len(diff.AddedResources) > 0 || len(diff.RemovedResources) > 0 || len(diff.ModifiedResources) > 0 {
		output.WriteString("### Resource Changes\n\n")
		output.WriteString("| Change | Resource | Cost Impact |\n")
		output.WriteString("|--------|----------|------------:|\n")

		for _, res := range diff.AddedResources {
			output.WriteString(fmt.Sprintf("| ➕ Added | %s | +$%.2f |\n", res.Address, res.Cost))
		}
		for _, res := range diff.RemovedResources {
			output.WriteString(fmt.Sprintf("| ➖ Removed | %s | -$%.2f |\n", res.Address, res.Cost))
		}
		for _, res := range diff.ModifiedResources {
			if abs(res.Delta) > 0.01 {
				output.WriteString(fmt.Sprintf("| 📝 Modified | %s | $%.2f |\n", res.Address, res.Delta))
			}
		}
		output.WriteString("\n")
	}

	// Service deltas
	if len(diff.ServiceDeltas) > 0 {
		output.WriteString("### Service Breakdown\n\n")
		output.WriteString("| Service | Before | After | Change |\n")
		output.WriteString("|---------|-------:|------:|-------:|\n")
		
		for _, delta := range diff.ServiceDeltas {
			if abs(delta.Delta) > 0.01 {
				output.WriteString(fmt.Sprintf("| %s | $%.2f | $%.2f | $%.2f (%.1f%%) |\n",
					delta.Service, delta.BeforeCost, delta.AfterCost, delta.Delta, delta.PercentChange))
			}
		}
		output.WriteString("\n")
	}

	return output.String()
}

// Helper functions

func confidenceEmoji(c types.ConfidenceLevel) string {
	switch c {
	case types.ConfidenceHigh:
		return "✅ HIGH"
	case types.ConfidenceMedium:
		return "🟡 MEDIUM"
	case types.ConfidenceLow:
		return "⚠️ LOW"
	default:
		return "❓ UNKNOWN"
	}
}

func policyEmoji(outcome types.PolicyOutcome) string {
	switch outcome {
	case types.PolicyPass:
		return "✅"
	case types.PolicyWarn:
		return "⚠️"
	case types.PolicyFail:
		return "❌"
	default:
		return "❓"
	}
}

func abs(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}

package audit

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/aws-cost-estimation/cost-engine/pkg/types"
	log "github.com/sirupsen/logrus"
)

// AuditTrail manages comprehensive audit logging
type AuditTrail struct {
	auditDir string
}

func New(auditDir string) *AuditTrail {
	return &AuditTrail{
		auditDir: auditDir,
	}
}

// LogEstimate creates audit record for an estimate
func (at *AuditTrail) LogEstimate(estimate *types.Estimate, metadata AuditMetadata) error {
	record := AuditRecord{
		Timestamp:      time.Now(),
		EstimateID:     estimate.ID,
		InputHash:      estimate.InputHash,
		CatalogVersion: estimate.CatalogVersion,
		TotalCost:      estimate.TotalCost,
		Currency:       estimate.Currency,
		Confidence:     estimate.Confidence,
		ResourceCount:  len(estimate.Resources),
		CostItemCount:  len(estimate.CostItems),
		Assumptions:    estimate.Assumptions,
		Metadata:       metadata,
	}

	// Add service breakdown
	record.ServiceBreakdown = estimate.ServiceBreakdown

	// Count confidence levels
	record.ConfidenceSummary = at.summarizeConfidence(estimate.CostItems)

	// Write to audit log
	return at.writeAuditRecord(record)
}

func (at *AuditTrail) writeAuditRecord(record AuditRecord) error {
	// Ensure audit directory exists
	if err := os.MkdirAll(at.auditDir, 0755); err != nil {
		return fmt.Errorf("failed to create audit directory: %w", err)
	}

	// Create filename with timestamp
	filename := fmt.Sprintf("estimate_%s_%s.json",
		record.EstimateID,
		record.Timestamp.Format("20060102_150405"),
	)
	filepath := filepath.Join(at.auditDir, filename)

	// Write JSON
	file, err := os.Create(filepath)
	if err != nil {
		return fmt.Errorf("failed to create audit file: %w", err)
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(record); err != nil {
		return fmt.Errorf("failed to write audit record: %w", err)
	}

	log.WithField("file", filepath).Info("Audit record written")
	return nil
}

func (at *AuditTrail) summarizeConfidence(items []types.CostItem) ConfidenceSummary {
	summary := ConfidenceSummary{}

	for _, item := range items {
		switch item.Confidence {
		case types.ConfidenceHigh:
			summary.HighCount++
			summary.HighCost += item.TotalCost
		case types.ConfidenceMedium:
			summary.MediumCount++
			summary.MediumCost += item.TotalCost
		case types.ConfidenceLow:
			summary.LowCount++
			summary.LowCost += item.TotalCost
		}
	}

	total := summary.HighCount + summary.MediumCount + summary.LowCount
	if total > 0 {
		summary.HighPercent = float64(summary.HighCount) / float64(total) * 100
		summary.MediumPercent = float64(summary.MediumCount) / float64(total) * 100
		summary.LowPercent = float64(summary.LowCount) / float64(total) * 100
	}

	return summary
}

// VerifyDeterminism checks if two estimates with same input hash match
func (at *AuditTrail) VerifyDeterminism(estimate1, estimate2 *types.Estimate) bool {
	if estimate1.InputHash != estimate2.InputHash {
		return false // Different inputs
	}

	// Same input hash should produce same cost
	return estimate1.TotalCost == estimate2.TotalCost &&
		estimate1.CatalogVersion == estimate2.CatalogVersion
}

// Data structures

type AuditRecord struct {
	Timestamp         time.Time                     `json:"timestamp"`
	EstimateID        string                        `json:"estimate_id"`
	InputHash         string                        `json:"input_hash"`
	CatalogVersion    string                        `json:"catalog_version"`
	TotalCost         float64                       `json:"total_cost"`
	Currency          string                        `json:"currency"`
	Confidence        types.ConfidenceLevel         `json:"confidence"`
	ResourceCount     int                           `json:"resource_count"`
	CostItemCount     int                           `json:"cost_item_count"`
	ServiceBreakdown  map[string]float64            `json:"service_breakdown"`
	Assumptions       []string                      `json:"assumptions"`
	ConfidenceSummary ConfidenceSummary             `json:"confidence_summary"`
	Metadata          AuditMetadata                 `json:"metadata"`
}

type AuditMetadata struct {
	User            string            `json:"user,omitempty"`
	Source          string            `json:"source"` // "cli", "api", "ci"
	Environment     string            `json:"environment,omitempty"`
	GitCommit       string            `json:"git_commit,omitempty"`
	GitBranch       string            `json:"git_branch,omitempty"`
	AdditionalTags  map[string]string `json:"additional_tags,omitempty"`
}

type ConfidenceSummary struct {
	HighCount     int     `json:"high_count"`
	HighCost      float64 `json:"high_cost"`
	HighPercent   float64 `json:"high_percent"`
	MediumCount   int     `json:"medium_count"`
	MediumCost    float64 `json:"medium_cost"`
	MediumPercent float64 `json:"medium_percent"`
	LowCount      int     `json:"low_count"`
	LowCost       float64 `json:"low_cost"`
	LowPercent    float64 `json:"low_percent"`
}

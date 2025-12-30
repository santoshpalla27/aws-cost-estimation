package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"github.com/aws-cost-estimation/cost-engine/pkg/config"
	"github.com/aws-cost-estimation/cost-engine/pkg/engine"
	"github.com/aws-cost-estimation/cost-engine/pkg/policy"
	"github.com/aws-cost-estimation/cost-engine/pkg/types"
	log "github.com/sirupsen/logrus"
)

// PolicyHandler handles policy evaluation requests
type PolicyHandler struct {
	config *config.Config
}

// NewPolicyHandler creates a new policy handler
func NewPolicyHandler(cfg *config.Config) *PolicyHandler {
	return &PolicyHandler{config: cfg}
}

// PolicyResponse represents the API response for policy evaluation
type PolicyResponse struct {
	Results      []types.PolicyResult `json:"results"`
	HasViolations bool                `json:"has_violations"`
	HasWarnings   bool                `json:"has_warnings"`
}

// Handle processes the policy request
func (h *PolicyHandler) Handle(w http.ResponseWriter, r *http.Request) {
	// Parse multipart form
	if err := r.ParseMultipartForm(100 << 20); err != nil {
		WriteBadRequest(w, fmt.Sprintf("Failed to parse form: %v", err))
		return
	}

	// Get project ZIP
	projectFile, _, err := r.FormFile("project_zip")
	if err != nil {
		WriteBadRequest(w, "Missing project_zip file")
		return
	}
	defer projectFile.Close()

	// Get policy JSON
	policyFile, _, err := r.FormFile("policy_file")
	if err != nil {
		WriteBadRequest(w, "Missing policy_file")
		return
	}
	defer policyFile.Close()

	log.Info("Processing policy evaluation request")

	// Create temp directory
	tempDir, err := os.MkdirTemp("", "terraform-policy-*")
	if err != nil {
		WriteInternalError(w, fmt.Sprintf("Failed to create temp directory: %v", err))
		return
	}
	defer os.RemoveAll(tempDir)

	// Process project ZIP
	zipPath := filepath.Join(tempDir, "project.zip")
	projectDir := filepath.Join(tempDir, "project")

	if err := saveAndUnzip(projectFile, zipPath, projectDir); err != nil {
		WriteInternalError(w, fmt.Sprintf("Failed to process project ZIP: %v", err))
		return
	}

	// Save policy file
	policyPath := filepath.Join(tempDir, "policy.json")
	policyFileHandle, err := os.Create(policyPath)
	if err != nil {
		WriteInternalError(w, fmt.Sprintf("Failed to create policy file: %v", err))
		return
	}

	if _, err := io.Copy(policyFileHandle, policyFile); err != nil {
		policyFileHandle.Close()
		WriteInternalError(w, fmt.Sprintf("Failed to save policy file: %v", err))
		return
	}
	policyFileHandle.Close()

	// Create engine and get estimate
	eng, err := engine.New(h.config)
	if err != nil {
		WriteInternalError(w, fmt.Sprintf("Failed to initialize engine: %v", err))
		return
	}
	defer eng.Close()

	estimate, err := eng.EstimateFromDirectory(projectDir)
	if err != nil {
		WriteInternalError(w, fmt.Sprintf("Estimation failed: %v", err))
		return
	}

	// Load and evaluate policies
	policyEngine := policy.New()
	if err := policyEngine.LoadFromFile(policyPath); err != nil {
		WriteInternalError(w, fmt.Sprintf("Failed to load policies: %v", err))
		return
	}

	results := policyEngine.Evaluate(&estimate.Estimate)

	// Check for violations and warnings
	hasViolations := false
	hasWarnings := false

	for _, result := range results {
		if result.Outcome == types.PolicyFail {
			hasViolations = true
		}
		if result.Outcome == types.PolicyWarn {
			hasWarnings = true
		}
	}

	log.WithFields(log.Fields{
		"policies":      len(results),
		"violations":    hasViolations,
		"warnings":      hasWarnings,
	}).Info("Policy evaluation completed")

	// Return response
	response := PolicyResponse{
		Results:       results,
		HasViolations: hasViolations,
		HasWarnings:   hasWarnings,
	}

	WriteJSON(w, http.StatusOK, response)
}

func saveAndUnzip(file io.Reader, zipPath, destDir string) error {
	// Save ZIP
	zipFile, err := os.Create(zipPath)
	if err != nil {
		return err
	}

	if _, err := io.Copy(zipFile, file); err != nil {
		zipFile.Close()
		return err
	}
	zipFile.Close()

	// Unzip
	if err := os.MkdirAll(destDir, 0755); err != nil {
		return err
	}

	return UnzipFile(zipPath, destDir)
}

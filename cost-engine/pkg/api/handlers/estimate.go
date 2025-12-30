package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"github.com/aws-cost-estimation/cost-engine/pkg/config"
	"github.com/aws-cost-estimation/cost-engine/pkg/engine"
	"github.com/aws-cost-estimation/cost-engine/pkg/types"
	log "github.com/sirupsen/logrus"
)

// EstimateHandler handles cost estimation requests
type EstimateHandler struct {
	config *config.Config
}

// NewEstimateHandler creates a new estimate handler
func NewEstimateHandler(cfg *config.Config) *EstimateHandler {
	return &EstimateHandler{config: cfg}
}

// EstimateResponse represents the API response for estimates
type EstimateResponse struct{
	Estimate types.Estimate `json:"estimate"`
}

// Handle processes the estimate request
func (h *EstimateHandler) Handle(w http.ResponseWriter, r *http.Request) {
	// Parse multipart form (100MB max)
	if err := r.ParseMultipartForm(100 << 20); err != nil {
		WriteBadRequest(w, fmt.Sprintf("Failed to parse form: %v", err))
		return
	}

	// Get uploaded file
	file, header, err := r.FormFile("project_zip")
	if err != nil {
		WriteBadRequest(w, "Missing project_zip file")
		return
	}
	defer file.Close()

	// Check file size
	if header.Size > MaxZipSize {
		WriteValidationError(w, "ZIP file too large", map[string]interface{}{
			"size_bytes": header.Size,
			"max_bytes":  MaxZipSize,
		})
		return
	}

	// Get evaluation mode (optional, default to CONSERVATIVE)
	evaluationMode := r.FormValue("evaluation_mode")
	if evaluationMode == "" {
		evaluationMode = string(types.EvaluationConservative)
	}

	// Validate evaluation mode
	if !isValidEvaluationMode(evaluationMode) {
		WriteValidationError(w, "Invalid evaluation_mode", map[string]interface{}{
			"provided": evaluationMode,
			"allowed":  []string{"STRICT", "CONSERVATIVE", "OPTIMISTIC"},
		})
		return
	}

	log.WithFields(log.Fields{
		"filename":        header.Filename,
		"size":            header.Size,
		"evaluation_mode": evaluationMode,
	}).Info("Processing estimate request")

	// Create temp directory
	tempDir, err := os.MkdirTemp("", "terraform-estimate-*")
	if err != nil {
		WriteInternalError(w, fmt.Sprintf("Failed to create temp directory: %v", err))
		return
	}
	defer os.RemoveAll(tempDir) // Clean up

	// Save uploaded ZIP
	zipPath := filepath.Join(tempDir, "project.zip")
	zipFile, err := os.Create(zipPath)
	if err != nil {
		WriteInternalError(w, fmt.Sprintf("Failed to create zip file: %v", err))
		return
	}

	if _, err := io.Copy(zipFile, file); err != nil {
		zipFile.Close()
		WriteInternalError(w, fmt.Sprintf("Failed to save zip file: %v", err))
		return
	}
	zipFile.Close()

	// Unzip
	projectDir := filepath.Join(tempDir, "project")
	if err := os.MkdirAll(projectDir, 0755); err != nil {
		WriteInternalError(w, fmt.Sprintf("Failed to create project directory: %v", err))
		return
	}

	if err := UnzipFile(zipPath, projectDir); err != nil {
		WriteValidationError(w, fmt.Sprintf("Failed to unzip file: %v", err), nil)
		return
	}

	// Validate Terraform files exist
	hasTF, err := HasTerraformFiles(projectDir)
	if err != nil {
		WriteInternalError(w, fmt.Sprintf("Failed to validate files: %v", err))
		return
	}

	if !hasTF {
		WriteValidationError(w, "No .tf files found in uploaded ZIP", map[string]interface{}{
			"directory": projectDir,
		})
		return
	}

	// Update config with evaluation mode
	cfg := *h.config
	cfg.EvaluationMode = types.EvaluationMode(evaluationMode)

	// Create engine
	eng, err := engine.New(&cfg)
	if err != nil {
		WriteInternalError(w, fmt.Sprintf("Failed to initialize engine: %v", err))
		return
	}
	defer eng.Close()

	// Check if there's a plan JSON file
	var result *engine.EstimateResult
	planFiles, err := filepath.Glob(filepath.Join(projectDir, "*.json"))
	if err == nil && len(planFiles) > 0 && IsTerraformPlanJSON(planFiles[0]) {
		// Estimate from plan JSON
		log.WithField("plan", planFiles[0]).Info("Estimating from Terraform plan JSON")
		result, err = eng.EstimateFromPlan(planFiles[0])
	} else {
		// Estimate from directory
		log.WithField("dir", projectDir).Info("Estimating from Terraform directory")
		result, err = eng.EstimateFromDirectory(projectDir)
	}

	if err != nil {
		WriteInternalError(w, fmt.Sprintf("Estimation failed: %v", err))
		return
	}

	// Return response
	response := EstimateResponse{
		Estimate: result.Estimate,
	}

	log.WithFields(log.Fields{
		"estimate_id":  result.Estimate.ID,
		"total_cost":   result.Estimate.TotalCost,
		"confidence":   result.Estimate.Confidence,
		"resources":    len(result.Estimate.Resources),
		"cost_items":   len(result.Estimate.CostItems),
	}).Info("Estimation completed successfully")

	WriteJSON(w, http.StatusOK, response)
}

func isValidEvaluationMode(mode string) bool {
	valid := []string{
		string(types.EvaluationStrict),
		string(types.EvaluationConservative),
		string(types.EvaluationOptimistic),
	}

	for _, v := range valid {
		if mode == v {
			return true
		}
	}
	return false
}

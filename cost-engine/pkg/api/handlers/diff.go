package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"github.com/aws-cost-estimation/cost-engine/pkg/config"
	"github.com/aws-cost-estimation/cost-engine/pkg/diff"
	"github.com/aws-cost-estimation/cost-engine/pkg/engine"
	log "github.com/sirupsen/logrus"
)

// DiffHandler handles diff requests
type DiffHandler struct {
	config *config.Config
}

// NewDiffHandler creates a new diff handler
func NewDiffHandler(cfg *config.Config) *DiffHandler {
	return &DiffHandler{config: cfg}
}

// DiffResponse represents the API response for diffs
type DiffResponse struct {
	Diff *diff.DetailedDiff `json:"diff"`
}

// Handle processes the diff request
func (h *DiffHandler) Handle(w http.ResponseWriter, r *http.Request) {
	// Parse multipart form
	if err := r.ParseMultipartForm(200 << 20); err != nil { // 200MB for two zips
		WriteBadRequest(w, fmt.Sprintf("Failed to parse form: %v", err))
		return
	}

	// Get before and after ZIPs
	beforeFile, beforeHeader, err := r.FormFile("before_zip")
	if err != nil {
		WriteBadRequest(w, "Missing before_zip file")
		return
	}
	defer beforeFile.Close()

	afterFile, afterHeader, err := r.FormFile("after_zip")
	if err != nil {
		WriteBadRequest(w, "Missing after_zip file")
		return
	}
	defer afterFile.Close()

	log.WithFields(log.Fields{
		"before": beforeHeader.Filename,
		"after":  afterHeader.Filename,
	}).Info("Processing diff request")

	// Create temp directories
	tempDir, err := os.MkdirTemp("", "terraform-diff-*")
	if err != nil {
		WriteInternalError(w, fmt.Sprintf("Failed to create temp directory: %v", err))
		return
	}
	defer os.RemoveAll(tempDir)

	// Process before ZIP
	beforeEstimate, err := h.processZip(beforeFile, filepath.Join(tempDir, "before"))
	if err != nil {
		WriteInternalError(w, fmt.Sprintf("Failed to process before ZIP: %v", err))
		return
	}

	// Process after ZIP
	afterEstimate, err := h.processZip(afterFile, filepath.Join(tempDir, "after"))
	if err != nil {
		WriteInternalError(w, fmt.Sprintf("Failed to process after ZIP: %v", err))
		return
	}

	// Calculate diff
	differ := diff.NewDiffer()
	diffResult := differ.Diff(&beforeEstimate.Estimate, &afterEstimate.Estimate)

	log.WithFields(log.Fields{
		"before_total": diffResult.BeforeTotal,
		"after_total":  diffResult.AfterTotal,
		"delta":        diffResult.TotalDelta,
		"percent":      diffResult.PercentChange,
	}).Info("Diff calculated successfully")

	// Return response
	response := DiffResponse{
		Diff: diffResult,
	}

	WriteJSON(w, http.StatusOK, response)
}

func (h *DiffHandler) processZip(file io.Reader, baseDir string) (*engine.EstimateResult, error) {
	// Create directories
	zipPath := filepath.Join(baseDir, "project.zip")
	projectDir := filepath.Join(baseDir, "project")

	if err := os.MkdirAll(filepath.Dir(zipPath), 0755); err != nil {
		return nil, err
	}

	// Save ZIP
	zipFile, err := os.Create(zipPath)
	if err != nil {
		return nil, err
	}

	if _, err := io.Copy(zipFile, file); err != nil {
		zipFile.Close()
		return nil, err
	}
	zipFile.Close()

	// Unzip
	if err := os.MkdirAll(projectDir, 0755); err != nil {
		return nil, err
	}

	if err := UnzipFile(zipPath, projectDir); err != nil {
		return nil, err
	}

	// Create engine
	eng, err := engine.New(h.config)
	if err != nil {
		return nil, err
	}
	defer eng.Close()

	// Estimate
	return eng.EstimateFromDirectory(projectDir)
}

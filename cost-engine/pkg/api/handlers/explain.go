package handlers

import (
	"net/http"

	"github.com/aws-cost-estimation/cost-engine/pkg/config"
	"github.com/aws-cost-estimation/cost-engine/pkg/explainability"
	"github.com/aws-cost-estimation/cost-engine/pkg/types"
)

// ExplainHandler handles explainability requests
type ExplainHandler struct {
	config *config.Config
}

// NewExplainHandler creates a new explain handler
func NewExplainHandler(cfg *config.Config) *ExplainHandler {
	return &ExplainHandler{config: cfg}
}

// Handle processes explain requests (placeholder for future implementation)
func (h *ExplainHandler) Handle(w http.ResponseWriter, r *http.Request) {
	// This would integrate with the explainability engine
	// For now, return a placeholder
	explainer := explainability.NewExplainer()
	
	// TODO: Get cost item from request
	// For now, return empty explanation
	explanation := map[string]interface{}{
		"message": "Explainability endpoint - integration pending",
		"note":    "Use the detailed breakdown in the estimate response",
	}

	WriteJSON(w, http.StatusOK, explanation)
}

// CatalogHandler handles catalog version requests
type CatalogHandler struct {
	config *config.Config
}

// NewCatalogHandler creates a new catalog handler
func NewCatalogHandler(cfg *config.Config) *CatalogHandler {
	return &CatalogHandler{config: cfg}
}

// Handle returns the current catalog version
func (h *CatalogHandler) Handle(w http.ResponseWriter, r *http.Request) {
	response := map[string]interface{}{
		"version": "latest", // TODO: Fetch from database
		"status":  "active",
	}

	WriteJSON(w, http.StatusOK, response)
}

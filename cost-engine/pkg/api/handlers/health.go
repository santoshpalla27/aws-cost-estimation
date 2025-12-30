package handlers

import (
	"net/http"
)

// Health handles health check requests
func Health(w http.ResponseWriter, r *http.Request) {
	response := map[string]interface{}{
		"status":  "healthy",
		"service": "aws-cost-engine",
	}

	WriteJSON(w, http.StatusOK, response)
}

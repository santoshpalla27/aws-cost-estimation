package handlers

import (
	"encoding/json"
	"net/http"

	log "github.com/sirupsen/logrus"
)

// ErrorResponse represents an API error response
type ErrorResponse struct {
	Error ErrorDetail `json:"error"`
}

// ErrorDetail contains error information
type ErrorDetail struct {
	Code    string                 `json:"code"`
	Message string                 `json:"message"`
	Status  int                    `json:"status"`
	Details map[string]interface{} `json:"details,omitempty"`
}

// WriteJSON writes a JSON response
func WriteJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.WithError(err).Error("Failed to encode JSON response")
	}
}

// WriteError writes an error response
func WriteError(w http.ResponseWriter, code string, message string, status int, details map[string]interface{}) {
	response := ErrorResponse{
		Error: ErrorDetail{
			Code:    code,
			Message: message,
			Status:  status,
			Details: details,
		},
	}

	WriteJSON(w, status, response)
}

// WriteBadRequest writes a 400 error
func WriteBadRequest(w http.ResponseWriter, message string) {
	WriteError(w, "BAD_REQUEST", message, http.StatusBadRequest, nil)
}

// WriteInternalError writes a 500 error
func WriteInternalError(w http.ResponseWriter, message string) {
	WriteError(w, "INTERNAL_ERROR", message, http.StatusInternalServerError, nil)
}

// WriteValidationError writes a validation error
func WriteValidationError(w http.ResponseWriter, message string, details map[string]interface{}) {
	WriteError(w, "VALIDATION_ERROR", message, http.StatusBadRequest, details)
}

package config

import (
	"fmt"
	"os"
	
	"github.com/aws-cost-estimation/cost-engine/pkg/types"
)

type Config struct {
	DatabaseURL    string
	LogLevel       string
	Port           string
	EvaluationMode types.EvaluationMode
}

func Load() (*Config, error) {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL environment variable is required")
	}

	// Parse evaluation mode with default
	mode := types.EvaluationMode(os.Getenv("EVALUATION_MODE"))
	if mode == "" {
		mode = types.EvaluationConservative // Default to conservative
	}

	cfg := &Config{
		DatabaseURL:    databaseURL,
		LogLevel:       getEnv("LOG_LEVEL", "info"),
		Port:           getEnv("PORT", "8080"),
		EvaluationMode: mode,
	}

	return cfg, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

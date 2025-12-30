package config

import (
	"fmt"
	"os"
)

type Config struct {
	DatabaseURL string
	LogLevel    string
	Port        string
}

func Load() (*Config, error) {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL environment variable is required")
	}

	cfg := &Config{
		DatabaseURL: databaseURL,
		LogLevel:    getEnv("LOG_LEVEL", "info"),
		Port:        getEnv("PORT", "8080"),
	}

	return cfg, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

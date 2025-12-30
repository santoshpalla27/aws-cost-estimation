// Package main implements the HTTP server for the cost estimation engine
package main

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
	"crypto/sha256"
	"encoding/hex"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/santoshpalla27/aws-cost-estimation/cost-engine/internal/adapters"
	"github.com/santoshpalla27/aws-cost-estimation/cost-engine/internal/aggregation"
	"github.com/santoshpalla27/aws-cost-estimation/cost-engine/internal/pricing"
	"github.com/santoshpalla27/aws-cost-estimation/cost-engine/internal/terraform"
	"github.com/santoshpalla27/aws-cost-estimation/cost-engine/internal/types"
)

const (
	defaultPort   = "8080"
	defaultRegion = "us-east-1"
)

// Server represents the cost estimation HTTP server
type Server struct {
	pool       *pgxpool.Pool
	loader     *terraform.Loader
	ec2Adapter *adapters.EC2Adapter
	matcher    *pricing.Matcher
	aggregator *aggregation.Aggregator
	router     *gin.Engine
}

func main() {
	// Get database URL from environment
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbHost := getEnv("DB_HOST", "localhost")
		dbPort := getEnv("DB_PORT", "5432")
		dbName := getEnv("DB_NAME", "pricing")
		dbUser := getEnv("DB_USER", "postgres")
		dbPass := getEnv("DB_PASSWORD", "postgres")
		dbURL = fmt.Sprintf("postgres://%s:%s@%s:%s/%s", dbUser, dbPass, dbHost, dbPort, dbName)
	}

	// Connect to database
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()

	// Verify connection
	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	log.Println("Connected to pricing database")

	// Create server
	server := &Server{
		pool:       pool,
		loader:     terraform.NewLoader(),
		ec2Adapter: adapters.NewEC2Adapter(),
		matcher:    pricing.NewMatcher(pool),
		aggregator: aggregation.NewAggregator(),
	}

	// Setup router
	server.setupRouter()

	// Start server
	port := getEnv("PORT", defaultPort)
	log.Printf("Starting cost engine server on port %s", port)
	if err := server.router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func (s *Server) setupRouter() {
	gin.SetMode(gin.ReleaseMode)
	s.router = gin.New()
	s.router.Use(gin.Recovery())
	s.router.Use(gin.Logger())

	// Health check
	s.router.GET("/health", s.healthHandler)

	// API routes
	api := s.router.Group("/api/v1")
	{
		api.POST("/estimate", s.estimateHandler)
		api.POST("/estimate/terraform", s.estimateTerraformHandler)
	}
}

// healthHandler returns server health status
func (s *Server) healthHandler(c *gin.Context) {
	ctx := c.Request.Context()
	if err := s.pool.Ping(ctx); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status": "unhealthy",
			"error":  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "healthy",
		"version": "1.0.0",
	})
}

// EstimateRequest represents the request body for cost estimation
type EstimateRequest struct {
	Region    string `json:"region" binding:"required"`
	TerraformZip []byte `json:"terraform_zip,omitempty"` // Base64 encoded ZIP
	TerraformHCL string `json:"terraform_hcl,omitempty"` // Raw HCL content
}

// estimateHandler handles POST /api/v1/estimate
func (s *Server) estimateHandler(c *gin.Context) {
	var req EstimateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.TerraformHCL == "" && len(req.TerraformZip) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "terraform_hcl or terraform_zip required"})
		return
	}

	region := req.Region
	if region == "" {
		region = defaultRegion
	}

	var plan *types.TerraformPlan
	var inputHash string
	var err error

	if len(req.TerraformZip) > 0 {
		// Process ZIP file
		plan, inputHash, err = s.processZip(req.TerraformZip)
	} else {
		// Process inline HCL
		plan, inputHash, err = s.processHCL(req.TerraformHCL)
	}

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Generate cost estimate
	estimate, err := s.generateEstimate(c.Request.Context(), plan, region, inputHash)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, estimate)
}

// estimateTerraformHandler handles multipart form upload
func (s *Server) estimateTerraformHandler(c *gin.Context) {
	// Get region from form
	region := c.PostForm("region")
	if region == "" {
		region = defaultRegion
	}

	// Get uploaded file
	file, err := c.FormFile("terraform")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "terraform file required"})
		return
	}

	// Read file content
	f, err := file.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	defer f.Close()

	content, err := io.ReadAll(f)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var plan *types.TerraformPlan
	var inputHash string

	// Check if ZIP or HCL
	if strings.HasSuffix(file.Filename, ".zip") {
		plan, inputHash, err = s.processZip(content)
	} else {
		plan, inputHash, err = s.processHCL(string(content))
	}

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Generate cost estimate
	estimate, err := s.generateEstimate(c.Request.Context(), plan, region, inputHash)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, estimate)
}

// processZip extracts and parses Terraform files from a ZIP archive
func (s *Server) processZip(zipData []byte) (*types.TerraformPlan, string, error) {
	// Calculate input hash
	hash := sha256.Sum256(zipData)
	inputHash := "sha256:" + hex.EncodeToString(hash[:])

	// Create temp directory
	tempDir, err := os.MkdirTemp("", "terraform-*")
	if err != nil {
		return nil, "", fmt.Errorf("failed to create temp dir: %w", err)
	}
	defer os.RemoveAll(tempDir)

	// Extract ZIP
	r, err := zip.NewReader(bytes.NewReader(zipData), int64(len(zipData)))
	if err != nil {
		return nil, "", fmt.Errorf("failed to read ZIP: %w", err)
	}

	for _, f := range r.File {
		if f.FileInfo().IsDir() {
			continue
		}

		// Sanitize path to prevent zip slip
		destPath := filepath.Join(tempDir, filepath.Clean(f.Name))
		if !strings.HasPrefix(destPath, tempDir) {
			continue
		}

		// Create parent directories
		if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
			return nil, "", err
		}

		// Extract file
		rc, err := f.Open()
		if err != nil {
			return nil, "", err
		}

		content, err := io.ReadAll(rc)
		rc.Close()
		if err != nil {
			return nil, "", err
		}

		if err := os.WriteFile(destPath, content, 0644); err != nil {
			return nil, "", err
		}
	}

	// Parse Terraform files
	plan, err := s.loader.LoadDirectory(tempDir)
	if err != nil {
		return nil, "", fmt.Errorf("failed to parse Terraform: %w", err)
	}

	return plan, inputHash, nil
}

// processHCL parses inline HCL content
func (s *Server) processHCL(hcl string) (*types.TerraformPlan, string, error) {
	// Calculate input hash
	hash := sha256.Sum256([]byte(hcl))
	inputHash := "sha256:" + hex.EncodeToString(hash[:])

	// Create temp file
	tempFile, err := os.CreateTemp("", "terraform-*.tf")
	if err != nil {
		return nil, "", err
	}
	defer os.Remove(tempFile.Name())

	if _, err := tempFile.WriteString(hcl); err != nil {
		tempFile.Close()
		return nil, "", err
	}
	tempFile.Close()

	// Parse
	plan, err := s.loader.LoadDirectory(filepath.Dir(tempFile.Name()))
	if err != nil {
		return nil, "", fmt.Errorf("failed to parse Terraform: %w", err)
	}

	return plan, inputHash, nil
}

// generateEstimate creates a cost estimate from a parsed Terraform plan
func (s *Server) generateEstimate(ctx context.Context, plan *types.TerraformPlan, region string, inputHash string) (*types.CostEstimate, error) {
	var allVectors []types.UsageVector

	// Convert resources to usage vectors
	for _, resource := range plan.Resources {
		// Try EC2 adapter
		if s.ec2Adapter.CanHandle(resource.Type) {
			vectors := s.ec2Adapter.Adapt(resource, region)
			allVectors = append(allVectors, vectors...)
		}
		// TODO: Add more adapters for RDS, S3, Lambda, etc.
	}

	// Match vectors to prices
	var pricedItems []types.PricedItem
	for _, vector := range allVectors {
		priced, err := s.matcher.Match(ctx, vector)
		if err != nil {
			// Log error but continue
			log.Printf("Warning: failed to match %s: %v", vector.UsageType, err)
			continue
		}
		if priced != nil {
			pricedItems = append(pricedItems, *priced)
		}
	}

	// Get catalog version
	catalogVersion := s.getCatalogVersion(ctx)

	// Aggregate costs
	metadata := types.EstimateMetadata{
		CatalogVersion: catalogVersion,
		InputHash:      inputHash,
		EvaluatedAt:    time.Now().UTC().Format(time.RFC3339),
		EngineVersion:  "1.0.0",
	}

	estimate := s.aggregator.Aggregate(pricedItems, metadata)

	return &estimate, nil
}

// getCatalogVersion retrieves the latest catalog version from the database
func (s *Server) getCatalogVersion(ctx context.Context) string {
	var version string
	err := s.pool.QueryRow(ctx, `
		SELECT MAX(ingested_at)::date::text 
		FROM catalog_versions 
		WHERE status = 'completed'
	`).Scan(&version)
	if err != nil || version == "" {
		version = time.Now().Format("2006-01-02")
	}
	return version
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

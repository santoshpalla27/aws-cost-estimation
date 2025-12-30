package api

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/aws-cost-estimation/cost-engine/pkg/api/handlers"
	"github.com/aws-cost-estimation/cost-engine/pkg/api/middleware"
	"github.com/aws-cost-estimation/cost-engine/pkg/config"
	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	log "github.com/sirupsen/logrus"
)

// Server represents the HTTP API server
type Server struct {
	config *config.Config
	router *chi.Mux
	server *http.Server
}

// New creates a new API server
func New(cfg *config.Config) *Server {
	s := &Server{
		config: cfg,
		router: chi.NewRouter(),
	}

	s.setupMiddleware()
	s.setupRoutes()

	return s
}

func (s *Server) setupMiddleware() {
	// Request ID
	s.router.Use(chimiddleware.RequestID)

	// Real IP
	s.router.Use(chimiddleware.RealIP)

	// Logger
	s.router.Use(middleware.Logger)

	// Recoverer
	s.router.Use(chimiddleware.Recoverer)

	// Timeout
	s.router.Use(chimiddleware.Timeout(120 * time.Second)) // 2 minutes for large uploads

	// CORS
	corsOrigins := os.Getenv("CORS_ORIGINS")
	if corsOrigins == "" {
		corsOrigins = "http://localhost:5173,http://localhost:3000" // Default for dev
	}

	s.router.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{corsOrigins},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Request-ID"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))
}

func (s *Server) setupRoutes() {
	// Health check
	s.router.Get("/health", handlers.Health)

	// API routes
	s.router.Route("/api", func(r chi.Router) {
		// Estimate endpoint
		r.Post("/estimate", handlers.NewEstimateHandler(s.config).Handle)

		// Diff endpoint
		r.Post("/diff", handlers.NewDiffHandler(s.config).Handle)

		// Policy endpoint
		r.Post("/policy", handlers.NewPolicyHandler(s.config).Handle)

		// Explain endpoint
		r.Post("/explain", handlers.NewExplainHandler(s.config).Handle)

		// Catalog version
		r.Get("/catalog/version", handlers.NewCatalogHandler(s.config).Handle)
	})
}

// Start starts the HTTP server
func (s *Server) Start(port string) error {
	s.server = &http.Server{
		Addr:         ":" + port,
		Handler:      s.router,
		ReadTimeout:  120 * time.Second,
		WriteTimeout: 120 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Start server in goroutine
	go func() {
		log.WithField("port", port).Info("Starting HTTP server")
		if err := s.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info("Shutting down server...")

	// Graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := s.server.Shutdown(ctx); err != nil {
		return fmt.Errorf("server forced to shutdown: %w", err)
	}

	log.Info("Server exited")
	return nil
}

// Stop stops the HTTP server gracefully
func (s *Server) Stop() error {
	if s.server == nil {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	return s.server.Shutdown(ctx)
}

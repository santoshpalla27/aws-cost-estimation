package commands

import (
	"github.com/aws-cost-estimation/cost-engine/pkg/api"
	"github.com/aws-cost-estimation/cost-engine/pkg/config"
	"github.com/spf13/cobra"
	log "github.com/sirupsen/logrus"
)

var (
	serverPort string
)

var serverCmd = &cobra.Command{
	Use:   "server",
	Short: "Start HTTP API server",
	Long: `Start the cost engine HTTP API server.
	
The server exposes REST endpoints for:
  - Cost estimation from Terraform projects
  - Diff calculation between estimates
  - Policy evaluation
  - Explainability and audit information

Examples:
  # Start server on default port
  cost-engine server

  # Start server on custom port
  cost-engine server --port 9090

Environment variables:
  DATABASE_URL     - PostgreSQL connection string (required)
  CORS_ORIGINS     - Comma-separated CORS origins (default: localhost dev ports)
  EVALUATION_MODE  - Default evaluation mode (STRICT/CONSERVATIVE/OPTIMISTIC)
  LOG_LEVEL        - Logging level (debug/info/warn/error)`,
	RunE: runServer,
}

func init() {
	serverCmd.Flags().StringVar(&serverPort, "port", "8080", "HTTP server port")
}

func runServer(cmd *cobra.Command, args []string) error {
	log.Info("Initializing cost engine HTTP API server")

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	log.WithFields(log.Fields{
		"port":            serverPort,
		"evaluation_mode": cfg.EvaluationMode,
	}).Info("Server configuration loaded")

	// Create and start server
	server := api.New(cfg)

	log.Info("Server started successfully - ready to receive requests")
	
	return server.Start(serverPort)
}

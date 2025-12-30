package main

import (
	"os"

	"github.com/aws-cost-estimation/cost-engine/cmd/commands"
	log "github.com/sirupsen/logrus"
)

func main() {
	// Configure logging
	log.SetOutput(os.Stdout)
	log.SetLevel(log.InfoLevel)
	log.SetFormatter(&log.TextFormatter{
		FullTimestamp: true,
	})

	// Execute root command
	if err := commands.Execute(); err != nil {
		log.Fatalf("Error: %v", err)
		os.Exit(1)
	}
}

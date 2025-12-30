package terraform

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"

	"github.com/aws-cost-estimation/cost-engine/pkg/types"
	"github.com/hashicorp/hcl/v2"
	"github.com/hashicorp/hcl/v2/hclparse"
	log "github.com/sirupsen/logrus"
)

// Loader handles loading and parsing Terraform configurations
type Loader struct {
	parser *hclparse.Parser
}

func NewLoader() *Loader {
	return &Loader{
		parser: hclparse.NewParser(),
	}
}

// LoadFromDirectory loads Terraform configuration from a directory
func (l *Loader) LoadFromDirectory(dir string) ([]types.Resource, string, error) {
	log.WithField("dir", dir).Info("Loading Terraform from directory")

	// Read all .tf files
	tfFiles, err := l.findTerraformFiles(dir)
	if err != nil {
		return nil, "", fmt.Errorf("failed to find terraform files: %w", err)
	}

	if len(tfFiles) == 0 {
		return nil, "", fmt.Errorf("no terraform files found in directory")
	}

	// Parse all files
	var allResources []types.Resource
	var allContent []byte

	for _, file := range tfFiles {
		resources, content, err := l.parseFile(file)
		if err != nil {
			log.WithField("file", file).Warnf("Failed to parse file: %v", err)
			continue
		}
		allResources = append(allResources, resources...)
		allContent = append(allContent, content...)
	}

	// Calculate input hash for determinism
	hash := l.calculateHash(allContent)

	log.WithField("resources", len(allResources)).Info("Loaded resources from directory")
	return allResources, hash, nil
}

// LoadFromPlan loads Terraform from a plan JSON file
func (l *Loader) LoadFromPlan(planFile string) ([]types.Resource, string, error) {
	log.WithField("file", planFile).Info("Loading Terraform from plan JSON")

	content, err := ioutil.ReadFile(planFile)
	if err != nil {
		return nil, "", fmt.Errorf("failed to read plan file: %w", err)
	}

	var plan TerraformPlan
	if err := json.Unmarshal(content, &plan); err != nil {
		return nil, "", fmt.Errorf("failed to parse plan JSON: %w", err)
	}

	resources := l.extractResourcesFromPlan(&plan)
	hash := l.calculateHash(content)

	log.WithField("resources", len(resources)).Info("Loaded resources from plan")
	return resources, hash, nil
}

func (l *Loader) findTerraformFiles(dir string) ([]string, error) {
	var files []string

	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Skip .terraform directory
		if info.IsDir() && info.Name() == ".terraform" {
			return filepath.SkipDir
		}

		if !info.IsDir() && filepath.Ext(path) == ".tf" {
			files = append(files, path)
		}

		return nil
	})

	return files, err
}

func (l *Loader) parseFile(filename string) ([]types.Resource, []byte, error) {
	content, err := ioutil.ReadFile(filename)
	if err != nil {
		return nil, nil, err
	}

	file, diags := l.parser.ParseHCL(content, filename)
	if diags.HasErrors() {
		return nil, nil, fmt.Errorf("HCL parse error: %s", diags.Error())
	}

	resources := l.extractResources(file)
	return resources, content, nil
}

func (l *Loader) extractResources(file *hcl.File) []types.Resource {
	// Basic resource extraction
	// In production, this would use full Terraform evaluation
	// For now, we'll do simplified extraction

	resources := []types.Resource{}

	// This is simplified - real implementation would use:
	// - hashicorp/terraform-config-inspect
	// - Or terraform-exec to get plan JSON
	// For demonstration, we'll return empty slice
	// The plan JSON path is more robust

	return resources
}

func (l *Loader) extractResourcesFromPlan(plan *TerraformPlan) []types.Resource {
	var resources []types.Resource

	if plan.PlannedValues == nil || plan.PlannedValues.RootModule == nil {
		return resources
	}

	return l.extractModuleResources(plan.PlannedValues.RootModule, "")
}

func (l *Loader) extractModuleResources(module *Module, prefix string) []types.Resource {
	var resources []types.Resource

	for _, resource := range module.Resources {
		addr := resource.Address
		if prefix != "" {
			addr = prefix + "." + addr
		}

		res := types.Resource{
			Address:    addr,
			Type:       resource.Type,
			Name:       resource.Name,
			Index:      resource.Index,
			Provider:   resource.ProviderName,
			Attributes: resource.Values,
		}

		resources = append(resources, res)
	}

	// Recursively process child modules
	for _, childModule := range module.ChildModules {
		childPrefix := childModule.Address
		if prefix != "" {
			childPrefix = prefix + "." + childPrefix
		}
		childResources := l.extractModuleResources(childModule, childPrefix)
		resources = append(resources, childResources...)
	}

	return resources
}

func (l *Loader) calculateHash(content []byte) string {
	hash := sha256.Sum256(content)
	return fmt.Sprintf("%x", hash)
}

// TerraformPlan represents terraform show -json output structure
type TerraformPlan struct {
	FormatVersion  string         `json:"format_version"`
	PlannedValues  *PlannedValues `json:"planned_values"`
	Configuration  *Configuration `json:"configuration"`
}

type PlannedValues struct {
	RootModule *Module `json:"root_module"`
}

type Configuration struct {
	RootModule *Module `json:"root_module"`
}

type Module struct {
	Address      string              `json:"address,omitempty"`
	Resources    []PlanResource      `json:"resources,omitempty"`
	ChildModules []Module            `json:"child_modules,omitempty"`
}

type PlanResource struct {
	Address      string                 `json:"address"`
	Mode         string                 `json:"mode"` // managed or data
	Type         string                 `json:"type"`
	Name         string                 `json:"name"`
	ProviderName string                 `json:"provider_name"`
	Index        interface{}            `json:"index,omitempty"`
	Values       map[string]interface{} `json:"values"`
}

// Package terraform provides HCL/JSON parsing for Terraform configurations
package terraform

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/hashicorp/hcl/v2"
	"github.com/hashicorp/hcl/v2/hclparse"
	"github.com/hashicorp/hcl/v2/hclsyntax"
	"github.com/zclconf/go-cty/cty"

	"github.com/santoshpalla27/aws-cost-estimation/cost-engine/internal/types"
)

// Loader parses Terraform configurations and expands into resources
type Loader struct {
	parser    *hclparse.Parser
	variables map[string]cty.Value
	locals    map[string]cty.Value
	evalCtx   *hcl.EvalContext
}

// NewLoader creates a new Terraform loader
func NewLoader() *Loader {
	return &Loader{
		parser:    hclparse.NewParser(),
		variables: make(map[string]cty.Value),
		locals:    make(map[string]cty.Value),
	}
}

// LoadDirectory loads all .tf files from a directory
func (l *Loader) LoadDirectory(dir string) (*types.TerraformPlan, error) {
	plan := &types.TerraformPlan{
		Resources:   []types.TerraformResource{},
		Variables:   make(map[string]interface{}),
		Locals:      make(map[string]interface{}),
		DataSources: []types.TerraformResource{},
		Outputs:     make(map[string]interface{}),
		Modules:     []string{},
	}

	// Find all .tf files
	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Skip directories and non-.tf files
		if info.IsDir() {
			// Skip hidden directories and terraform cache
			if strings.HasPrefix(info.Name(), ".") || info.Name() == ".terraform" {
				return filepath.SkipDir
			}
			return nil
		}

		if strings.HasSuffix(path, ".tf") {
			if err := l.parseFile(path, plan); err != nil {
				return fmt.Errorf("failed to parse %s: %w", path, err)
			}
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	// Build evaluation context and expand resources
	l.buildEvalContext()
	l.expandResources(plan)

	return plan, nil
}

// parseFile parses a single .tf file
func (l *Loader) parseFile(path string, plan *types.TerraformPlan) error {
	src, err := os.ReadFile(path)
	if err != nil {
		return err
	}

	file, diags := l.parser.ParseHCL(src, path)
	if diags.HasErrors() {
		return fmt.Errorf("parse errors: %s", diags.Error())
	}

	body, ok := file.Body.(*hclsyntax.Body)
	if !ok {
		return fmt.Errorf("unexpected body type")
	}

	// Extract blocks
	for _, block := range body.Blocks {
		switch block.Type {
		case "variable":
			l.parseVariable(block, plan)
		case "locals":
			l.parseLocals(block, plan)
		case "resource":
			l.parseResource(block, plan)
		case "data":
			l.parseDataSource(block, plan)
		case "output":
			l.parseOutput(block, plan)
		case "module":
			plan.Modules = append(plan.Modules, block.Labels[0])
		}
	}

	return nil
}

// parseVariable extracts variable definitions
func (l *Loader) parseVariable(block *hclsyntax.Block, plan *types.TerraformPlan) {
	if len(block.Labels) == 0 {
		return
	}

	name := block.Labels[0]
	
	// Extract default value if present
	for _, attr := range block.Body.Attributes {
		if attr.Name == "default" {
			val, _ := attr.Expr.Value(nil)
			l.variables[name] = val
			plan.Variables[name] = ctyToGo(val)
		}
	}
}

// parseLocals extracts local values
func (l *Loader) parseLocals(block *hclsyntax.Block, plan *types.TerraformPlan) {
	for name, attr := range block.Body.Attributes {
		// Locals will be evaluated later with context
		val, _ := attr.Expr.Value(l.evalCtx)
		l.locals[name] = val
		plan.Locals[name] = ctyToGo(val)
	}
}

// parseResource extracts resource definitions
func (l *Loader) parseResource(block *hclsyntax.Block, plan *types.TerraformPlan) {
	if len(block.Labels) < 2 {
		return
	}

	resourceType := block.Labels[0]
	resourceName := block.Labels[1]

	resource := types.TerraformResource{
		Type:    resourceType,
		Name:    resourceName,
		Address: fmt.Sprintf("%s.%s", resourceType, resourceName),
		Config:  make(map[string]interface{}),
		Count:   1,
	}

	// Determine provider from resource type
	parts := strings.Split(resourceType, "_")
	if len(parts) > 0 {
		resource.Provider = parts[0]
	}

	// Extract attributes
	for attrName, attr := range block.Body.Attributes {
		val, _ := attr.Expr.Value(l.evalCtx)
		
		// Skip unknown values (e.g., variables without defaults, computed values)
		if !val.IsKnown() {
			continue
		}
		
		resource.Config[attrName] = ctyToGo(val)

		// Handle count
		if attrName == "count" {
			if val.Type() == cty.Number {
				f := val.AsBigFloat()
				count, _ := f.Int64()
				resource.Count = int(count)
			}
		}
	}

	// Check for nested blocks (like ebs_block_device, tags, etc.)
	for _, nestedBlock := range block.Body.Blocks {
		blockConfig := make(map[string]interface{})
		for attrName, attr := range nestedBlock.Body.Attributes {
			val, _ := attr.Expr.Value(l.evalCtx)
			
			// Skip unknown values
			if !val.IsKnown() {
				continue
			}
			
			blockConfig[attrName] = ctyToGo(val)
		}

		// Handle multiple nested blocks of same type
		if existing, ok := resource.Config[nestedBlock.Type]; ok {
			if arr, isArr := existing.([]interface{}); isArr {
				resource.Config[nestedBlock.Type] = append(arr, blockConfig)
			} else {
				resource.Config[nestedBlock.Type] = []interface{}{existing, blockConfig}
			}
		} else {
			resource.Config[nestedBlock.Type] = blockConfig
		}
	}

	plan.Resources = append(plan.Resources, resource)
}

// parseDataSource extracts data source definitions
func (l *Loader) parseDataSource(block *hclsyntax.Block, plan *types.TerraformPlan) {
	if len(block.Labels) < 2 {
		return
	}

	dataSource := types.TerraformResource{
		Type:    block.Labels[0],
		Name:    block.Labels[1],
		Address: fmt.Sprintf("data.%s.%s", block.Labels[0], block.Labels[1]),
		Config:  make(map[string]interface{}),
	}

	for attrName, attr := range block.Body.Attributes {
		val, _ := attr.Expr.Value(l.evalCtx)
		
		// Skip unknown values
		if !val.IsKnown() {
			continue
		}
		
		dataSource.Config[attrName] = ctyToGo(val)
	}

	plan.DataSources = append(plan.DataSources, dataSource)
}

// parseOutput extracts output definitions
func (l *Loader) parseOutput(block *hclsyntax.Block, plan *types.TerraformPlan) {
	if len(block.Labels) == 0 {
		return
	}

	name := block.Labels[0]
	for attrName, attr := range block.Body.Attributes {
		if attrName == "value" {
			val, _ := attr.Expr.Value(l.evalCtx)
			
			// Skip unknown values
			if !val.IsKnown() {
				continue
			}
			
			plan.Outputs[name] = ctyToGo(val)
		}
	}
}

// buildEvalContext creates the HCL evaluation context with variables and locals
func (l *Loader) buildEvalContext() {
	l.evalCtx = &hcl.EvalContext{
		Variables: map[string]cty.Value{
			"var":   cty.ObjectVal(l.variables),
			"local": cty.ObjectVal(l.locals),
		},
	}
}

// expandResources expands count and for_each into individual resources
func (l *Loader) expandResources(plan *types.TerraformPlan) {
	var expanded []types.TerraformResource

	for _, res := range plan.Resources {
		if res.Count > 1 {
			// Expand count into multiple resources
			for i := 0; i < res.Count; i++ {
				copy := res
				copy.Address = fmt.Sprintf("%s[%d]", res.Address, i)
				copy.Count = 1
				expanded = append(expanded, copy)
			}
		} else if len(res.ForEach) > 0 {
			// Expand for_each into multiple resources
			for _, key := range res.ForEach {
				copy := res
				copy.Address = fmt.Sprintf("%s[\"%s\"]", res.Address, key)
				expanded = append(expanded, copy)
			}
		} else {
			expanded = append(expanded, res)
		}
	}

	plan.Resources = expanded
}

// ctyToGo converts a cty.Value to a Go value
func ctyToGo(val cty.Value) interface{} {
	if val.IsNull() || !val.IsKnown() {
		return nil
	}

	switch {
	case val.Type() == cty.String:
		return val.AsString()
	case val.Type() == cty.Number:
		f := val.AsBigFloat()
		// Try to return int if possible
		if f.IsInt() {
			i, _ := f.Int64()
			return i
		}
		flt, _ := f.Float64()
		return flt
	case val.Type() == cty.Bool:
		return val.True()
	case val.Type().IsListType() || val.Type().IsTupleType():
		var arr []interface{}
		for it := val.ElementIterator(); it.Next(); {
			_, v := it.Element()
			arr = append(arr, ctyToGo(v))
		}
		return arr
	case val.Type().IsMapType() || val.Type().IsObjectType():
		m := make(map[string]interface{})
		for it := val.ElementIterator(); it.Next(); {
			k, v := it.Element()
			m[k.AsString()] = ctyToGo(v)
		}
		return m
	default:
		return val.GoString()
	}
}

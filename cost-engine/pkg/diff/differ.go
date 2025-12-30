package diff

import (
	"fmt"

	"github.com/aws-cost-estimation/cost-engine/pkg/types"
)

// Differ calculates detailed cost differences between two estimates
type Differ struct{}

func New() *Differ {
	return &Differ{}
}

// Diff generates comprehensive diff between two estimates
func (d *Differ) Diff(before, after *types.Estimate) *DetailedDiff {
	diff := &DetailedDiff{
		BeforeID:    before.ID,
		AfterID:     after.ID,
		BeforeTotal: before.TotalCost,
		AfterTotal:  after.TotalCost,
		TotalDelta:  after.TotalCost - before.TotalCost,
	}

	// Build resource maps for easy lookup
	beforeResources := d.buildResourceMap(before.Resources)
	afterResources := d.buildResourceMap(after.Resources)

	beforeCosts := d.buildCostMap(before.CostItems)
	afterCosts := d.buildCostMap(after.CostItems)

	// Find added resources
	for addr, resource := range afterResources {
		if _, exists := beforeResources[addr]; !exists {
			cost := d.getResourceCost(addr, after.CostItems)
			diff.AddedResources = append(diff.AddedResources, ResourceChange{
				Address: addr,
				Type:    resource.Type,
				Cost:    cost,
			})
			diff.AddedCost += cost
		}
	}

	// Find removed resources
	for addr, resource := range beforeResources {
		if _, exists := afterResources[addr]; !exists {
			cost := d.getResourceCost(addr, before.CostItems)
			diff.RemovedResources = append(diff.RemovedResources, ResourceChange{
				Address: addr,
				Type:    resource.Type,
				Cost:    cost,
			})
			diff.RemovedCost += cost
		}
	}

	// Find modified resources
	for addr := range afterResources {
		if _, exists := beforeResources[addr]; exists {
			beforeCost := d.getResourceCost(addr, before.CostItems)
			afterCost := d.getResourceCost(addr, after.CostItems)
			
			if beforeCost != afterCost {
				delta := afterCost - beforeCost
				diff.ModifiedResources = append(diff.ModifiedResources, ResourceChange{
					Address:    addr,
					Type:       afterResources[addr].Type,
					OldCost:    beforeCost,
					Cost:       afterCost,
					Delta:      delta,
					IsModified: true,
				})
				diff.ModifiedCost += delta
			}
		}
	}

	// Service-level deltas
	diff.ServiceDeltas = d.calculateServiceDeltas(before.ServiceBreakdown, after.ServiceBreakdown)

	// Percentage change
	if before.TotalCost > 0 {
		diff.PercentChange = (diff.TotalDelta / before.TotalCost) * 100
	}

	return diff
}

// DiffCostItems provides line-by-line cost item comparison
func (d *Differ) DiffCostItems(before, after []types.CostItem) []CostItemDiff {
	var diffs []CostItemDiff

	beforeMap := make(map[string]types.CostItem)
	for _, item := range before {
		key := fmt.Sprintf("%s:%s:%s", item.ResourceAddress, item.Service, item.UsageType)
		beforeMap[key] = item
	}

	afterMap := make(map[string]types.CostItem)
	for _, item := range after {
		key := fmt.Sprintf("%s:%s:%s", item.ResourceAddress, item.Service, item.UsageType)
		afterMap[key] = item
	}

	// Check all items
	allKeys := make(map[string]bool)
	for key := range beforeMap {
		allKeys[key] = true
	}
	for key := range afterMap {
		allKeys[key] = true
	}

	for key := range allKeys {
		beforeItem, beforeExists := beforeMap[key]
		afterItem, afterExists := afterMap[key]

		var itemDiff CostItemDiff
		itemDiff.Key = key

		if !beforeExists {
			// Added
			itemDiff.ChangeType = "ADDED"
			itemDiff.After = &afterItem
			itemDiff.Delta = afterItem.TotalCost
		} else if !afterExists {
			// Removed
			itemDiff.ChangeType = "REMOVED"
			itemDiff.Before = &beforeItem
			itemDiff.Delta = -beforeItem.TotalCost
		} else {
			// Modified (or unchanged)
			itemDiff.Before = &beforeItem
			itemDiff.After = &afterItem
			itemDiff.Delta = afterItem.TotalCost - beforeItem.TotalCost
			
			if itemDiff.Delta != 0 {
				itemDiff.ChangeType = "MODIFIED"
			} else {
				itemDiff.ChangeType = "UNCHANGED"
			}
		}

		diffs = append(diffs, itemDiff)
	}

	return diffs
}

// Helper methods

func (d *Differ) buildResourceMap(resources []types.Resource) map[string]types.Resource {
	m := make(map[string]types.Resource)
	for _, r := range resources {
		m[r.Address] = r
	}
	return m
}

func (d *Differ) buildCostMap(items []types.CostItem) map[string]float64 {
	m := make(map[string]float64)
	for _, item := range items {
		m[item.ResourceAddress] += item.TotalCost
	}
	return m
}

func (d *Differ) getResourceCost(address string, items []types.CostItem) float64 {
	total := 0.0
	for _, item := range items {
		if item.ResourceAddress == address {
			total += item.TotalCost
		}
	}
	return total
}

func (d *Differ) calculateServiceDeltas(before, after map[string]float64) map[string]ServiceDelta {
	deltas := make(map[string]ServiceDelta)

	// All services
	allServices := make(map[string]bool)
	for s := range before {
		allServices[s] = true
	}
	for s := range after {
		allServices[s] = true
	}

	for service := range allServices {
		beforeCost := before[service]
		afterCost := after[service]
		delta := afterCost - beforeCost

		percentChange := 0.0
		if beforeCost > 0 {
			percentChange = (delta / beforeCost) * 100
		}

		deltas[service] = ServiceDelta{
			Service:       service,
			BeforeCost:    beforeCost,
			AfterCost:     afterCost,
			Delta:         delta,
			PercentChange: percentChange,
		}
	}

	return deltas
}

// Data structures

type DetailedDiff struct {
	BeforeID          string
	AfterID           string
	BeforeTotal       float64
	AfterTotal        float64
	TotalDelta        float64
	PercentChange     float64
	AddedResources    []ResourceChange
	RemovedResources  []ResourceChange
	ModifiedResources []ResourceChange
	AddedCost         float64
	RemovedCost       float64
	ModifiedCost      float64
	ServiceDeltas     map[string]ServiceDelta
}

type ResourceChange struct {
	Address    string
	Type       string
	Cost       float64
	OldCost    float64
	Delta      float64
	IsModified bool
}

type ServiceDelta struct {
	Service       string
	BeforeCost    float64
	AfterCost     float64
	Delta         float64
	PercentChange float64
}

type CostItemDiff struct {
	Key        string
	ChangeType string // ADDED, REMOVED, MODIFIED, UNCHANGED
	Before     *types.CostItem
	After      *types.CostItem
	Delta      float64
}

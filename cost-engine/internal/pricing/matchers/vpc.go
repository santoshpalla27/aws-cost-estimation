// Package matchers provides service-specific pricing matchers
package matchers

import (
	"context"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/santoshpalla27/aws-cost-estimation/cost-engine/internal/types"
)

// VPCMatcher handles VPC networking resources
// Implements Phase 1: Explicit resource pricing only (NO topology inference)
type VPCMatcher struct {
	pool *pgxpool.Pool
}

// NewVPCMatcher creates a VPC matcher
func NewVPCMatcher(pool *pgxpool.Pool) *VPCMatcher {
	return &VPCMatcher{pool: pool}
}

// ServiceName returns the AWS service code
func (m *VPCMatcher) ServiceName() string {
	return "AmazonVPC"
}

// Supports returns true for VPC-related resources
func (m *VPCMatcher) Supports(resourceType string) bool {
	supportedTypes := []string{
		"aws_nat_gateway",
		"aws_vpc_endpoint",
		"aws_vpn_gateway",
		"aws_customer_gateway",
		"aws_vpc_peering_connection",
		"aws_ec2_transit_gateway",
		"aws_ec2_transit_gateway_vpc_attachment",
		"aws_eip",
		"aws_lb",
		"aws_alb",
		"aws_lb_listener",
	}

	for _, t := range supportedTypes {
		if resourceType == t {
			return true
		}
	}
	return false
}

// Match generates usage vectors for VPC resources
func (m *VPCMatcher) Match(ctx context.Context, resource types.TerraformResource, region string) ([]types.UsageVector, error) {
	vectors := []types.UsageVector{}

	switch resource.Type {
	case "aws_nat_gateway":
		vectors = m.matchNATGateway(resource, region)
	case "aws_vpc_endpoint":
		vectors = m.matchVPCEndpoint(resource, region)
	case "aws_vpn_gateway":
		vectors = m.matchVPNGateway(resource, region)
	case "aws_customer_gateway":
		vectors = m.matchCustomerGateway(resource, region)
	case "aws_vpc_peering_connection":
		vectors = m.matchVPCPeering(resource, region)
	case "aws_ec2_transit_gateway":
		vectors = m.matchTransitGateway(resource, region)
	case "aws_ec2_transit_gateway_vpc_attachment":
		vectors = m.matchTransitGatewayAttachment(resource, region)
	case "aws_eip":
		vectors = m.matchElasticIP(resource, region)
	case "aws_lb", "aws_alb":
		vectors = m.matchLoadBalancer(resource, region)
	case "aws_lb_listener":
		// Listeners are included in LB pricing
		vectors = []types.UsageVector{}
	}

	return vectors, nil
}

// matchNATGateway prices NAT Gateway (hourly + optional data processing)
func (m *VPCMatcher) matchNATGateway(resource types.TerraformResource, region string) []types.UsageVector {
	vectors := []types.UsageVector{}

	// Hourly charge (CRITICAL - always present)
	vectors = append(vectors, types.UsageVector{
		Service:   "AmazonVPC",
		Region:    region,
		UsageType: "NatGateway-Hours",
		Unit:      "Hrs",
		Quantity:  730,
		Attributes: map[string]string{
			"productFamily": "NAT Gateway",
		},
	})

	// Data processing charge (deferred - no traffic inference)
	vectors = append(vectors, types.UsageVector{
		Service:     "AmazonVPC",
		Region:      region,
		UsageType:   "NatGateway-Bytes",
		Unit:        "GB",
		Quantity:    0,
		Assumptions: []string{"Traffic not yet modeled - NAT Gateway data processing charge applies per GB processed"},
	})

	return vectors
}

// matchVPCEndpoint prices VPC Endpoints (Interface vs Gateway)
func (m *VPCMatcher) matchVPCEndpoint(resource types.TerraformResource, region string) []types.UsageVector {
	vectors := []types.UsageVector{}

	// Determine endpoint type
	endpointType := "Interface" // default
	if et, ok := resource.Config["vpc_endpoint_type"].(string); ok {
		endpointType = et
	}

	if strings.ToLower(endpointType) == "gateway" {
		// Gateway endpoints are FREE
		vectors = append(vectors, types.UsageVector{
			Service:     "AmazonVPC",
			Region:      region,
			UsageType:   "VPCEndpoint-Gateway",
			Unit:        "Hrs",
			Quantity:    0,
			Assumptions: []string{"Gateway VPC endpoints (S3, DynamoDB) are free - only data transfer charges apply"},
		})
	} else {
		// Interface endpoint - hourly charge
		vectors = append(vectors, types.UsageVector{
			Service:   "AmazonVPC",
			Region:    region,
			UsageType: "VpcEndpoint-Hours",
			Unit:      "Hrs",
			Quantity:  730,
			Attributes: map[string]string{
				"productFamily": "VPC Endpoint",
			},
		})

		// Interface endpoint data processing (deferred)
		vectors = append(vectors, types.UsageVector{
			Service:     "AmazonVPC",
			Region:      region,
			UsageType:   "VpcEndpoint-Bytes",
			Unit:        "GB",
			Quantity:    0,
			Assumptions: []string{"Traffic not yet modeled - Interface VPC endpoint data processing charge applies"},
		})
	}

	return vectors
}

// matchVPNGateway prices VPN Gateway hourly
func (m *VPCMatcher) matchVPNGateway(resource types.TerraformResource, region string) []types.UsageVector {
	vectors := []types.UsageVector{}

	vectors = append(vectors, types.UsageVector{
		Service:   "AmazonVPC",
		Region:    region,
		UsageType: "VpnGateway-Hours",
		Unit:      "Hrs",
		Quantity:  730,
		Attributes: map[string]string{
			"productFamily": "VPN Gateway",
		},
	})

	return vectors
}

// matchCustomerGateway - Customer Gateways are FREE
func (m *VPCMatcher) matchCustomerGateway(resource types.TerraformResource, region string) []types.UsageVector {
	vectors := []types.UsageVector{}

	vectors = append(vectors, types.UsageVector{
		Service:     "AmazonVPC",
		Region:      region,
		UsageType:   "CustomerGateway",
		Unit:        "Hrs",
		Quantity:    0,
		Assumptions: []string{"Customer Gateways are free - VPN connection charges apply"},
	})

	return vectors
}

// matchVPCPeering prices VPC Peering (data transfer only)
func (m *VPCMatcher) matchVPCPeering(resource types.TerraformResource, region string) []types.UsageVector {
	vectors := []types.UsageVector{}

	// VPC peering has no hourly charge, only data transfer
	vectors = append(vectors, types.UsageVector{
		Service:     "AmazonVPC",
		Region:      region,
		UsageType:   "VPCPeering-DataTransfer",
		Unit:        "GB",
		Quantity:    0,
		Assumptions: []string{"Traffic volume unknown - VPC peering charges apply per GB transferred"},
	})

	return vectors
}

// matchTransitGateway prices Transit Gateway hourly
func (m *VPCMatcher) matchTransitGateway(resource types.TerraformResource, region string) []types.UsageVector {
	vectors := []types.UsageVector{}

	vectors = append(vectors, types.UsageVector{
		Service:   "AmazonVPC",
		Region:    region,
		UsageType: "TransitGateway-Hours",
		Unit:      "Hrs",
		Quantity:  730,
		Attributes: map[string]string{
			"productFamily": "Transit Gateway",
		},
	})

	return vectors
}

// matchTransitGatewayAttachment prices TGW VPC attachment hourly
func (m *VPCMatcher) matchTransitGatewayAttachment(resource types.TerraformResource, region string) []types.UsageVector {
	vectors := []types.UsageVector{}

	vectors = append(vectors, types.UsageVector{
		Service:   "AmazonVPC",
		Region:    region,
		UsageType: "TransitGateway-Attachment-Hours",
		Unit:      "Hrs",
		Quantity:  730,
		Attributes: map[string]string{
			"productFamily": "Transit Gateway",
		},
	})

	// Data processing (deferred)
	vectors = append(vectors, types.UsageVector{
		Service:     "AmazonVPC",
		Region:      region,
		UsageType:   "TransitGateway-DataProcessing",
		Unit:        "GB",
		Quantity:    0,
		Assumptions: []string{"Traffic not yet modeled - Transit Gateway data processing charge applies per GB"},
	})

	return vectors
}

// matchElasticIP prices unused Elastic IPs
func (m *VPCMatcher) matchElasticIP(resource types.TerraformResource, region string) []types.UsageVector {
	vectors := []types.UsageVector{}

	// Check if associated (can't determine from Terraform config alone)
	// Assume UNASSOCIATED for conservative estimate
	vectors = append(vectors, types.UsageVector{
		Service:     "AmazonEC2",
		Region:      region,
		UsageType:   "ElasticIP-Hours",
		Unit:        "Hrs",
		Quantity:    730,
		Assumptions: []string{"Assumed unassociated EIP - charges apply if not attached to running instance"},
	})

	return vectors
}

// matchLoadBalancer prices Network/Application Load Balancer
func (m *VPCMatcher) matchLoadBalancer(resource types.TerraformResource, region string) []types.UsageVector {
	vectors := []types.UsageVector{}

	// Determine LB type
	lbType := "application" // default
	if lt, ok := resource.Config["load_balancer_type"].(string); ok {
		lbType = lt
	}

	if lbType == "network" {
		// Network Load Balancer - hourly + LCU charges
		vectors = append(vectors, types.UsageVector{
			Service:   "AWSELB",
			Region:    region,
			UsageType: "LoadBalancerUsage-Network",
			Unit:      "Hrs",
			Quantity:  730,
			Attributes: map[string]string{
				"loadBalancerType": "network",
			},
		})

		// NLB LCU usage (deferred - depends on traffic)
		vectors = append(vectors, types.UsageVector{
			Service:     "AWSELB",
			Region:      region,
			UsageType:   "LCUUsage-Network",
			Unit:        "LCU-Hrs",
			Quantity:    0,
			Assumptions: []string{"Traffic not yet modeled - Network LB charges per LCU (new connections, active connections, bytes processed)"},
		})
	} else {
		// Application Load Balancer
		vectors = append(vectors, types.UsageVector{
			Service:   "AWSELB",
			Region:    region,
			UsageType: "LoadBalancerUsage-Application",
			Unit:      "Hrs",
			Quantity:  730,
			Attributes: map[string]string{
				"loadBalancerType": "application",
			},
		})

		// ALB LCU usage (deferred)
		vectors = append(vectors, types.UsageVector{
			Service:     "AWSELB",
			Region:      region,
			UsageType:   "LCUUsage-Application",
			Unit:        "LCU-Hrs",
			Quantity:    0,
			Assumptions: []string{"Traffic not yet modeled - Application LB charges per LCU (new connections, active connections, rules evaluated, bytes processed)"},
		})
	}

	return vectors
}

# AWS VPC Terraform Module

Production-grade VPC module with multi-tier subnet architecture.

## Features
- 4-tier subnet architecture (public, private-app, database, isolated)
- Automatic CIDR calculation
- Environment-aware NAT gateway strategy
- EKS-ready with optional tags
- Comprehensive tagging

## Usage
See [terraform.tfvars](cci:7://file:///d:/good%20projects/java-app/terraform/terraform.tfvars:0:0-0:0) for configuration example.

## Subnet Architecture
- **Public**: Internet-facing resources (ALB, NAT GW)
- **Private App**: Application tier (EKS, ECS, EC2)
- **Database**: Data tier (RDS, ElastiCache)
- **Isolated**: Air-gapped resources (no internet)
################################################################################
# AWS Configuration
################################################################################

variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"

  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-[0-9]{1}$", var.aws_region))
    error_message = "AWS region must be a valid region format (e.g., us-east-1, eu-west-1)."
  }
}

################################################################################
# VPC Configuration
################################################################################

variable "vpc_cidr" {
  description = "IPv4 CIDR block for the VPC. Must be a valid private IPv4 range."
  type        = string

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block."
  }

  validation {
    condition     = can(regex("^(10\\.|172\\.(1[6-9]|2[0-9]|3[0-1])\\.|192\\.168\\.)", var.vpc_cidr))
    error_message = "VPC CIDR should use private IP ranges (10.0.0.0/8, 172.16.0.0/12, or 192.168.0.0/16)."
  }
}

variable "vpc_name" {
  description = "Name of the VPC. Used for resource naming and tagging."
  type        = string

  validation {
    condition     = length(var.vpc_name) > 0 && length(var.vpc_name) <= 64
    error_message = "VPC name must be between 1 and 64 characters."
  }
}


variable "availability_zones" {
  description = "List of availability zones to use. If empty, automatically selects first N available AZs based on subnet counts."
  type        = list(string)
  default     = []
}

variable "azs_count" {
  description = "Number of availability zones to use when availability_zones is empty. Defaults to 3 for production resilience."
  type        = number
  default     = 3

  validation {
    condition     = var.azs_count >= 2 && var.azs_count <= 6
    error_message = "AZ count must be between 2 and 6 for production workloads."
  }
}

# Add variable for NAT gateway strategy
variable "nat_gateway_mode" {
  description = "NAT Gateway deployment mode: none, single, one_per_az"
  type        = string
  default     = "single"

  validation {
    condition     = contains(["none", "single", "one_per_az"], var.nat_gateway_mode)
    error_message = "NAT gateway mode must be: none, single, or one_per_az"
  }
}


################################################################################
# Subnet Configuration
################################################################################

variable "public_subnet_count" {
  description = "Number of public subnets to create (one per AZ). Set to 0 to disable public subnets."
  type        = number
  default     = 3

  validation {
    condition     = var.public_subnet_count >= 0 && var.public_subnet_count <= 6
    error_message = "Public subnet count must be between 0 and 6."
  }
}

variable "private_app_subnet_count" {
  description = "Number of private application subnets to create (one per AZ). For EKS nodes, ECS tasks, EC2 instances."
  type        = number
  default     = 3

  validation {
    condition     = var.private_app_subnet_count >= 0 && var.private_app_subnet_count <= 6
    error_message = "Private app subnet count must be between 0 and 6."
  }
}

variable "private_db_subnet_count" {
  description = "Number of private database subnets to create (one per AZ). For RDS, ElastiCache, Redshift."
  type        = number
  default     = 3

  validation {
    condition     = var.private_db_subnet_count >= 0 && var.private_db_subnet_count <= 6
    error_message = "Private DB subnet count must be between 0 and 6."
  }
}

variable "isolated_subnet_count" {
  description = "Number of isolated subnets to create (one per AZ). No internet access, VPC-local only."
  type        = number
  default     = 0

  validation {
    condition     = var.isolated_subnet_count >= 0 && var.isolated_subnet_count <= 6
    error_message = "Isolated subnet count must be between 0 and 6."
  }
}

variable "subnet_newbits" {
  description = "Number of additional bits to add to VPC CIDR for subnet sizing. Default 8 creates /24 subnets from /16 VPC."
  type        = number
  default     = 8

  validation {
    condition     = var.subnet_newbits >= 4 && var.subnet_newbits <= 12
    error_message = "Subnet newbits must be between 4 and 12."
  }
}
################################################################################
# Tagging Configuration
################################################################################


variable "enable_eks_tags" {
  description = "Enable EKS-specific tags on subnets. Required for fully private EKS with VPC endpoints."
  type        = bool
  default     = false
}

variable "eks_cluster_name" {
  description = "Name of the EKS cluster. Required for EKS-specific tags."
  type        = string
  default     = ""
}

variable "environment" {
  description = "Environment name for resource tagging."
  type        = string
  default     = ""
}

variable "tags" {
  description = "Additional tags to apply to resources."
  type        = map(string)
  default     = {}
}
variable "vpc_tags" {
  description = "Additional tags to apply to the VPC."
  type        = map(string)
  default     = {}
}

variable "public_subnet_tags" {
  description = "Tags to apply to public subnets."
  type        = map(string)
  default     = {}
}

variable "private_app_subnet_tags" {
  description = "Tags to apply to private application subnets."
  type        = map(string)
  default     = {}
}

variable "private_db_subnet_tags" {
  description = "Tags to apply to private database subnets."
  type        = map(string)
  default     = {}
}

variable "isolated_subnet_tags" {
  description = "Tags to apply to isolated subnets."
  type        = map(string)
  default     = {}
}

variable "private_route_table_tags" {
  description = "Tags to apply to private route tables."
  type        = map(string)
  default     = {}
}

variable "private_db_route_table_tags" {
  description = "Tags to apply to private database route tables."
  type        = map(string)
  default     = {}
}

variable "private_isolated_route_table_tags" {
  description = "Tags to apply to private isolated route tables."
  type        = map(string)
  default     = {}
}

variable "public_route_table_tags" {
  description = "Tags to apply to public route tables."
  type        = map(string)
  default     = {}
}


################################################################################
# VPC Configuration
################################################################################

variable "enable_nat_gateway" {
  description = "Enable NAT Gateway for private subnets"
  type        = bool
  default     = true
}

variable "enable_database_nat_gateway" {
  description = "Enable NAT Gateway for private database subnets"
  type        = bool
  default     = false
}

variable "enable_database_internet_gateway" {
  description = "Enable Internet Gateway for database subnets"
  type        = bool
  default     = false
}

variable "enable_vpn_gateway" {
  description = "Enable VPN Gateway"
  type        = bool
  default     = false
}


################################################################################
# Flow Logs Configuration
################################################################################

variable "enable_flow_logs" {
  description = "Enable VPC Flow Logs"
  type        = bool
  default     = true
}

variable "flow_logs_retention_days" {
  description = "CloudWatch log retention for VPC Flow Logs"
  type        = number
  default     = 7
}

variable "flow_log_destination_type" {
  description = "Destination type for VPC Flow Logs (cloud-watch-logs or s3)"
  type        = string
  default     = "cloud-watch-logs"
}


################################################################################
# endpoints 
################################################################################

# free endpoints 
# For private subnets to access AWS services without NAT

variable "create_vpc_endpoints" {
  description = "Enable VPC endpoints for AWS services"
  type        = bool
  default     = false
}

################################################################################
# Data Sources
################################################################################

data "aws_region" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

################################################################################
# Local Variables
################################################################################

locals {
  # Region - use variable to avoid circular dependency with provider
  region     = var.aws_region
  account_id = data.aws_caller_identity.current.account_id

  # Availability Zones - use provided list or auto-select first N available AZs
  azs = length(var.availability_zones) > 0 ? var.availability_zones : slice(data.aws_availability_zones.available.names, 0, var.azs_count)

  # Validate subnet counts don't exceed AZ count
  max_subnet_count = max(
    var.public_subnet_count,
    var.private_app_subnet_count,
    var.private_db_subnet_count,
    var.isolated_subnet_count
  )

  validation_errors = concat(
    local.max_subnet_count > length(local.azs) ? ["ERROR: Subnet count (${local.max_subnet_count}) exceeds available AZs (${length(local.azs)})"] : [],
  )

  # CIDR Calculation Strategy:
  # - VPC CIDR is divided into 16 equal /20 blocks (tier blocks)
  # - Each tier (public, private-app, private-db, isolated) gets one /20 block
  # - Within each tier, subnets get /24 blocks (256 IPs each)
  # - This supports up to 16 subnets per tier across multiple AZs

  # Tier offsets for CIDR calculation
  public_tier_offset      = 0
  private_app_tier_offset = 1
  private_db_tier_offset  = 2
  isolated_tier_offset    = 3

  # Calculate tier blocks (/20 from /16 VPC CIDR)
  tier_newbits = 4

  public_tier_cidr      = cidrsubnet(var.vpc_cidr, local.tier_newbits, local.public_tier_offset)
  private_app_tier_cidr = cidrsubnet(var.vpc_cidr, local.tier_newbits, local.private_app_tier_offset)
  private_db_tier_cidr  = cidrsubnet(var.vpc_cidr, local.tier_newbits, local.private_db_tier_offset)
  isolated_tier_cidr    = cidrsubnet(var.vpc_cidr, local.tier_newbits, local.isolated_tier_offset)

  # Calculate individual subnet CIDRs
  public_subnet_cidrs = [
    for i in range(var.public_subnet_count) :
    cidrsubnet(local.public_tier_cidr, var.subnet_newbits - local.tier_newbits, i)
  ]

  private_app_subnet_cidrs = [
    for i in range(var.private_app_subnet_count) :
    cidrsubnet(local.private_app_tier_cidr, var.subnet_newbits - local.tier_newbits, i)
  ]

  private_db_subnet_cidrs = [
    for i in range(var.private_db_subnet_count) :
    cidrsubnet(local.private_db_tier_cidr, var.subnet_newbits - local.tier_newbits, i)
  ]

  isolated_subnet_cidrs = [
    for i in range(var.isolated_subnet_count) :
    cidrsubnet(local.isolated_tier_cidr, var.subnet_newbits - local.tier_newbits, i)
  ]




  # Subnet-specific tags
  public_subnet_tags = merge(
    {
      Tier = "Public"
      Type = "Internet-Facing"
    },
    local.eks_public_subnet_tags,
    { Name = "${var.vpc_name}-public" }
  )

  private_app_subnet_tags = merge(
    {
      Tier = "PrivateApp"
      Type = "Application"
    },
    local.eks_private_subnet_tags,
    { Name = "${var.vpc_name}-private-app" }
  )

  private_db_subnet_tags = {
    Tier = "PrivateDB"
    Type = "Database"
    Name = "${var.vpc_name}-private-db"
  }

  isolated_subnet_tags = {
    Tier = "Isolated"
    Type = "AirGapped"
    Name = "${var.vpc_name}-isolated"
  }

  private_route_table_tags = {
    Tier = "PrivateApp"
    Type = "Application"
    Name = "${var.vpc_name}-private-route-table"
  }

  private_db_route_table_tags = {
    Tier = "PrivateDB"
    Type = "Database"
    Name = "${var.vpc_name}-private-db-route-table"
  }

  private_isolated_route_table_tags = {
    Tier = "Isolated"
    Type = "AirGapped"
    Name = "${var.vpc_name}-private-isolated-route-table"
  }

  public_route_table_tags = {
    Tier = "Public"
    Type = "Internet-Facing"
    Name = "${var.vpc_name}-public-route-table"
  }

  # EKS Tags
  eks_public_subnet_tags = var.enable_eks_tags && var.eks_cluster_name != "" ? {
    "kubernetes.io/role/elb"                        = "1"
    "kubernetes.io/cluster/${var.eks_cluster_name}" = "shared"
  } : {}

  eks_private_subnet_tags = var.enable_eks_tags && var.eks_cluster_name != "" ? {
    "kubernetes.io/role/internal-elb"               = "1"
    "kubernetes.io/cluster/${var.eks_cluster_name}" = "shared"
  } : {}

  # EKS tags for isolated subnets (for fully private EKS with VPC endpoints)
  eks_isolated_subnet_tags = var.enable_eks_tags && var.eks_cluster_name != "" ? {
    "kubernetes.io/role/internal-elb"               = "1"
    "kubernetes.io/cluster/${var.eks_cluster_name}" = "shared"
  } : {}

  # Common tags applied to all resources
  common_tags = merge(
    {
      Name        = var.vpc_name
      Environment = var.environment
      ManagedBy   = "Terraform"
      Module      = "vpc"
    },
    var.tags
  )

  # VPC-specific tags
  vpc_tags_merged = merge(
    local.common_tags,
    {
      Name = var.vpc_name
    },
    var.vpc_tags
  )

}

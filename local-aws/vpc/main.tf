module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "6.5.1"

  name = var.vpc_name
  cidr = var.vpc_cidr
  azs  = local.azs

  # Public Subnets
  public_subnets          = local.public_subnet_cidrs
  public_subnet_tags      = local.public_subnet_tags
  public_route_table_tags = local.public_route_table_tags

  # Private Application Subnets
  private_subnets          = local.private_app_subnet_cidrs
  private_subnet_tags      = local.private_app_subnet_tags
  private_route_table_tags = local.private_route_table_tags

  # Database Subnets
  database_subnets                       = local.private_db_subnet_cidrs
  database_subnet_tags                   = local.private_db_subnet_tags
  database_route_table_tags              = local.private_db_route_table_tags
  create_database_subnet_route_table     = true
  create_database_nat_gateway_route      = var.enable_database_nat_gateway
  create_database_internet_gateway_route = var.enable_database_internet_gateway

  # Isolated Subnets (using intra subnets from the module)
  intra_subnets          = local.isolated_subnet_cidrs
  intra_subnet_tags      = local.isolated_subnet_tags
  intra_route_table_tags = local.private_isolated_route_table_tags

  # NAT Gateway Configuration
  enable_nat_gateway     = length(local.private_app_subnet_cidrs) > 0 && var.enable_nat_gateway && var.nat_gateway_mode != "none"
  single_nat_gateway     = var.nat_gateway_mode == "single"
  one_nat_gateway_per_az = var.nat_gateway_mode == "one_per_az"


  enable_flow_log                                 = var.enable_flow_logs
  flow_log_destination_type                       = var.flow_log_destination_type
  create_flow_log_cloudwatch_log_group            = var.flow_log_destination_type == "cloud-watch-logs" ? true : false
  create_flow_log_cloudwatch_iam_role             = var.flow_log_destination_type == "cloud-watch-logs" ? true : false
  flow_log_cloudwatch_log_group_retention_in_days = var.flow_log_destination_type == "cloud-watch-logs" ? var.flow_logs_retention_days : null


  # DNS
  enable_dns_hostnames = true
  enable_dns_support   = true

  # Tags
  tags     = local.common_tags
  vpc_tags = local.vpc_tags_merged
}

module "vpc_vpc-endpoints" {
  source  = "terraform-aws-modules/vpc/aws//modules/vpc-endpoints"
  version = "6.5.1"

  vpc_id = module.vpc.vpc_id

  create = var.create_vpc_endpoints != null ? var.create_vpc_endpoints : false

  endpoints = {
    dynamodb = {
      # gateway endpoint
      service         = "dynamodb"
      service_type    = "Gateway"
      route_table_ids = flatten([module.vpc.public_route_table_ids, module.vpc.private_route_table_ids, module.vpc.database_route_table_ids])
      tags            = { Name = "${var.vpc_name}-dynamodb-endpoint" }
    },
    s3 = {
      # gateway endpoint  
      service         = "s3"
      service_type    = "Gateway"
      route_table_ids = flatten([module.vpc.public_route_table_ids, module.vpc.private_route_table_ids, module.vpc.database_route_table_ids])
      tags            = { Name = "${var.vpc_name}-s3-endpoint" }
    }
  }
}





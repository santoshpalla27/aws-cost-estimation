output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = module.vpc.vpc_cidr_block
}

output "public_subnet_ids" {
  description = "IDs of public subnets"
  value       = module.vpc.public_subnets
}

output "private_app_subnet_ids" {
  description = "IDs of private application subnets"
  value       = module.vpc.private_subnets
}

output "private_db_subnet_ids" {
  description = "IDs of database subnets"
  value       = module.vpc.database_subnets
}

output "isolated_subnet_ids" {
  description = "IDs of isolated subnets"
  value       = module.vpc.intra_subnets
}

output "nat_gateway_ids" {
  description = "IDs of NAT Gateways"
  value       = module.vpc.natgw_ids
}


output "vpc_arn" {
  description = "ARN of the VPC"
  value       = module.vpc.vpc_arn
}
output "azs" {
  description = "List of availability zones used"
  value       = local.azs
}
output "database_subnet_group_name" {
  description = "Name of database subnet group (for RDS)"
  value       = try(module.vpc.database_subnet_group_name, null)
}
output "nat_public_ips" {
  description = "Public IPs of NAT Gateways (for whitelisting)"
  value       = module.vpc.nat_public_ips
}
output "igw_id" {
  description = "Internet Gateway ID"
  value       = try(module.vpc.igw_id, null)
}
output "public_route_table_ids" {
  description = "IDs of public route tables"
  value       = module.vpc.public_route_table_ids
}
output "private_route_table_ids" {
  description = "IDs of private route tables"
  value       = module.vpc.private_route_table_ids
}
output "database_route_table_ids" {
  description = "IDs of database route tables"
  value       = module.vpc.database_route_table_ids
}

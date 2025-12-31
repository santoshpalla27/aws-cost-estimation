# Production Environment Example
# Expected monthly cost: ~$200-300
# - 3x t3.large instances: ~$180/month
# - High IOPS storage: ~$50/month
# - Data transfer: varies

provider "aws" {
  region = "us-west-2"
}

variable "instance_count" {
  default = 3
}

variable "environment" {
  default = "production"
}

locals {
  az_suffixes = ["a", "b", "c"]
}

# Production Web Servers (Auto-Scaling Group simulation via count)
resource "aws_instance" "prod_web" {
  count = var.instance_count

  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.large"
  tenancy       = "default"

  root_block_device {
    volume_type           = "gp3"
    volume_size           = 100
    iops                  = 3000
    throughput            = 250
    delete_on_termination = true
    encrypted             = true
  }

  ebs_block_device {
    device_name = "/dev/sdf"
    volume_type = "io2"
    volume_size = 100
    iops        = 5000
    encrypted   = true
  }

  tags = {
    Name        = "prod-web-${count.index + 1}"
    Environment = var.environment
    Role        = "web-server"
    Tier        = "frontend"
  }
}

# Database Server (High Performance)
resource "aws_instance" "prod_db" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "r5.large"

  root_block_device {
    volume_type = "gp3"
    volume_size = 50
  }

  ebs_block_device {
    device_name = "/dev/sdf"
    volume_type = "io2"
    volume_size = 500
    iops        = 10000
  }

  tags = {
    Name        = "prod-database"
    Environment = var.environment
    Role        = "database"
    Tier        = "data"
  }
}

# Cache Server
resource "aws_instance" "prod_cache" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "r5.large"

  root_block_device {
    volume_type = "gp3"
    volume_size = 30
  }

  tags = {
    Name        = "prod-cache"
    Environment = var.environment
    Role        = "cache"
    Tier        = "data"
  }
}

output "web_server_ids" {
  value = aws_instance.prod_web[*].id
}

output "database_id" {
  value = aws_instance.prod_db.id
}

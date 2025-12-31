# Web Stack Example
# Expected monthly cost: ~$50
# - t3.small instance: ~$15/month
# - 100GB gp3 EBS: ~$8/month
# - Additional 50GB data volume: ~$4/month
# - Data transfer: ~varies

provider "aws" {
  region = "us-east-1"
}

variable "environment" {
  default = "staging"
}

locals {
  common_tags = {
    Environment = var.environment
    Project     = "web-stack"
    ManagedBy   = "terraform"
  }
}

# Web Server Instance
resource "aws_instance" "web_server" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.small"

  root_block_device {
    volume_type           = "gp3"
    volume_size           = 100
    delete_on_termination = true
    encrypted             = true
  }

  ebs_block_device {
    device_name = "/dev/sdf"
    volume_type = "gp3"
    volume_size = 50
    encrypted   = true
  }

  tags = merge(local.common_tags, {
    Name = "web-server-${var.environment}"
    Role = "web"
  })
}

# Application Server Instance  
resource "aws_instance" "app_server" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.medium"

  root_block_device {
    volume_type = "gp3"
    volume_size = 50
  }

  tags = merge(local.common_tags, {
    Name = "app-server-${var.environment}"
    Role = "application"
  })
}

output "web_server_ip" {
  value = aws_instance.web_server.private_ip
}

output "app_server_ip" {
  value = aws_instance.app_server.private_ip
}

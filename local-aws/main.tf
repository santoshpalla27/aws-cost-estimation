module "vpc" {
  source      = "./vpc"
  aws_region  = "us-east-1"
  vpc_name    = "my-dev-vpc"
  vpc_cidr    = "10.0.0.0/16"
  environment = "development"

  # Subnet Configuration
  public_subnet_count      = 3
  private_app_subnet_count = 0
  private_db_subnet_count  = 0
  isolated_subnet_count    = 1


  # Additional Tags
  tags = {
    Project    = "MyProject"
    Owner      = "DevOps Team"
    CostCenter = "Engineering"
  }

}

# Generate SSH key pair
resource "tls_private_key" "ec2_key" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

# Register the key pair with AWS
resource "aws_key_pair" "ec2_key" {
  key_name   = "ec2-key-${formatdate("YYYYMMDD-hhmmss", timestamp())}"
  public_key = tls_private_key.ec2_key.public_key_openssh

  tags = {
    Name = "EC2 SSH Key"
  }
}

# Save private key to local file
resource "local_file" "private_key" {
  content         = tls_private_key.ec2_key.private_key_pem
  filename        = "${path.module}/ec2-key.pem"
  file_permission = "0400"
}

# Security group allowing all traffic
resource "aws_security_group" "allow_all" {
  name        = "allow-all-traffic"
  description = "Security group allowing all inbound and outbound traffic"
  vpc_id      = module.vpc.vpc_id

  # Allow all inbound traffic
  ingress {
    description = "Allow all inbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow all outbound traffic
  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "Allow All Traffic"
  }
}

# EC2 Instance
resource "aws_instance" "main" {
  ami                    = "ami-068c0051b15cdb816"
  instance_type          = "m7i-flex.large"
  key_name               = aws_key_pair.ec2_key.key_name
  vpc_security_group_ids = [aws_security_group.allow_all.id]
  subnet_id              = module.vpc.public_subnet_ids[0]

  associate_public_ip_address = true

  user_data = <<-EOF
              #!/bin/bash
              sudo dnf install git -y 
              sudo dnf install -y docker
              sudo systemctl start docker
              sudo systemctl enable docker
              sudo usermod -aG docker $USER
              sudo mkdir -p /usr/local/lib/docker/cli-plugins
              sudo curl -SL https://github.com/docker/compose/releases/download/v2.29.2/docker-compose-linux-x86_64 -o /usr/local/lib/docker/cli-plugins/docker-compose
              sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
              docker --version
              docker compose version
              git --version
              git clone https://github.com/santoshpalla27/aws-cost-estimation.git
              EOF

  root_block_device {
    volume_size           = 100
    volume_type           = "gp3"
    delete_on_termination = true
  }

  tags = {
    Name = "EC2 Instance"
  }
}

# Outputs
output "ec2_instance_id" {
  description = "The ID of the EC2 instance"
  value       = aws_instance.main.id
}

output "ec2_public_ip" {
  description = "The public IP address of the EC2 instance"
  value       = aws_instance.main.public_ip
}

output "security_group_id" {
  description = "The ID of the security group"
  value       = aws_security_group.allow_all.id
}

output "ssh_key_path" {
  description = "Path to the SSH private key file"
  value       = local_file.private_key.filename
}

output "ssh_connection_command" {
  description = "Command to SSH into the EC2 instance"
  value       = "ssh -i ${local_file.private_key.filename} ec2-user@${aws_instance.main.public_ip}"
}

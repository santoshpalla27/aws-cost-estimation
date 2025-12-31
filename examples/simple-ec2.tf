# Simple EC2 Instance Example
# Expected monthly cost: ~$8 (t3.micro in us-east-1)

provider "aws" {
  region = "us-east-1"
}

resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"  # Amazon Linux 2
  instance_type = "t3.micro"

  root_block_device {
    volume_type = "gp3"
    volume_size = 8
  }

  tags = {
    Name        = "simple-web-server"
    Environment = "development"
  }
}

output "instance_id" {
  value = aws_instance.web.id
}

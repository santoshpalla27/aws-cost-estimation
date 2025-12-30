# Simple EC2 Instance Example

resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.micro"

  tags = {
    Name = "web-server"
  }
}

# Output the instance ID
output "instance_id" {
  value = aws_instance.web.id
}

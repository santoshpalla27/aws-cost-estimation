# Example Terraform Configurations

Sample Terraform files to test the AWS Cost Estimator.

## Files

| File | Description | Expected Cost (approx) |
|------|-------------|------------------------|
| [simple-ec2.tf](simple-ec2.tf) | Single t3.micro instance | ~$8/month |
| [web-stack.tf](web-stack.tf) | Web server with EBS and ELB | ~$50/month |
| [production.tf](production.tf) | Production multi-instance setup | ~$200/month |

## Usage

1. Upload any `.tf` file via the UI at http://localhost:3000
2. Or use the API:

```bash
curl -X POST http://localhost:8080/api/v1/estimate/terraform \
  -F "region=us-east-1" \
  -F "terraform=@examples/simple-ec2.tf"
```

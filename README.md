# AWS Cost Estimation Platform

Industry-grade AWS cost estimation from Terraform configurations.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (:3000)                        │
│                    React + Vite + Nginx                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                      Cost Engine (:8080)                        │
│              Go + HCL Parser + Pricing Matcher                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                     PostgreSQL (:5432)                          │
│                   Pricing Warehouse                            │
└────────────────────────────┬────────────────────────────────────┘
                             │ (populated by)
┌────────────────────────────▼────────────────────────────────────┐
│                     Pricing Miner                               │
│              Node.js ETL for AWS Pricing                       │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# 1. Clone and navigate
git clone https://github.com/santoshpalla27/aws-cost-estimation.git
cd aws-cost-estimation

# 2. Start database
docker compose up -d postgres

# 3. Run pricing ingestion (takes ~7 minutes for all AWS services)
docker compose run -d pricing-miner ingest --all

# 4. Start the cost engine and frontend
docker compose up -d cost-engine frontend

# 5. Access the UI
open http://localhost:3000
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| **frontend** | 3000 | React UI for uploading Terraform and viewing costs |
| **cost-engine** | 8080 | Go API for cost estimation |
| **postgres** | 5432 | PostgreSQL pricing warehouse |
| **pricing-miner** | - | Node.js ETL for AWS pricing data |

## API Endpoints

### Estimate Costs

```bash
# Upload Terraform file
curl -X POST http://localhost:8080/api/v1/estimate/terraform \
  -F "region=us-east-1" \
  -F "terraform=@main.tf"

# Upload ZIP
curl -X POST http://localhost:8080/api/v1/estimate/terraform \
  -F "region=us-east-1" \
  -F "terraform=@terraform.zip"
```

### Response

```json
{
  "total_monthly_cost": 150.25,
  "currency": "USD",
  "by_service": {
    "AmazonEC2": { "monthly_cost": 120.00, "resource_count": 2 }
  },
  "by_resource": [
    {
      "address": "aws_instance.web",
      "monthly_cost": 60.00,
      "confidence": "HIGH",
      "line_items": [...]
    }
  ],
  "overall_confidence": "HIGH",
  "metadata": {
    "catalog_version": "2024-12-31",
    "evaluated_at": "2024-12-31T00:00:00Z"
  }
}
```

## Development

```bash
# Backend (Go)
cd cost-engine
go mod tidy
go run ./cmd/server

# Frontend (React)
cd frontend
npm install
npm run dev

# Pricing Miner (Node.js)
cd pricing-miner
npm install
npm run build
npm run ingest -- list-services
```

## Pricing Data Stats

After ingestion:
- **256 AWS Services** ingested
- **1+ Million** pricing dimensions
- **Auto-learned** region mappings, instance families, OS types

## Supported Resources

Currently supported Terraform resources:
- `aws_instance` (EC2 compute, EBS volumes, data transfer)

Coming soon:
- `aws_db_instance` (RDS)
- `aws_lambda_function`
- `aws_s3_bucket`
- `aws_dynamodb_table`

## Environment Variables

### Cost Engine
| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | localhost | PostgreSQL host |
| `DB_PORT` | 5432 | PostgreSQL port |
| `DB_NAME` | pricing | Database name |
| `DB_USER` | postgres | Database user |
| `DB_PASSWORD` | postgres | Database password |
| `PORT` | 8080 | API server port |

### Pricing Miner
| Variable | Default | Description |
|----------|---------|-------------|
| `INGESTION_CONCURRENCY` | 3 | Parallel service ingestion |
| `INGESTION_BATCH_SIZE` | 5000 | Bulk insert batch size |
| `AWS_REQUEST_TIMEOUT` | 900000 | Request timeout (ms) |

## License

MIT

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

# 3. Run pricing ingestion (~15 minutes for all services including EC2)
docker compose run pricing-miner ingest --all

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

---

## Region Filtering (Important!)

### Why Region Filtering Exists

The **AmazonEC2** pricing file is **7+ GB** with 200,000+ products across all AWS regions. To avoid memory exhaustion on servers with limited RAM, the pricing miner **filters by region** during ingestion.

### Supported Regions (Default)

The following regions are ingested by default:

| Region | Location | Status |
|--------|----------|--------|
| `us-east-1` | US East (N. Virginia) | ✅ Included |
| `us-east-2` | US East (Ohio) | ✅ Included |
| `us-west-1` | US West (N. California) | ✅ Included |
| `us-west-2` | US West (Oregon) | ✅ Included |
| `eu-west-1` | Europe (Ireland) | ✅ Included |
| `eu-west-2` | Europe (London) | ✅ Included |
| `eu-central-1` | Europe (Frankfurt) | ✅ Included |
| `ap-south-1` | Asia Pacific (Mumbai) | ✅ Included |
| `ap-southeast-1` | Asia Pacific (Singapore) | ✅ Included |
| `ap-northeast-1` | Asia Pacific (Tokyo) | ✅ Included |

### Regions NOT Included (Filtered Out)

These regions are skipped to save memory:

- `ap-northeast-2` (Seoul), `ap-northeast-3` (Osaka)
- `ap-southeast-2` (Sydney), `ap-southeast-3` (Jakarta)
- `af-south-1` (Cape Town)
- `me-south-1` (Bahrain), `me-central-1` (UAE)
- `sa-east-1` (São Paulo)
- `ca-central-1` (Canada)
- `eu-north-1` (Stockholm), `eu-south-1` (Milan)
- Various GovCloud and local zones

### Memory vs Coverage Tradeoff

| Approach | Memory Required | Region Coverage | Ingestion Time |
|----------|-----------------|-----------------|----------------|
| All regions | 16+ GB RAM | 100% | ~30+ minutes |
| **Filtered (default)** | 8 GB RAM | ~70% of workloads | ~15 minutes |
| Minimal server | 4 GB RAM | May crash on EC2 | N/A |

### Adding More Regions

To add more regions, edit `pricing-miner/src/ingestion/service-ingestor.ts`:

```typescript
const ALLOWED_REGIONS = new Set([
    'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
    'eu-west-1', 'eu-west-2', 'eu-central-1',
    'ap-south-1', 'ap-southeast-1', 'ap-northeast-1',
    // Add more regions here:
    'ca-central-1',  // Canada
    'sa-east-1',     // São Paulo
    'global', 'Global', 'Any',
]);
```

### Expected Warnings During Ingestion

You will see warnings like:
```
{"level":40,"msg":"Term references unknown product SKU"}
```

**This is normal!** It means:
- A product was filtered out (different region)
- The corresponding pricing term was skipped
- No data loss for your allowed regions

---

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

### Debug Endpoints

```bash
# List all ingested services
curl http://localhost:8080/api/v1/debug/services

# Check sample pricing data for a service
curl http://localhost:8080/api/v1/debug/sample/AmazonEC2
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

---

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
- **256 AWS Services** available
- **750K+** pricing dimensions (with region filter)
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
| `AWS_REQUEST_TIMEOUT` | 3600000 | Request timeout (60 min for EC2) |
| `NODE_OPTIONS` | `--max-old-space-size=8192` | Node.js heap size |

### Docker Memory Limits

The `pricing-miner` service is configured with:
- **Memory limit**: 8 GB
- **Memory reservation**: 2 GB

For servers with less RAM, you may need to skip EC2:
```bash
# Ingest all except EC2
docker compose run pricing-miner ingest --all --exclude AmazonEC2
```

## Troubleshooting

### EC2 Ingestion Fails with OOM
- Increase Docker memory limit in `docker-compose.yml`
- Or use a server with 16+ GB RAM
- Or accept region-filtered data (covers 70% of workloads)

### EC2 Ingestion Fails with Timeout
- Current timeout is 60 minutes
- 7GB file download + processing takes ~15-20 minutes on fast networks
- Slow networks may need longer timeout in `config/index.ts`

### $0.00 Cost Estimates
- Check if the service was ingested: `curl localhost:8080/api/v1/debug/services`
- Check sample data: `curl localhost:8080/api/v1/debug/sample/AmazonEC2`
- Verify region matches (must be in allowed regions list)

## License

MIT

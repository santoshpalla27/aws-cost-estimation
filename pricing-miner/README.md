# AWS Pricing Miner - Quick Start

## Automatic Ingestion (Recommended)

### Ingest ALL AWS Services (Complete)
```bash
docker-compose run --rm pricing-miner node dist/index.js ingest-all us-east-1 --continue-on-error
```

**Features:**
- ✅ Automatically discovers all 200+ AWS services
- ✅ Ingests pricing for each service
- ✅ Shows progress (e.g., [15/200] Processing: AmazonRDS)
- ✅ Continues even if some services fail
- ⏱️ Takes 3-5 hours

### Ingest Essential Services Only (Fast)
```bash
docker-compose run --rm pricing-miner node dist/index.js ingest-all us-east-1 --essential-only --continue-on-error
```

**Features:**
- ✅ Only top 10 most used services
- ✅ Much faster (~20-30 minutes)
- ✅ Covers 90% of typical Terraform usage

**Essential Services:**
- AmazonEC2, AWSLambda, AmazonRDS
- AmazonS3, AmazonDynamoDB
- AmazonVPC, AWSELB
- AmazonCloudFront, AmazonRoute53, AmazonSNS

## Manual Ingestion (Legacy)

### Single Service
```bash
docker-compose run --rm pricing-miner node dist/index.js ingest <service> <region>

# Example
docker-compose run --rm pricing-miner node dist/index.js ingest AmazonEC2 us-east-1
```

## Check Status

```bash
docker-compose run --rm pricing-miner node dist/index.js status
```

**Output:**
```
Service: AmazonEC2
  Version: v2025-12-30
  Records: 125,847
  Region: us-east-1

Service: AWSLambda
  Version: v2025-12-30
  Records: 2,134
  Region: us-east-1

Total services: 78
Total records: 1,847,293
```

## Options

### --essential-only
Ingest only top 10 services (fast setup)

### --continue-on-error
Don't stop if individual services fail (recommended)

## Examples

### Production Setup (All Services)
```bash
# Ingest everything, skip failures
docker-compose run --rm pricing-miner \
  node dist/index.js ingest-all us-east-1 --continue-on-error
```

### Development Setup (Essential Only)
```bash
# Quick dev setup
docker-compose run --rm pricing-miner \
  node dist/index.js ingest-all us-east-1 --essential-only
```

### Multiple Regions
```bash
# Ingest for multiple regions
for region in us-east-1 us-west-2 eu-west-1; do
  docker-compose run --rm pricing-miner \
    node dist/index.js ingest-all $region --continue-on-error
done
```

## Defaults

By default, the pricing-miner is configured in docker-compose to run `status` check. To change the default:

```yaml
# docker-compose.yml
pricing-miner:
  command: ["node", "dist/index.js", "ingest-all", "us-east-1", "--continue-on-error"]
```

## Commands Summary

| Command | Description | Time |
|---------|-------------|------|
| `ingest-all <region>` | All services | 3-5 hours |
| `ingest-all <region> --essential-only` | Top 10 services | 20-30 min |
| `ingest <service> <region>` | Single service | 1-5 min |
| `status` | Show what's ingested | Instant |
| `verify <version>` | Verify data integrity | 1-2 min |
| `health` | Check database | Instant |

## Troubleshooting

### Memory Issues
Increase Docker memory:
```yaml
pricing-miner:
  deploy:
    resources:
      limits:
        memory: 4G
```

### Service Not Available
Some services aren't in all regions. Use `--continue-on-error` to skip.

### Database Full
Check disk space:
```bash
docker exec aws-cost-db df -h
```

## Recommended First-Time Setup

```bash
# 1. Start database
docker-compose up -d postgres

# 2. Wait for healthy
docker-compose ps postgres

# 3. Ingest essential services (fast)
docker-compose run --rm pricing-miner \
  node dist/index.js ingest-all us-east-1 --essential-only --continue-on-error

# 4. Verify
docker-compose run --rm pricing-miner node dist/index.js status

# 5. Start cost-engine and frontend
docker-compose up -d cost-engine frontend
```

Done! Your cost calculator is ready! 🚀

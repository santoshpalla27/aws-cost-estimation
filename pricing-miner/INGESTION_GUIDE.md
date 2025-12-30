# AWS Service Pricing Ingestion Guide

## Overview

This guide covers ingesting pricing data for **all major AWS services** into your cost estimation platform.

## Quick Start

### Windows (PowerShell)
```powershell
.\ingest-all-services.ps1 -Region us-east-1
```

### Linux/Mac (Bash)
```bash
chmod +x ingest-all-services.sh
./ingest-all-services.sh us-east-1
```

## Included Services (78 total)

### Compute (6 services)
- AmazonEC2 - Virtual servers
- AWSLambda - Serverless functions
- AmazonECS - Container orchestration
- AmazonEKS - Kubernetes
- AmazonLightsail - Simplified VPS
- AWSBatch - Batch computing

### Storage (6 services)
- AmazonS3 - Object storage
- AmazonEBS - Block storage
- AmazonEFS - File storage
- AmazonFSx - Managed file systems
- AmazonGlacier - Archive storage
- AWSBackup - Backup service

### Database (9 services)
- AmazonRDS - Relational databases
- AmazonDynamoDB - NoSQL database
- AmazonElastiCache - In-memory cache
- AmazonRedshift - Data warehouse
- AmazonDocumentDB - MongoDB-compatible
- AmazonNeptune - Graph database
- AmazonDAX - DynamoDB accelerator
- AmazonMemoryDB - Redis-compatible

### Networking (8 services)
- AmazonVPC - Virtual private cloud
- AmazonCloudFront - CDN
- AmazonRoute53 - DNS
- AWSELB - Load balancers (ALB, NLB, CLB)
- AmazonAPIGateway - API management
- AWSDirectConnect - Dedicated connection
- AWSTransitGateway - Network hub
- AWSPrivateLink - Private connectivity

### Application Integration (6 services)
- AmazonSNS - Notifications
- AmazonSQS - Message queues
- AmazonMQ - Managed message broker
- AmazonEventBridge - Event bus
- AWSStepFunctions - Workflow orchestration
- AmazonKinesis - Real-time streaming

### Analytics (5 services)
- AmazonAthena - SQL queries on S3
- AWSGlue - ETL service
- AmazonEMR - Big data processing
- AmazonQuickSight - BI dashboards
- AmazonKinesisAnalytics - Stream analytics

### Security (7 services)
- AWSKeyManagementService - Encryption keys
- AWSSecretsManager - Secret storage
- AWSWAF - Web application firewall
- AWSShield - DDoS protection
- AWSGuardDuty - Threat detection
- AmazonCognito - User authentication
- AWSCertificateManager - SSL/TLS certificates

### Developer Tools (5 services)
- AWSCodeBuild - Build service
- AWSCodeDeploy - Deployment
- AWSCodePipeline - CI/CD
- AWSCodeCommit - Git repositories
- AWSCodeArtifact - Artifact repository

### Management (5 services)
- AmazonCloudWatch - Monitoring & logging
- AWSCloudTrail - API logging
- AWSConfig - Resource inventory
- AWSSystemsManager - Operations management
- AWSServiceCatalog - Service catalog

### Machine Learning (5 services)
- AmazonSageMaker - ML platform
- AmazonRekognition - Image/video analysis
- AmazonComprehend - NLP
- AmazonTranscribe - Speech-to-text
- AmazonPolly - Text-to-speech

### Containers (2 services)
- AmazonECR - Container registry
- AWSFargate - Serverless containers

### Migration (3 services)
- AWSDataTransfer - Data transfer
- AWSSnowball - Physical data transfer
- AWSTransfer - SFTP/FTP/FTPS

### Other (3 services)
- AmazonSES - Email service
- AmazonWorkSpaces - Virtual desktops
- AmazonAppStream - Application streaming

## Time & Storage Estimates

### Single Service Ingestion
- **Time**: 30 seconds - 5 minutes per service
- **Storage**: 50MB - 500MB per service (in database)

### All 78 Services
- **Time**: 2-4 hours (sequential)
- **Database**: ~15-20 GB total
- **Disk I/O**: Heavy during ingestion

## Ingesting Specific Services Only

If you want to ingest only specific services:

```bash
# Just the essentials (5 services)
services=("AmazonEC2" "AWSLambda" "AmazonRDS" "AmazonS3" "AmazonDynamoDB")

for service in "${services[@]}"; do
  docker-compose run --rm pricing-miner node dist/index.js ingest $service us-east-1
done
```

## Region-Specific Ingestion

Some services are region-specific. Ingest for all regions you need:

```bash
regions=("us-east-1" "us-west-2" "eu-west-1")

for region in "${regions[@]}"; do
  docker-compose run --rm pricing-miner node dist/index.js ingest AmazonEC2 $region
done
```

## Checking Ingestion Status

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

## Prioritized Service List

### Tier 1: Essential (Must Have)
```
AmazonEC2, AWSLambda, AmazonRDS, AmazonS3, AmazonDynamoDB
AmazonVPC, AWSELB, AmazonCloudFront, AmazonRoute53
```

### Tier 2: Common (Recommended)
```
AmazonECS, AmazonEKS, AmazonElastiCache, AmazonRedshift
AmazonSNS, AmazonSQS, AmazonAPIGateway, AmazonEFS
AmazonCloudWatch, AWSKeyManagementService
```

### Tier 3: Advanced (Optional)
```
AmazonSageMaker, AmazonEMR, AmazonAthena, AWSGlue
AmazonNeptune, AWSStepFunctions, AWSBatch
```

### Tier 4: Specialized (As Needed)
All remaining services

## Automation: Scheduled Updates

Pricing data updates monthly. Set up a cron job:

```bash
# Update pricing on 1st of every month at 2 AM
0 2 1 * * cd /path/to/project && ./ingest-all-services.sh us-east-1
```

## Troubleshooting

### Service Not Found
Some services may not be available in all regions:
```bash
⚠️  Warning: Failed to ingest AmazonNeptune (may not be available in ap-south-1)
```
**Solution**: Skip or use a different region

### Memory Issues
If ingestion fails due to memory:
```yaml
# docker-compose.yml
pricing-miner:
  deploy:
    resources:
      limits:
        memory: 4G  # Increase from default
```

### Disk Space
Monitor database size:
```bash
docker exec aws-cost-db du -sh /var/lib/postgresql/data
```

## Performance Optimization

### Parallel Ingestion (Advanced)

```bash
# Run 4 services in parallel
xargs -P 4 -I {} docker-compose run --rm pricing-miner \
  node dist/index.js ingest {} us-east-1 \
  < services.txt
```

**Warning**: May hit AWS API rate limits!

## Verification

After ingestion, verify:

```bash
# Connect to database
docker exec -it aws-cost-db psql -U cost_user -d aws_cost_estimation

# Check record counts
SELECT service_code, COUNT(*) 
FROM pricing_dimensions 
GROUP BY service_code 
ORDER BY COUNT(*) DESC;
```

## Complete AWS Service List

If you want **every single service** (200+):

```bash
# Get full list from AWS
aws pricing describe-services --region us-east-1 \
  --query 'Services[].ServiceCode' \
  --output text
```

Then ingest each one individually.

## Summary

✅ **78 major services** covered in the scripts  
✅ **Automated ingestion** via PowerShell or Bash  
✅ **2-4 hours** for full ingestion  
✅ **15-20 GB** database storage  
✅ **Monthly updates** recommended  

Run the script and you'll have comprehensive AWS pricing data for your cost calculator! 🚀

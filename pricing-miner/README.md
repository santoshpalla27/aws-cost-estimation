# AWS Pricing Miner

Industry-grade ETL pipeline for ingesting AWS pricing data from all services.

## Features

- **Universal Service Support**: Ingests pricing data from ALL AWS services
- **Memory Efficient**: Streaming JSON parser for multi-GB files
- **Auto-Learn Mappings**: Rosetta table learns attribute mappings from data
- **Parallel Ingestion**: Configurable concurrency for faster processing
- **Version Control**: Catalogs are versioned and immutable
- **PostgreSQL Storage**: Optimized schema with COPY bulk inserts

## Quick Start

### With Docker

```bash
# Start PostgreSQL and run ingestion for all services
docker compose up -d postgres
docker compose run pricing-miner ingest --all

# Start PostgreSQL first
docker compose up -d postgres

# Run pricing-miner in detached mode for all services
docker compose up -d pricing-miner

# Or if you want to run it as a one-off with specific options:
docker compose run -d pricing-miner ingest --all

# Or ingest specific services
docker compose run pricing-miner ingest -s AmazonEC2 AmazonRDS AWSLambda
```

### Local Development

```bash
cd pricing-miner

# Install dependencies
npm install

# Copy environment config
cp .env.example .env

# Initialize database
npm run ingest -- init-db

# Ingest all services
npm run ingest -- ingest --all

# Ingest specific services
npm run ingest -- ingest -s AmazonEC2 AmazonRDS

# List available services
npm run ingest -- list-services

# View statistics
npm run ingest -- stats
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `ingest --all` | Ingest all AWS services |
| `ingest -s <services...>` | Ingest specific services |
| `ingest -c <n>` | Set concurrency (default: 3) |
| `ingest -f` | Force refresh even if version exists |
| `list-services` | List all available AWS services |
| `stats` | Show ingestion statistics |
| `init-db` | Initialize database schema |

## Database Schema

### Core Tables

- **`pricing_dimensions`** - Normalized pricing rows (one per billable dimension)
- **`catalog_versions`** - Version tracking for reproducibility
- **`attribute_mappings`** - Auto-learned translation tables (Rosetta)
- **`pricing_overrides`** - Manual price adjustments

### Key Indexes

- `(service, region_code, usage_type)` - Fast pricing lookups
- `(sku)` - SKU-based queries
- `(attributes)` - GIN index for JSON attribute queries

## Architecture

```
┌─────────────────────────────────────────────────┐
│           AWS Pricing Bulk Catalogs              │
│         (JSON, multi-GB, public URLs)            │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│              Pricing Miner (Node.js)             │
│                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────┐ │
│  │ AWS Client  │→ │ Normalizer   │→ │ DB      │ │
│  │ (Streaming) │  │ (Universal)  │  │ (COPY)  │ │
│  └─────────────┘  └──────────────┘  └─────────┘ │
│         │                │                       │
│         ▼                ▼                       │
│  ┌─────────────┐  ┌──────────────┐              │
│  │ Progress    │  │ Rosetta      │              │
│  │ Tracker     │  │ (Auto-Learn) │              │
│  └─────────────┘  └──────────────┘              │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│            PostgreSQL (Pricing Warehouse)        │
│                                                  │
│  pricing_dimensions  attribute_mappings          │
│  catalog_versions    pricing_overrides           │
└─────────────────────────────────────────────────┘
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | localhost | PostgreSQL host |
| `DB_PORT` | 5432 | PostgreSQL port |
| `DB_NAME` | pricing | Database name |
| `DB_USER` | postgres | Database user |
| `DB_PASSWORD` | postgres | Database password |
| `INGESTION_CONCURRENCY` | 3 | Parallel service ingestion |
| `INGESTION_BATCH_SIZE` | 10000 | Batch size for inserts |
| `LOG_LEVEL` | info | Logging level |

## Performance Notes

- EC2 pricing (~600MB JSON): ~2-3 minutes
- Full AWS catalog (~50+ services): ~15-30 minutes
- Total records: ~10-15 million rows

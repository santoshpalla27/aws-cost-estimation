# AWS Pricing Pipeline

**CRITICAL**: This project runs OFFLINE ONLY. It is completely separate from the frontend.

## Purpose

Fetches AWS pricing data from the AWS Pricing API and generates static JSON files that the frontend consumes.

## Requirements

- Node.js >= 18
- AWS credentials configured (via AWS CLI or environment variables)
- Internet connection to access AWS Pricing API

## Installation

```bash
npm install
```

## Usage

### Fetch All Pricing Data

```bash
npm run all
```

This will:
1. Fetch pricing data from AWS Pricing API for EC2 and VPC
2. Normalize data to our pricing contract format
3. Generate static JSON files in `./output/`

### Individual Commands

```bash
npm run fetch      # Fetch from AWS
npm run validate   # Validate output
```

## Output Structure

```
output/
├── ec2/
│   ├── us-east-1.json
│   ├── us-west-2.json
│   ├── eu-west-1.json
│   └── index.json
└── vpc/
    ├── us-east-1.json
    ├── us-west-2.json
    ├── eu-west-1.json
    └── index.json
```

## Pricing Data Contract

All output files conform to the contract defined in `src/contracts/pricing.contract.ts`.

## Adding New Services

1. Create fetcher in `src/fetchers/`
2. Create normalizer in `src/normalizers/`
3. Update `src/index.ts` to include new service

## Important Notes

- This project uses AWS SDK and requires credentials
- It should NEVER be imported into the frontend
- Run this pipeline periodically to update pricing data
- Output files are copied to `../frontend/public/pricing/` for deployment

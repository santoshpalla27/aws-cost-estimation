# Pricing Pipeline - Sample Data Generator

This script generates sample pricing data for development and testing.
For production, run the full pipeline with AWS credentials.

## Usage

```bash
cd pricing-pipeline
npm install
npm run all
```

This will generate sample pricing data in `output/` directory.

## Copy to Frontend

After generation, copy the output to the frontend:

```bash
# From pricing-pipeline directory
cp -r output/* ../public/pricing/
```

Or on Windows:
```powershell
Copy-Item -Path "output\*" -Destination "..\public\pricing\" -Recurse -Force
```

## Sample Data

The sample data includes:
- EC2 instance pricing (t3, m5 families)
- EBS volume pricing (gp3, gp2, io1, io2)
- VPC NAT Gateway pricing
- VPC Endpoint pricing
- Data transfer pricing

## Real Data

To fetch real pricing data from AWS:

1. Configure AWS credentials
2. Run `npm run all`
3. Pipeline will fetch from AWS Pricing API
4. Data will be normalized and output to JSON

**Note**: Fetching real data requires AWS credentials and may take several minutes.

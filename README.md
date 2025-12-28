# AWS Cost Estimator

Production-grade, schema-driven AWS cost estimation calculator that runs entirely in the browser.

## 🎯 Features

- **Schema-Driven Architecture**: All service configurations, dependencies, and pricing logic defined in JSON schemas
- **No Backend Required**: Fully static, runs entirely in the browser
- **AWS Console Depth**: Comprehensive configuration options matching AWS Console complexity
- **Dependency Resolution**: Automatic field visibility and validation based on configuration
- **Usage Modeling**: Adjustable usage dimensions with preset profiles (low/medium/high)
- **Real-Time Cost Calculation**: Instant cost updates as you configure
- **Explainable Estimates**: Detailed cost breakdowns with line-item transparency
- **Export Capabilities**: Export estimates to JSON or CSV

## 🏗️ Architecture

### Core Principles

1. **Schema is the Source of Truth**: No hard-coded UI logic, all driven by schemas
2. **Frontend-Only at Runtime**: No live AWS API calls, uses pre-generated static pricing data
3. **Production-Grade**: Built for real engineers estimating production AWS costs

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Runtime)                        │
├─────────────────────────────────────────────────────────────┤
│  React Frontend                                              │
│  ├── Schema-Driven Service Configurator                     │
│  ├── Dependency Resolution Engine                           │
│  ├── Usage Modeling Engine                                  │
│  ├── Cost Calculation Engine                                │
│  └── Pricing Lookup Engine                                  │
│                                                              │
│  Static Pricing Data (JSON)                                 │
│  ├── ec2/                                                    │
│  ├── vpc/                                                    │
│  └── shared/                                                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              Build-Time / Offline Pipeline                   │
├─────────────────────────────────────────────────────────────┤
│  AWS Pricing API                                             │
│  ├── Product Filtering                                       │
│  ├── Attribute Normalization                                │
│  ├── SKU Flattening                                         │
│  ├── Schema-Attribute Matching                              │
│  └── Static JSON Generation                                 │
└─────────────────────────────────────────────────────────────┘
```

## 📦 Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## 🚀 Quick Start

1. **Select a Service**: Choose from VPC, EC2, or other available services
2. **Choose Region**: Select your AWS region
3. **Configure Service**: Fill in configuration options (dependencies auto-resolve)
4. **Adjust Usage**: Use sliders or presets to set usage assumptions
5. **View Costs**: See real-time cost breakdown with line items
6. **Export**: Download estimate as JSON or CSV

## 📋 Schema System

### Schema Structure

Each AWS service has a JSON schema defining:

- **Fields**: Configuration options with types, validation, dependencies
- **Groups**: Logical grouping of fields for UI organization
- **Usage Dimensions**: Billable usage metrics (hours, GB, requests, etc.)
- **Pricing Dimensions**: Mapping to pricing data attributes
- **Cost Formulas**: Expressions for calculating costs

### Example Schema Snippet

```json
{
  "service": "vpc",
  "fields": [
    {
      "id": "nat_gateway_mode",
      "label": "NAT Gateway Configuration",
      "type": "enum",
      "required": false,
      "visibleWhen": {
        "operator": "gt",
        "field": "private_subnets",
        "value": 0
      },
      "options": [
        { "value": "none", "label": "None" },
        { "value": "single", "label": "Single NAT Gateway" },
        { "value": "per_az", "label": "NAT Gateway per AZ" }
      ]
    }
  ],
  "usage": [
    {
      "id": "nat_data_processed_gb",
      "label": "NAT Gateway Data Processed",
      "unit": "GB/month",
      "type": "slider",
      "min": 0,
      "max": 10000,
      "default": 100,
      "presets": {
        "low": 50,
        "medium": 500,
        "high": 2000
      }
    }
  ],
  "formulas": [
    {
      "id": "nat_gateway_hours",
      "label": "NAT Gateway - Hourly Charges",
      "formula": "nat_gateway_hourly * HOURS_PER_MONTH * (nat_gateway_mode === 'single' ? 1 : nat_gateway_mode === 'per_az' ? availability_zones : 0)",
      "unit": "USD/month"
    }
  ]
}
```

## 🔧 Core Engines

### 1. Dependency Engine

Evaluates conditional expressions to determine field visibility and enablement.

**Supported Operators**: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `nin`, `and`, `or`, `not`

**Features**:
- Dependency graph building
- Cycle detection
- Cascading updates

### 2. Usage Engine

Manages usage dimensions and preset profiles.

**Features**:
- Preset profiles (low/medium/high)
- Calculated dimensions with formulas
- Range validation
- Formula evaluation

### 3. Pricing Engine

Loads and queries static pricing data.

**Features**:
- Attribute-based lookups
- Tiered pricing support
- Pricing data indexing
- Version tracking

### 4. Calculator Engine

Evaluates cost formulas and generates breakdowns.

**Features**:
- Formula parsing and evaluation
- Line-item breakdowns
- Monthly/annual conversion
- Export to JSON/CSV

## 📊 Pricing Data Pipeline

The pricing pipeline (runs offline) fetches data from AWS Pricing API and generates static JSON files.

### Running the Pipeline

```bash
# Fetch pricing data from AWS
npm run pipeline:fetch

# Process and normalize data
npm run pipeline:process

# Run complete pipeline
npm run pipeline:all
```

### Pipeline Stages

1. **Fetch**: Download pricing data from AWS Pricing API
2. **Filter**: Extract only relevant products and SKUs
3. **Normalize**: Standardize attributes and units
4. **Match**: Align with schema attribute definitions
5. **Generate**: Create static JSON files in `/public/pricing/`

## 🎨 UI Components

### ServiceConfigurator

Schema-driven form renderer with:
- Automatic field rendering based on type
- Conditional visibility
- Dependency warnings
- Field grouping and collapsing

### DynamicField

Renders individual form fields:
- String, number, boolean, enum, multiselect
- Validation feedback
- Help text and warnings

### UsageSlider

Usage dimension control:
- Slider with numeric input
- Preset buttons
- Unit display

### CostBreakdown

Cost display panel:
- Total cost (monthly/annual)
- Expandable line items
- Usage assumptions
- Export functionality

## 🌐 Supported Services

### Amazon VPC
- Subnets (public, private, database)
- Internet Gateway
- NAT Gateway (single or per-AZ)
- VPC Endpoints (Gateway and Interface)
- VPC Flow Logs
- Transit Gateway
- VPC Peering

### Amazon EC2
- Instance families and sizes
- Operating systems (Linux, Windows, RHEL, etc.)
- Tenancy options
- EBS volumes (gp3, gp2, io1, io2, st1, sc1)
- Elastic IP
- Detailed monitoring

## 🔮 Adding New Services

1. **Create Schema**: Define service schema in `/src/schemas/`
2. **Add Pricing Processor**: Implement processor in `/pipeline/src/processors/`
3. **Run Pipeline**: Generate pricing data
4. **Add to App**: Register service in `App.tsx`

## 📝 Development

### Project Structure

```
aws-estimation-ui/
├── src/
│   ├── types/           # TypeScript type definitions
│   ├── schemas/         # Service schemas
│   ├── engine/          # Core calculation engines
│   ├── ui/              # React components
│   ├── App.tsx          # Main application
│   ├── main.tsx         # Entry point
│   └── index.css        # Design system
├── pipeline/            # Pricing data pipeline
│   └── src/
│       ├── fetcher.ts
│       ├── processors/
│       └── generator.ts
├── public/
│   └── pricing/         # Generated pricing data
└── package.json
```

### Technology Stack

- **Frontend**: React 18 + TypeScript 5
- **Build Tool**: Vite
- **Validation**: Zod
- **Styling**: Vanilla CSS (no framework)
- **Pipeline**: Node.js + AWS SDK v3

## ⚠️ Important Notes

### Accuracy

- Estimates are based on AWS public pricing
- Actual costs may vary based on usage patterns
- Does not include all AWS pricing nuances (Reserved Instances, Savings Plans, etc.)
- Pricing data must be kept up-to-date via pipeline

### Limitations

- No live AWS API calls at runtime
- Limited to pre-configured services
- Simplified tiered pricing model
- No support for custom pricing agreements

## 🤝 Contributing

To add a new AWS service:

1. Study AWS pricing documentation
2. Create comprehensive schema with all configuration options
3. Implement pricing processor
4. Test against AWS Pricing Calculator
5. Document assumptions and limitations

## 📄 License

MIT

## 🙏 Acknowledgments

Built with production-grade standards for real AWS cost estimation needs.

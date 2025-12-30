# AWS Cost Estimation Platform

Production-grade Terraform cost estimation with explainability and auditability.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Frontend  │────▶│ Cost Engine  │────▶│  PostgreSQL │
│ (React+Nginx)│     │     (Go)     │     │  (Pricing)  │
└─────────────┘     └──────────────┘     └─────────────┘
       │                    │
       └────── API ─────────┘
```

## Quick Start

### Option 1: Full Stack (Docker Compose)

```bash
# Start all services
docker-compose up --build

# Access:
# - Frontend: http://localhost:3000
# - Backend API: http://localhost:8080
# - Database: localhost:5432
```

### Option 2: Development Mode

**Backend:**
```bash
cd cost-engine
go run cmd/main.go server --port 8080
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# Visit http://localhost:5173
```

## Services

### Frontend (Port 3000)
- React 18 + TypeScript
- Tailwind CSS
- Nginx reverse proxy
- Proxies `/api` to backend

### Cost Engine (Port 8080)
- Go HTTP server
- Terraform parsing
- Cost calculation
- Policy evaluation

### PostgreSQL (Port 5432)
- AWS pricing data
- Catalog versioning
- Attribute mappings

## Components

### 1. Pricing Miner (Node.js)
```bash
cd pricing-miner
npm run ingest lambda us-east-1
```

### 2. Cost Engine (Go)
```bash
cd cost-engine
go run cmd/main.go estimate --plan plan.json
```

### 3. Frontend (React)
- Upload Terraform projects
- View cost estimates
- Explainability panels
- Diff viewer
- Policy results

## Docker Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f frontend
docker-compose logs -f cost-engine

# Rebuild specific service
docker-compose up --build frontend

# Stop all
docker-compose down

# Clean volumes
docker-compose down -v
```

## Development Workflow

1. **Start Database**
   ```bash
   docker-compose up -d postgres
   ```

2. **Ingest Pricing Data**
   ```bash
   cd pricing-miner
   npm run ingest lambda us-east-1
   ```

3. **Start Backend**
   ```bash
   cd cost-engine
   go run cmd/main.go server
   ```

4. **Start Frontend**
   ```bash
   cd frontend
   npm run dev
   ```

## Production Deployment

### Build Images

```bash
# Build backend
docker build -t aws-cost-engine:latest ./cost-engine

# Build frontend
docker build -t aws-cost-frontend:latest ./frontend
```

### Deploy

```bash
docker-compose -f docker-compose.yml up -d
```

## Environment Variables

### Backend
- `DATABASE_URL` - PostgreSQL connection string
- `PORT` - Server port (default: 8080)
- `EVALUATION_MODE` - STRICT/CONSERVATIVE/OPTIMISTIC
- `CORS_ORIGINS` - Allowed CORS origins

### Frontend
- `VITE_API_BASE_URL` - Backend API URL

## Architecture Principles

### Non-Negotiable
1. ✅ No silent defaults
2. ✅ No hidden mocks
3. ✅ No hardcoded pricing
4. ✅ Determinism (same input = same output)
5. ✅ Explainability (every dollar traceable)
6. ✅ Auditability (full metadata)

### Frontend Principles  
1. ❌ No Terraform interpretation
2. ❌ No file modification
3. ❌ No directory flattening
4. ✅ Backend is source of truth
5. ✅ Structure preservation
6. ✅ Full explainability

## API Endpoints

```
POST   /api/estimate    - Upload Terraform ZIP
POST   /api/diff        - Compare two projects
POST   /api/policy      - Evaluate policies
GET    /health          - Health check
```

## File Structure

```
aws-cost-estimation/
├── frontend/              # React UI
│   ├── src/
│   ├── Dockerfile
│   └── nginx.conf
├── cost-engine/           # Go backend
│   ├── cmd/
│   ├── pkg/
│   └── Dockerfile
├── pricing-miner/         # Node.js pricing
│   └── src/
├── database/
│   └── migrations/
└── docker-compose.yml
```

## Testing

### Backend
```bash
cd cost-engine
go test ./...
```

### Frontend
```bash
cd frontend
npm run build
```

## Troubleshooting

### Frontend can't reach backend
- Check CORS_ORIGINS in cost-engine environment
- Verify backend is running on port 8080
- Check nginx proxy configuration

### Database connection failed
- Ensure PostgreSQL is running
- Check DATABASE_URL
- Verify network connectivity

### Upload fails
- Check file size (max 500MB)
- Verify Terraform files exist
- Check backend logs

## License

MIT

## Contributing

1. Follow non-negotiable principles
2. Include tests
3. Maintain determinism
4. Update documentation

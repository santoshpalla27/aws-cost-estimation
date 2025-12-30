# AWS Cost Estimation Frontend

Production-grade React frontend for Terraform cost estimation.

## Features

✅ **Folder/ZIP/File Upload** - Drag-drop or click to select  
✅ **Structure Preservation** - No file modification, exact ZIP mirroring  
✅ **Real-time Progress** - Upload progress tracking  
✅ **Cost Visualization** - Charts, tables, breakdowns  
✅ **Confidence Tracking** - HIGH/MEDIUM/LOW indicators  
✅ **Explainability** - Formula display, assumptions, mocks  
✅ **Diff Viewer** - Compare before/after costs  
✅ **Policy Results** - Pass/warn/fail display  
✅ **Audit Trail** - Reproducibility metadata  
✅ **JSON Export** - Download complete estimate

## Tech Stack

- **Framework**: React 18 + TypeScript
- **Build**: Vite
- **Styling**: Tailwind CSS
- **State**: Zustand
- **Charts**: Recharts
- **Routing**: React Router
- **Upload**: react-dropzone
- **ZIP**: JSZip
- **HTTP**: Axios

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server (proxies to backend on :8080)
npm run dev

# Build for production
npm run build
```

## Project Structure

```
src/
├── api/
│   ├── client.ts          # Axios setup
│   └── costEngine.ts      # API functions
├── app/
│   ├── routes.tsx         # React Router config
│   └── store.ts           # Zustand store
├── components/
│   ├── UploadZone/        # File upload widget
│   ├── CostSummary/       # Total cost display
│   ├── ServiceBreakdown/  # Charts & tables
│   ├── ResourceTable/     # Expandable resource list
│   ├── ConfidenceBadge/   # Confidence indicator
│   ├── ExplainabilityPanel/ # Assumptions & mocks
│   ├── DiffViewer/        # Cost comparison
│   ├── PolicyResults/     # Policy pass/fail
│   └── AuditPanel/        # Metadata & export
├── pages/
│   ├── UploadPage.tsx     # Home page
│   └── ResultsPage.tsx    # Results display
├── types/
│   └── api.ts             # TypeScript definitions
├── utils/
│   ├── zipBuilder.ts      # ZIP creation
│   └── fileValidation.ts  # Structure validation
└── main.tsx               # Entry point
```

## Environment Variables

Create `.env`:

```
VITE_API_BASE_URL=http://localhost:8080
```

## Core Principles (NON-NEGOTIABLE)

1. ❌ **No Terraform interpretation** - Frontend never parses .tf files
2. ❌ **No file modification** - Directory structure preserved byte-for-byte
3. ❌ **No hidden assumptions** - Everything is explicit and inspectable
4. ✅ **Backend is source of truth** - All logic in cost-engine
5. ✅ **Deterministic** - Same input = same output
6. ✅ **Stateless** - No session data, no persistence

## Usage

### 1. Upload Project

- **Option A**: Drag folder onto upload zone
- **Option B**: Click "Select Folder"
- **Option C**: Upload ZIP file
- **Option D**: Select .tf files

### 2. Configure Evaluation Mode

- **STRICT**: Fail if any value is missing
- **CONSERVATIVE**: Higher cost estimates (default)
- **OPTIMISTIC**: Lower cost estimates

### 3. Review Results

- Total monthly cost
- Per-service breakdown
- Per-resource costs
- Confidence levels
- Assumptions made
- Mocked values

### 4. Export

- Download full JSON
- Copy audit info
- Share estimate ID

## API Integration

All requests go to `/api/*` endpoints:

```typescript
POST /api/estimate     // Upload project ZIP
POST /api/diff         // Compare two projects
POST /api/policy       // Evaluate policies
GET /health            // Health check
```

Vite proxies these to `http://localhost:8080` in development.

## Build & Deploy

```bash
# Production build
npm run build

# Output: dist/
# Serve with any static host (Nginx, Vercel, Netlify, etc.)
```

## Success Criteria

The frontend is complete ONLY if:

✅ Folder upload preserves structure  
✅ ZIP upload works identically  
✅ Backend receives unchanged project  
✅ Results are fully explainable  
✅ Confidence is visible everywhere  
✅ No silent failures  
✅ Audit trail is complete  

## Failure Conditions

The frontend FAILS if:

❌ Terraform files are modified  
❌ Directory structure is altered  
❌ Cost logic leaks into UI  
❌ Results are not explainable  
❌ Missing confidence indicators  
❌ Silent failures occur  

## Development

```bash
# Start backend first
cd ../cost-engine
go run cmd/main.go server

# Then start frontend
cd ../frontend
npm run dev
```

Visit http://localhost:5173

## License

MIT

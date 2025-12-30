# HTTP API Test Script

## Test Health Endpoint

```bash
curl http://localhost:8080/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "service": "aws-cost-engine"
}
```

## Test Estimate Endpoint

### 1. Create Test Terraform File

Create `test-project/main.tf`:
```hcl
resource "aws_instance" "web" {
  ami           = "ami-12345678"
  instance_type = "t3.micro"
}
```

### 2. Create ZIP

```bash
# On Windows (PowerShell)
Compress-Archive -Path test-project\* -DestinationPath project.zip

# On Linux/macOS  
zip -r project.zip test-project
```

### 3. Upload to API

```bash
curl -X POST http://localhost:8080/api/estimate \
  -F "project_zip=@project.zip" \
  -F "evaluation_mode=CONSERVATIVE"
```

**Expected Response:**
```json
{
  "estimate": {
    "id": "uuid...",
    "total_cost": 7.59,
    "currency": "USD",
    "confidence": "MEDIUM",
    "service_breakdown": {
      "AmazonEC2": 7.59
    },
    "resources": [...],
    "cost_items": [...],
    "assumptions": [...]
  }
}
```

## Test with Postman

1. **Method:** POST
2. **URL:** http://localhost:8080/api/estimate
3. **Body:** form-data
   - Key: `project_zip` | Type: File | Value: [select project.zip]
   - Key: `evaluation_mode` | Type: Text | Value: CONSERVATIVE

## Test CORS

From browser console (navigate to http://localhost:5173):

```javascript
fetch('http://localhost:8080/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

Should work without CORS errors.

## Test Diff Endpoint

```bash
curl -X POST http://localhost:8080/api/diff \
  -F "before_zip=@before.zip" \
  -F "after_zip=@after.zip"
```

## Test Policy Endpoint

Create `policy.json`:
```json
{
  "policies": [
    {
      "name": "Total Budget",
      "type": "TOTAL_BUDGET",
      "max_cost": 100.00,
      "warn_threshold": 80.00
    }
  ]
}
```

```bash
curl -X POST http://localhost:8080/api/policy \
  -F "project_zip=@project.zip" \
  -F "policy_file=@policy.json"
```

## Start Server Locally

```bash
cd cost-engine

# Set environment variables
$env:DATABASE_URL="postgresql://cost_user:cost_password_dev_only@localhost:5432/aws_cost_estimation"
$env:CORS_ORIGINS="http://localhost:5173,http://localhost:3000"

# Run server
go run cmd/main.go server --port 8080
```

## Common Errors

### "Missing project_zip file"
- Ensure the form field name is exactly `project_zip`
- Check that the file is being sent as multipart/form-data

### "No .tf files found"
- Verify the ZIP contains .tf files
- Check ZIP structure (files should be at root or in subdirectories)

### CORS Error
- Check CORS_ORIGINS environment variable
- Ensure your frontend origin is listed

### "Failed to connect to database"
- Ensure PostgreSQL is running
- Check DATABASE_URL is correct
- Verify database schema is migrated

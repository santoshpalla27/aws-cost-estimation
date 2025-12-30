# Policy Definitions Example

This file demonstrates policy configuration for budget enforcement and resource limits.

## Format

Policies are defined as JSON with the following structure:

```json
{
  "policies": [
    {
      "name": "Policy Name",
      "type": "POLICY_TYPE",
      "... type-specific fields ..."
    }
  ]
}
```

## Policy Types

### 1. SERVICE_BUDGET
Enforces budget cap on a specific AWS service.

```json
{
  "name": "EC2 Monthly Budget",
  "type": "SERVICE_BUDGET",
  "service": "AmazonEC2",
  "max_cost": 1000.00,
  "warn_threshold": 800.00
}
```

### 2. TOTAL_BUDGET
Enforces total infrastructure budget cap.

```json
{
  "name": "Total Infrastructure Budget",
  "type": "TOTAL_BUDGET",
  "max_cost": 5000.00,
  "warn_threshold": 4500.00
}
```

### 3. RESOURCE_COUNT
Limits number of resources of a specific type.

```json
{
  "name": "EC2 Instance Limit",
  "type": "RESOURCE_COUNT",
  "resource_type": "aws_instance",
  "max_count": 10
}
```

### 4. PERCENTAGE_GROWTH
Limits cost growth compared to previous estimate (requires historical data).

```json
{
  "name": "Cost Growth Limit",
  "type": "PERCENTAGE_GROWTH",
  "max_growth": 0.20
}
```

## Complete Example

```json
{
  "policies": [
    {
      "name": "EC2 Budget Cap",
      "type": "SERVICE_BUDGET",
      "service": "AmazonEC2",
      "max_cost": 2000.00,
      "warn_threshold": 1600.00
    },
    {
      "name": "RDS Budget Cap",
      "type": "SERVICE_BUDGET",
      "service": "AmazonRDS",
      "max_cost": 1500.00,
      "warn_threshold": 1200.00
    },
    {
      "name": "Lambda Budget Cap",
      "type": "SERVICE_BUDGET",
      "service": "AWSLambda",
      "max_cost": 500.00,
      "warn_threshold": 400.00
    },
    {
      "name": "Total Infrastructure Budget",
      "type": "TOTAL_BUDGET",
      "max_cost": 10000.00,
      "warn_threshold": 8000.00
    },
    {
      "name": "EC2 Instance Count",
      "type": "RESOURCE_COUNT",
      "resource_type": "aws_instance",
      "max_count": 20
    },
    {
      "name": "RDS Instance Count",
      "type": "RESOURCE_COUNT",
      "resource_type": "aws_db_instance",
      "max_count": 5
    },
    {
      "name": "Monthly Cost Growth",
      "type": "PERCENTAGE_GROWTH",
      "max_growth": 0.15
    }
  ]
}
```

## Policy Outcomes

Each policy evaluation produces one of three outcomes:

- **PASS** ✅: Resource usage and costs are within limits
- **WARN** ⚠️: Approaching limits (based on warn_threshold)
- **FAIL** ❌: Exceeds limits (will cause CI to fail if `--fail-on-violation` is set)

## CI/CD Integration

### GitHub Actions
```yaml
- name: Check Cost Policy
  run: |
    cost-engine policy --plan plan.json --policy-file policy.json --format ci
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

### Exit Codes
- `0`: All policies passed (or only warnings)
- `1`: One or more policies failed

### Fail on Violation
By default, the `policy` command exits with code 1 if any policy fails. To change this:

```bash
cost-engine policy --plan plan.json --fail-on-violation=false
```

## Best Practices

1. **Start Conservative**: Begin with high limits and adjust based on actual usage
2. **Use Warnings**: Set warn_threshold at 80% of max_cost for early alerts
3. **Service-Level Budgets**: Break down total budget by service for better control
4. **Resource Limits**: Prevent runaway resource creation
5. **Version Control**: Keep policy.json in git for audit trail
6. **Environment-Specific**: Use different policies for dev/staging/prod

## Example Output

```
╔════════════════════════════════════════════════════════════╗
║           POLICY EVALUATION RESULTS                        ║
╚════════════════════════════════════════════════════════════╝

Total Cost: $3,245.67/mo

✓ EC2 Budget Cap: AmazonEC2 cost $1,850.00 within budget of $2,000.00
⚠ RDS Budget Cap: AmazonRDS cost $1,250.00 exceeds warning threshold of $1,200.00
✓ Total Infrastructure Budget: Total cost $3,245.67 within budget of $10,000.00
✓ EC2 Instance Count: 8 aws_instance resources within limit of 20

Summary: 3 passed, 1 warnings, 0 failed

⚠️  POLICY EVALUATION PASSED WITH WARNINGS
```

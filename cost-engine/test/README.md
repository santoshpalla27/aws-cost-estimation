# Golden Test Suite

This directory contains golden test cases for deterministic cost estimation validation.

## Structure

```
test/
├── golden_test.go          # Test runner
├── testdata/
│   ├── plans/              # Terraform plan JSON files
│   │   ├── ec2-01-simple.json
│   │   ├── ec2-02-count.json
│   │   ├── ec2-03-no-region.json
│   │   ├── ec2-04-nat.json
│   │   ├── ec2-05-strict.json
│   │   ├── ec2-06-ambiguous.json
│   │   └── ec2-07-diff-before.json
│   └── golden/             # Expected outputs
│       ├── ec2-01-simple-explicit.json
│       ├── ec2-02-count-expansion.json
│       └── ...
```

## Test Cases

### EC2-01: Simple Explicit Instance
- **Input:** Single t3.micro with explicit region, gp3 20GB
- **Expected:** HIGH confidence, $9.19/month
- **Validates:** Basic pricing, explicit values

### EC2-02: Count Expansion
- **Input:** 3× t3.small instances
- **Expected:** 3 resources, $45.63/month (3× cost)
- **Validates:** Count expansion logic

### EC2-03: Missing Region
- **Input:** Instance without region
- **Expected:** MEDIUM confidence, mocker injects us-east-1
- **Validates:** Mocker region injection, confidence degradation

### EC2-04: NAT Inference
- **Input:** EC2 in private subnet + NAT gateway
- **Expected:** NAT cost included
- **Validates:** Implicit infrastructure detection

### EC2-05: STRICT Mode Failure
- **Input:** Missing required value in STRICT mode
- **Expected:** ERROR (test expects failure)
- **Validates:** Evaluation mode enforcement

### EC2-06: Pricing Ambiguity
- **Input:** Multiple SKUs match with similar scores
- **Expected:** Ambiguity warning surfaced
- **Validates:** Pricing match scoring and ambiguity detection

### EC2-07: Diff Test
- **Input:** Two plan files (before/after instance type change)
- **Expected:** Accurate delta calculation
- **Validates:** Diff engine accuracy

## Running Tests

```bash
# Run all golden tests
cd cost-engine
go test ./test -v

# Run specific test
go test ./test -v -run TestGoldenCases/ec2-01-simple-explicit

# Update golden files (use with caution!)
# Set UPDATE_GOLDEN=1 environment variable
UPDATE_GOLDEN=1 go test ./test -v
```

## Updating Golden Files

Golden files should ONLY be updated when:
1. Pricing data changes intentionally
2. Cost calculation logic is deliberately modified
3. Output format changes

**Never update golden files to make failing tests pass without understanding why.**

## CI Integration

These tests run in CI on every PR. Any golden file changes must be:
1. Explicitly committed
2. Reviewed by team
3. Justified in PR description

## Determinism Requirements

Each test must be:
- **Fixed input:** Same Terraform plan JSON
- **Fixed mode:** Same evaluation mode
- **Fixed catalog:** Same pricing catalog version
- **Exact output:** Bit-for-bit identical JSON (except timestamps/IDs)

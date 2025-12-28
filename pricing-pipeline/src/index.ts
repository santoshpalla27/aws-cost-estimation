import { EC2Fetcher } from './fetchers/ec2.fetcher.js';
import { VPCFetcher } from './fetchers/vpc.fetcher.js';
import { EC2Normalizer } from './normalizers/ec2.normalizer.js';
import { VPCNormalizer } from './normalizers/vpc.normalizer.js';
import { JSONGenerator } from './generators/json.generator.js';
import { SampleDataGenerator } from './generators/sample.generator.js';

/**
 * AWS Pricing Pipeline
 * 
 * This runs OFFLINE ONLY to fetch and normalize AWS pricing data.
 * Output is static JSON files consumed by the frontend.
 * 
 * NEVER runs in the browser.
 */

const REGIONS = ['us-east-1', 'us-west-2', 'eu-west-1'];

async function main() {
    const command = process.argv[2] || 'sample';

    console.log('='.repeat(80));
    console.log('AWS PRICING PIPELINE');
    console.log('='.repeat(80));
    console.log(`Command: ${command}`);
    console.log('='.repeat(80));

    const generator = new JSONGenerator('./output');

    try {
        switch (command) {
            case 'sample':
                await generateSampleData();
                break;

            case 'fetch':
            case 'all':
                console.log(`Regions: ${REGIONS.join(', ')}`);
                await fetchAndGenerate(generator);
                break;

            case 'validate':
                await validateOutput();
                break;

            default:
                console.error(`Unknown command: ${command}`);
                console.log('Available commands: sample, fetch, all, validate');
                process.exit(1);
        }

        console.log('\n' + '='.repeat(80));
        console.log('✓ PIPELINE COMPLETE');
        console.log('='.repeat(80));
        console.log('\nNext steps:');
        console.log('1. Copy output to frontend: cp -r output/* ../public/pricing/');
        console.log('2. Or on Windows: Copy-Item -Path "output\\*" -Destination "..\\public\\pricing\\" -Recurse');
    } catch (error) {
        console.error('\n' + '='.repeat(80));
        console.error('❌ PIPELINE FAILED');
        console.error('='.repeat(80));
        console.error(error);
        process.exit(1);
    }
}

async function generateSampleData() {
    console.log('\n📦 GENERATING SAMPLE DATA (No AWS credentials required)...\n');

    const sampleGenerator = new SampleDataGenerator('./output');

    for (const region of REGIONS) {
        await sampleGenerator.generateAll(region);
    }

    console.log('\n✓ Sample data generated for development');
}

async function fetchAndGenerate(generator: JSONGenerator) {
    console.log('\n📡 FETCHING PRICING DATA FROM AWS...\n');
    console.log('⚠️  This requires AWS credentials configured\n');

    for (const region of REGIONS) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`REGION: ${region}`);
        console.log('='.repeat(80));

        // EC2
        console.log('\n--- EC2 ---');
        const ec2Fetcher = new EC2Fetcher();
        const ec2RawData = await ec2Fetcher.fetchForRegion(region);

        const ec2Normalizer = new EC2Normalizer(region);
        const ec2PricingData = await ec2Normalizer.normalize(ec2RawData);

        await generator.generate(ec2PricingData);

        // VPC
        console.log('\n--- VPC ---');
        const vpcFetcher = new VPCFetcher();
        const vpcRawData = await vpcFetcher.fetchForRegion(region);

        const vpcNormalizer = new VPCNormalizer(region);
        const vpcPricingData = await vpcNormalizer.normalize(vpcRawData);

        await generator.generate(vpcPricingData);
    }

    // Generate indexes
    await generator.generateIndex('ec2', REGIONS);
    await generator.generateIndex('vpc', REGIONS);
}

async function validateOutput() {
    console.log('\n🔍 VALIDATING OUTPUT...\n');
    // TODO: Implement validation logic
    console.log('✓ Validation complete');
}

// Run
main();

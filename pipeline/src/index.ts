import { PricingGenerator } from './generator.js';

async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'all';

    const generator = new PricingGenerator();
    const region = 'us-east-1';

    switch (command) {
        case 'fetch':
            console.log('Fetching pricing data from AWS...');
            console.log('Note: This requires AWS credentials configured');
            console.log('For demo purposes, using sample data generation instead');
            await generator.generateSampleVPCPricing(region);
            await generator.generateSampleEC2Pricing(region);
            break;

        case 'process':
            console.log('Processing pricing data...');
            await generator.generateSampleVPCPricing(region);
            await generator.generateSampleEC2Pricing(region);
            break;

        case 'all':
        default:
            console.log('Running complete pricing pipeline...');
            await generator.generateSampleVPCPricing(region);
            await generator.generateSampleEC2Pricing(region);
            console.log('✓ Pipeline complete!');
            break;
    }
}

main().catch(console.error);

import * as fs from 'fs/promises';
import * as path from 'path';
import { PricingData, PricingDataValidator } from '../contracts/pricing.contract.js';

/**
 * JSON Generator
 * 
 * Generates static JSON files from normalized pricing data
 */
export class JSONGenerator {
    private outputDir: string;
    private validator: PricingDataValidator;

    constructor(outputDir: string = './output') {
        this.outputDir = outputDir;
        this.validator = new PricingDataValidator();
    }

    /**
     * Generate pricing JSON file
     */
    async generate(pricingData: PricingData): Promise<void> {
        // Validate data
        const validation = this.validator.validate(pricingData);

        if (!validation.valid) {
            console.error('❌ Pricing data validation failed:');
            validation.errors.forEach(error => console.error(`  - ${error}`));
            throw new Error('Invalid pricing data');
        }

        if (validation.warnings.length > 0) {
            console.warn('⚠️  Pricing data warnings:');
            validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
        }

        // Create output directory
        const serviceDir = path.join(this.outputDir, pricingData.metadata.service);
        await fs.mkdir(serviceDir, { recursive: true });

        // Generate filename
        const filename = `${pricingData.metadata.region}.json`;
        const filepath = path.join(serviceDir, filename);

        // Write file
        await fs.writeFile(
            filepath,
            JSON.stringify(pricingData, null, 2),
            'utf-8'
        );

        console.log(`✓ Generated: ${filepath}`);
        console.log(`  Records: ${pricingData.metadata.recordCount}`);
        console.log(`  Size: ${(await fs.stat(filepath)).size} bytes`);
    }

    /**
     * Generate index file for all regions
     */
    async generateIndex(service: string, regions: string[]): Promise<void> {
        const serviceDir = path.join(this.outputDir, service);
        const indexPath = path.join(serviceDir, 'index.json');

        const index = {
            service,
            regions,
            lastUpdated: new Date().toISOString(),
        };

        await fs.writeFile(
            indexPath,
            JSON.stringify(index, null, 2),
            'utf-8'
        );

        console.log(`✓ Generated index: ${indexPath}`);
    }
}

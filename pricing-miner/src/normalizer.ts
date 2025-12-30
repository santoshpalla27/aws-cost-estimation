import { database } from './database';
import { logger } from './logger';
import { config } from './config';
import { ParsedPrice, PricingDimension } from './types';

export class Normalizer {
    /**
     * Normalize and insert pricing data into database
     * Handles batch insertion for performance
     */
    async normalize(
        prices: AsyncGenerator<ParsedPrice>,
        catalogVersionId: string
    ): Promise<number> {
        let batch: any[][] = [];
        let totalInserted = 0;

        const columns = [
            'catalog_version',
            'service',
            'region_code',
            'sku',
            'usage_type',
            'operation',
            'unit',
            'price_per_unit',
            'begin_range',
            'end_range',
            'term_type',
            'lease_contract_length',
            'purchase_option',
            'offering_class',
            'effective_date',
            'attributes',
        ];

        for await (const price of prices) {
            const row = [
                catalogVersionId,
                price.service,
                price.regionCode,
                price.sku,
                price.usageType,
                price.operation,
                price.unit,
                price.pricePerUnit,
                price.beginRange,
                price.endRange,
                price.termType,
                price.leaseContractLength,
                price.purchaseOption,
                price.offeringClass,
                price.effectiveDate,
                JSON.stringify(price.attributes),
            ];

            batch.push(row);

            // Batch insert when batch size reached
            if (batch.length >= config.batchInsertSize) {
                await this.insertBatch(columns, batch);
                totalInserted += batch.length;
                logger.debug('Inserted batch', { count: batch.length, total: totalInserted });
                batch = [];
            }
        }

        // Insert remaining items
        if (batch.length > 0) {
            await this.insertBatch(columns, batch);
            totalInserted += batch.length;
        }

        logger.info('Normalization completed', { totalInserted });
        return totalInserted;
    }

    private async insertBatch(columns: string[], rows: any[][]): Promise<void> {
        await database.batchInsert(
            'pricing_dimensions',
            columns,
            rows,
            'ON CONFLICT (catalog_version, service, region_code, sku, usage_type, term_type, begin_range, COALESCE(end_range, -1)) DO NOTHING'
        );
    }

    /**
     * Extract attribute mappings from pricing data
     * This automatically discovers region names, OS types, etc.
     */
    async extractMappings(prices: AsyncGenerator<ParsedPrice>): Promise<void> {
        const regionMappings = new Map<string, string>();
        const osMappings = new Map<string, string>();
        const tenancyMappings = new Map<string, string>();

        for await (const price of prices) {
            const attrs = price.attributes;

            // Extract region mapping
            if (attrs.location && price.regionCode) {
                regionMappings.set(price.regionCode, attrs.location);
            }

            // Extract OS mapping
            if (attrs.operatingSystem) {
                const osKey = attrs.operatingSystem.toLowerCase();
                osMappings.set(osKey, attrs.operatingSystem);
            }

            // Extract tenancy mapping
            if (attrs.tenancy) {
                const tenancyKey = attrs.tenancy.toLowerCase();
                tenancyMappings.set(tenancyKey, attrs.tenancy);
            }
        }

        // Insert mappings
        await this.insertMappings('REGION', regionMappings);
        await this.insertMappings('OS', osMappings);
        await this.insertMappings('TENANCY', tenancyMappings);

        logger.info('Extracted mappings', {
            regions: regionMappings.size,
            os: osMappings.size,
            tenancy: tenancyMappings.size,
        });
    }

    private async insertMappings(type: string, mappings: Map<string, string>): Promise<void> {
        for (const [code, value] of mappings) {
            await database.query(
                `INSERT INTO attribute_mappings (mapping_type, input_code, target_value)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (mapping_type, input_code, COALESCE(service, '')) DO NOTHING`,
                [type, code, value]
            );
        }
    }

    /**
     * Validate pricing data integrity
     */
    async validatePricingData(catalogVersionId: string): Promise<{
        isValid: boolean;
        errors: string[];
    }> {
        const errors: string[] = [];

        // Check 1: No duplicate SKUs in same version
        const duplicateCheck = await database.query(
            `SELECT sku, usage_type, COUNT(*) as count
             FROM pricing_dimensions
             WHERE catalog_version = $1
             GROUP BY sku, usage_type, term_type, begin_range, COALESCE(end_range, -1)
             HAVING COUNT(*) > 1`,
            [catalogVersionId]
        );

        if (duplicateCheck.rows.length > 0) {
            errors.push(`Found ${duplicateCheck.rows.length} duplicate SKUs`);
        }

        // Check 2: All prices have valid units
        const invalidUnits = await database.query(
            `SELECT DISTINCT unit
             FROM pricing_dimensions
             WHERE catalog_version = $1
               AND (unit IS NULL OR unit = '')`,
            [catalogVersionId]
        );

        if (invalidUnits.rows.length > 0) {
            errors.push('Found pricing entries with missing units');
        }

        // Check 3: Tier ranges are valid
        const invalidTiers = await database.query(
            `SELECT sku, begin_range, end_range
             FROM pricing_dimensions
             WHERE catalog_version = $1
               AND end_range IS NOT NULL
               AND begin_range >= end_range`,
            [catalogVersionId]
        );

        if (invalidTiers.rows.length > 0) {
            errors.push(`Found ${invalidTiers.rows.length} invalid tier ranges`);
        }

        return {
            isValid: errors.length === 0,
            errors,
        };
    }
}

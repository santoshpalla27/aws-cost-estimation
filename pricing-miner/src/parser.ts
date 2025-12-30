import * as fs from 'fs';
import { Chain } from 'stream-chain';
import { parser } from 'stream-json';
import { streamObject } from 'stream-json/streamers/StreamObject';
import { logger } from './logger';
import { AWSPricingCatalog, AWSProduct, AWSTerm, AWSPriceDimension } from './types';

export interface ParsedPrice {
    sku: string;
    service: string;
    regionCode: string;
    productFamily: string;
    attributes: Record<string, any>;
    usageType: string;
    operation: string | null;
    unit: string;
    pricePerUnit: number;
    beginRange: number;
    endRange: number | null;
    termType: 'OnDemand' | 'Reserved';
    leaseContractLength: string | null;
    purchaseOption: string | null;
    offeringClass: string | null;
    effectiveDate: Date;
}

export class Parser {
    /**
     * Stream parse AWS pricing JSON without loading entire file into memory
     * Handles multi-GB files efficiently
     */
    async *parse(filePath: string, service: string, regionCode: string): AsyncGenerator<ParsedPrice> {
        logger.info('Starting streaming parse', { filePath, service, regionCode });

        let products: Record<string, AWSProduct> = {};
        let currentSection: 'products' | 'terms' | null = null;
        let productCount = 0;
        let priceCount = 0;

        const pipeline = new Chain([
            fs.createReadStream(filePath, { highWaterMark: 65536 }),
            parser(),
            streamObject(),
        ]);

        for await (const { key, value } of pipeline as any) {
            // First pass: collect products
            if (key === 'products') {
                products = value;
                productCount = Object.keys(products).length;
                logger.info('Loaded products', { count: productCount });
                continue;
            }

            // Second pass: process OnDemand pricing
            if (key === 'terms.OnDemand') {
                logger.info('Processing OnDemand terms');
                for (const [sku, skuTerms] of Object.entries(value as Record<string, Record<string, AWSTerm>>)) {
                    const product = products[sku];
                    if (!product) {
                        logger.warn('Product not found for SKU', { sku });
                        continue;
                    }

                    for (const term of Object.values(skuTerms)) {
                        for (const priceDimension of Object.values(term.priceDimensions)) {
                            const parsedPrice = this.extractPrice(
                                product,
                                term,
                                priceDimension,
                                'OnDemand',
                                service,
                                regionCode
                            );

                            if (parsedPrice) {
                                priceCount++;
                                yield parsedPrice;
                            }
                        }
                    }
                }
            }

            // Third pass: process Reserved pricing
            if (key === 'terms.Reserved') {
                logger.info('Processing Reserved terms');
                for (const [sku, skuTerms] of Object.entries(value as Record<string, Record<string, AWSTerm>>)) {
                    const product = products[sku];
                    if (!product) continue;

                    for (const term of Object.values(skuTerms)) {
                        for (const priceDimension of Object.values(term.priceDimensions)) {
                            const parsedPrice = this.extractPrice(
                                product,
                                term,
                                priceDimension,
                                'Reserved',
                                service,
                                regionCode
                            );

                            if (parsedPrice) {
                                priceCount++;
                                yield parsedPrice;
                            }
                        }
                    }
                }
            }
        }

        logger.info('Parsing completed', { productCount, priceCount });
    }

    /**
     * Extract a single price from AWS format
     */
    private extractPrice(
        product: AWSProduct,
        term: AWSTerm,
        priceDimension: AWSPriceDimension,
        termType: 'OnDemand' | 'Reserved',
        service: string,
        regionCode: string
    ): ParsedPrice | null {
        // Extract price per unit (AWS uses USD key)
        const pricePerUnit = parseFloat(priceDimension.pricePerUnit.USD || '0');

        // Skip free tier or zero prices for now (will handle separately)
        if (pricePerUnit === 0) {
            return null;
        }

        // Extract usage type from product attributes
        const usageType = product.attributes.usagetype || product.attributes.usageType || 'Unknown';
        const operation = product.attributes.operation || null;

        // Extract tier ranges
        const beginRange = parseFloat(priceDimension.beginRange || '0');
        const endRange = priceDimension.endRange ? parseFloat(priceDimension.endRange) : null;

        // Extract reserved instance attributes
        const leaseContractLength = term.termAttributes?.LeaseContractLength || null;
        const purchaseOption = term.termAttributes?.PurchaseOption || null;
        const offeringClass = term.termAttributes?.OfferingClass || null;

        return {
            sku: product.sku,
            service,
            regionCode,
            productFamily: product.productFamily,
            attributes: product.attributes,
            usageType,
            operation,
            unit: priceDimension.unit,
            pricePerUnit,
            beginRange,
            endRange,
            termType,
            leaseContractLength,
            purchaseOption,
            offeringClass,
            effectiveDate: new Date(term.effectiveDate),
        };
    }

    /**
     * Quick validation of pricing file structure
     */
    async validate(filePath: string): Promise<{ isValid: boolean; error?: string }> {
        try {
            // Read first 1KB to validate JSON structure
            const fd = fs.openSync(filePath, 'r');
            const buffer = Buffer.alloc(1024);
            fs.readSync(fd, buffer, 0, 1024, 0);
            fs.closeSync(fd);

            const content = buffer.toString('utf8');

            // Check for required fields
            if (!content.includes('formatVersion')) {
                return { isValid: false, error: 'Missing formatVersion' };
            }

            if (!content.includes('products')) {
                return { isValid: false, error: 'Missing products section' };
            }

            return { isValid: true };
        } catch (error: any) {
            return { isValid: false, error: error.message };
        }
    }
}

import { database } from './database';
import { Downloader } from './downloader';
import { Parser } from './parser';
import { Normalizer } from './normalizer';
import { logger } from './logger';
import ora from 'ora';
import chalk from 'chalk';

export class Ingestor {
    private downloader: Downloader;
    private parser: Parser;
    private normalizer: Normalizer;

    constructor() {
        this.downloader = new Downloader();
        this.parser = new Parser();
        this.normalizer = new Normalizer();
    }

    /**
     * Full ingestion pipeline: Download → Parse → Normalize → Validate
     */
    async ingest(service: string, region: string): Promise<void> {
        logger.info('Starting ingestion', { service, region });

        const spinner = ora('Initializing ingestion').start();

        try {
            // Stage 1: Download
            spinner.text = 'Downloading pricing catalog';
            const { filePath, fileHash, publishedAt } = await this.downloader.download(
                service,
                region,
                (downloaded, total) => {
                    const percent = ((downloaded / total) * 100).toFixed(1);
                    spinner.text = `Downloading pricing catalog (${percent}%)`;
                }
            );
            spinner.succeed('Download completed');

            // Check if already ingested (idempotency)
            const existingVersion = await this.checkExistingVersion(service, region, fileHash);
            if (existingVersion) {
                logger.info('Pricing catalog already ingested', { versionId: existingVersion });
                console.log(chalk.yellow('⚠️  This catalog version is already ingested.'));
                return;
            }

            // Validate file
            spinner.start('Validating file structure');
            const validation = await this.parser.validate(filePath);
            if (!validation.isValid) {
                throw new Error(`Invalid pricing file: ${validation.error}`);
            }
            spinner.succeed('File structure validated');

            // Create catalog version record
            spinner.start('Creating catalog version');
            const versionId = await this.createCatalogVersion(
                service,
                region,
                this.downloader.getPricingUrl(service, region),
                fileHash,
                publishedAt
            );
            spinner.succeed(`Created catalog version: ${versionId}`);

            // Update status to IN_PROGRESS
            await this.updateVersionStatus(versionId, 'IN_PROGRESS');

            // Stage 2: Parse + Stage 3: Normalize
            spinner.start('Parsing and normalizing pricing data');
            const prices = this.parser.parse(filePath, service, region);
            const rowCount = await this.normalizer.normalize(prices, versionId);
            spinner.succeed(`Inserted ${rowCount} pricing dimensions`);

            // Stage 4: Validate
            spinner.start('Validating pricing data');
            const dataValidation = await this.normalizer.validatePricingData(versionId);

            if (!dataValidation.isValid) {
                spinner.fail('Validation failed');
                console.log(chalk.red('Validation errors:'));
                dataValidation.errors.forEach((error) => {
                    console.log(chalk.red(`  - ${error}`));
                });
                await this.updateVersionStatus(versionId, 'FAILED', dataValidation.errors.join('; '));
                throw new Error('Pricing data validation failed');
            }
            spinner.succeed('Pricing data validated');

            // Update status to COMPLETED
            await this.updateVersionStatus(versionId, 'COMPLETED', undefined, rowCount);

            console.log(chalk.green.bold('\n✓ Ingestion completed successfully!'));
            console.log(chalk.cyan(`  Version ID: ${versionId}`));
            console.log(chalk.cyan(`  Rows inserted: ${rowCount}`));
            console.log(chalk.cyan(`  File hash: ${fileHash}`));

        } catch (error: any) {
            spinner.fail('Ingestion failed');
            logger.error('Ingestion error', { error: error.message, service, region });
            throw error;
        }
    }

    /**
     * Check if catalog version already exists
     */
    private async checkExistingVersion(
        service: string,
        region: string,
        fileHash: string
    ): Promise<string | null> {
        const result = await database.query(
            `SELECT version_id FROM pricing_catalog_versions
             WHERE service = $1 AND region_code = $2 AND file_hash = $3
               AND status = 'COMPLETED'`,
            [service, region, fileHash]
        );

        return result.rows.length > 0 ? result.rows[0].version_id : null;
    }

    /**
     * Create new catalog version record
     */
    private async createCatalogVersion(
        service: string,
        region: string,
        sourceUrl: string,
        fileHash: string,
        publishedAt: Date
    ): Promise<string> {
        const result = await database.query(
            `INSERT INTO pricing_catalog_versions 
             (service, region_code, source_url, file_hash, published_at, status)
             VALUES ($1, $2, $3, $4, $5, 'PENDING')
             RETURNING version_id`,
            [service, region, sourceUrl, fileHash, publishedAt]
        );

        return result.rows[0].version_id;
    }

    /**
     * Update catalog version status
     */
    private async updateVersionStatus(
        versionId: string,
        status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED',
        errorMessage?: string,
        rowCount?: number
    ): Promise<void> {
        await database.query(
            `UPDATE pricing_catalog_versions
             SET status = $1, error_message = $2, row_count = $3
             WHERE version_id = $4`,
            [status, errorMessage || null, rowCount || null, versionId]
        );
    }

    /**
     * Get ingestion status
     */
    async getStatus(): Promise<any[]> {
        const result = await database.query(
            `SELECT 
                version_id,
                service,
                region_code,
                status,
                row_count,
                ingested_at,
                error_message
             FROM pricing_catalog_versions
             ORDER BY ingested_at DESC
             LIMIT 20`
        );

        return result.rows;
    }

    /**
     * Display status in CLI
     */
    async displayStatus(): Promise<void> {
        const versions = await this.getStatus();

        if (versions.length === 0) {
            console.log(chalk.yellow('No pricing catalogs ingested yet.'));
            return;
        }

        console.log(chalk.bold('\nPricing Catalog Ingestion Status:\n'));

        for (const version of versions) {
            const statusColor =
                version.status === 'COMPLETED'
                    ? chalk.green
                    : version.status === 'FAILED'
                        ? chalk.red
                        : chalk.yellow;

            console.log(`${statusColor('●')} ${chalk.bold(version.service)} (${version.region_code})`);
            console.log(`  Status: ${statusColor(version.status)}`);
            console.log(`  Version ID: ${chalk.dim(version.version_id)}`);
            console.log(`  Rows: ${version.row_count || 'N/A'}`);
            console.log(`  Ingested: ${chalk.dim(new Date(version.ingested_at).toLocaleString())}`);

            if (version.error_message) {
                console.log(chalk.red(`  Error: ${version.error_message}`));
            }
            console.log('');
        }
    }
}

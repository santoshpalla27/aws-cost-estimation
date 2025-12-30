/**
 * CLI for Pricing Miner
 * Run ingestion from command line
 */

import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { initializeSchema, closeDatabase, getIngestionStats } from '../db/index.js';
import { runIngestion, listAvailableServices } from '../ingestion/orchestrator.js';
import { logger } from '../utils/logger.js';

interface IngestOptions {
    all?: boolean;
    service?: string[];
    concurrency: string;
    force?: boolean;
}

const program = new Command();

program
    .name('pricing-miner')
    .description('AWS Pricing Data ETL Pipeline')
    .version('1.0.0');

program
    .command('ingest')
    .description('Ingest AWS pricing data')
    .option('-a, --all', 'Ingest all AWS services')
    .option('-s, --service <services...>', 'Specific services to ingest')
    .option('-c, --concurrency <number>', 'Number of concurrent ingestions', '3')
    .option('-f, --force', 'Force refresh even if version exists')
    .action(async (options: IngestOptions) => {
        const spinner = ora('Initializing database...').start();

        try {
            // Initialize database schema
            await initializeSchema();
            spinner.succeed('Database initialized');

            // Determine which services to ingest
            let servicesToIngest: string[] | undefined;

            if (options.service && options.service.length > 0) {
                servicesToIngest = options.service;
                spinner.info(`Ingesting specific services: ${servicesToIngest.join(', ')}`);
            } else if (options.all) {
                spinner.info('Ingesting all AWS services');
                servicesToIngest = undefined;
            } else {
                // Default: ingest priority services only
                servicesToIngest = [
                    'AmazonEC2',
                    'AmazonRDS',
                    'AmazonS3',
                    'AmazonDynamoDB',
                    'AWSLambda',
                ];
                spinner.info(`Ingesting priority services: ${servicesToIngest.join(', ')}`);
            }

            // Run ingestion
            spinner.start('Running ingestion...');
            const ingestionOpts = {
                ...(servicesToIngest ? { services: servicesToIngest } : {}),
                concurrency: parseInt(options.concurrency, 10),
                forceRefresh: options.force ?? false,
            };
            const stats = await runIngestion(ingestionOpts);

            spinner.stop();

            // Print results
            console.log('\n' + chalk.bold('═══════════════════════════════════════════'));
            console.log(chalk.bold('           INGESTION RESULTS'));
            console.log(chalk.bold('═══════════════════════════════════════════\n'));

            console.log(chalk.green(`✓ Successful: ${stats.successCount}`));
            console.log(chalk.red(`✗ Failed: ${stats.failureCount}`));
            console.log(chalk.blue(`📊 Total Records: ${stats.totalRecords.toLocaleString()}`));
            console.log(chalk.yellow(`⏱  Duration: ${(stats.totalDuration / 1000).toFixed(1)}s`));

            if (stats.failureCount > 0) {
                console.log('\n' + chalk.red.bold('Failed Services:'));
                stats.results
                    .filter((r) => !r.success)
                    .forEach((r) => {
                        console.log(chalk.red(`  • ${r.service}: ${r.error}`));
                    });
            }

            console.log('\n' + chalk.green.bold('Successful Services:'));
            stats.results
                .filter((r) => r.success && r.recordCount > 0)
                .sort((a, b) => b.recordCount - a.recordCount)
                .slice(0, 10)
                .forEach((r) => {
                    console.log(
                        chalk.green(`  • ${r.service}: ${r.recordCount.toLocaleString()} records (${(r.duration / 1000).toFixed(1)}s)`)
                    );
                });

            if (stats.successCount > 10) {
                console.log(chalk.dim(`  ... and ${stats.successCount - 10} more`));
            }

        } catch (error) {
            spinner.fail('Ingestion failed');
            logger.error({ error }, 'CLI error');
            console.error(chalk.red((error as Error).message));
            process.exit(1);
        } finally {
            await closeDatabase();
        }
    });

program
    .command('list-services')
    .description('List all available AWS services')
    .action(async () => {
        const spinner = ora('Fetching available services...').start();

        try {
            const services = await listAvailableServices();
            spinner.succeed(`Found ${services.length} services`);

            console.log('\n' + chalk.bold('Available AWS Services:'));
            services.forEach((s) => console.log(`  • ${s}`));
        } catch (error) {
            spinner.fail('Failed to list services');
            console.error(chalk.red((error as Error).message));
            process.exit(1);
        }
    });

program
    .command('stats')
    .description('Show ingestion statistics')
    .action(async () => {
        try {
            await initializeSchema();
            const stats = await getIngestionStats();

            console.log('\n' + chalk.bold('═══════════════════════════════════════════'));
            console.log(chalk.bold('         INGESTION STATISTICS'));
            console.log(chalk.bold('═══════════════════════════════════════════\n'));

            console.log(chalk.blue(`📦 Total Services: ${stats.totalServices}`));
            console.log(chalk.green(`📊 Total Records: ${stats.totalRecords.toLocaleString()}`));
            console.log(
                chalk.yellow(
                    `🕐 Last Ingested: ${stats.lastIngestedAt ? stats.lastIngestedAt.toISOString() : 'Never'}`
                )
            );
        } catch (error) {
            console.error(chalk.red((error as Error).message));
            process.exit(1);
        } finally {
            await closeDatabase();
        }
    });

program
    .command('init-db')
    .description('Initialize database schema')
    .action(async () => {
        const spinner = ora('Initializing database schema...').start();

        try {
            await initializeSchema();
            spinner.succeed('Database schema initialized');
        } catch (error) {
            spinner.fail('Failed to initialize database');
            console.error(chalk.red((error as Error).message));
            process.exit(1);
        } finally {
            await closeDatabase();
        }
    });

program.parse();

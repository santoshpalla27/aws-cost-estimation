#!/usr/bin/env node

import { Command } from 'commander';
import { Ingestor } from './ingestor';
import { database } from './database';
import { logger } from './logger';
import chalk from 'chalk';

const program = new Command();

program
    .name('pricing-miner')
    .description('AWS Pricing Catalog Ingestion Pipeline - Brain 1')
    .version('1.0.0');

// Ingest command
program
    .command('ingest')
    .description('Download and ingest AWS pricing catalog')
    .argument('<service>', 'AWS service (e.g., ec2, lambda, s3)')
    .argument('<region>', 'AWS region (e.g., us-east-1)')
    .action(async (service: string, region: string) => {
        try {
            const ingestor = new Ingestor();
            await ingestor.ingest(service, region);
            process.exit(0);
        } catch (error: any) {
            console.error(chalk.red(`\n✗ Error: ${error.message}`));
            logger.error('Ingestion failed', { error: error.stack });
            process.exit(1);
        } finally {
            await database.close();
        }
    });

// Status command
program
    .command('status')
    .description('Show ingestion status')
    .action(async () => {
        try {
            const ingestor = new Ingestor();
            await ingestor.displayStatus();
            process.exit(0);
        } catch (error: any) {
            console.error(chalk.red(`\n✗ Error: ${error.message}`));
            process.exit(1);
        } finally {
            await database.close();
        }
    });

// Verify command
program
    .command('verify')
    .description('Verify pricing data integrity')
    .argument('<versionId>', 'Catalog version ID to verify')
    .action(async (versionId: string) => {
        try {
            const { Normalizer } = await import('./normalizer');
            const normalizer = new Normalizer();

            console.log(chalk.cyan(`Verifying catalog version: ${versionId}\n`));

            const validation = await normalizer.validatePricingData(versionId);

            if (validation.isValid) {
                console.log(chalk.green.bold('✓ Validation passed!'));
            } else {
                console.log(chalk.red.bold('✗ Validation failed:'));
                validation.errors.forEach((error) => {
                    console.log(chalk.red(`  - ${error}`));
                });
                process.exit(1);
            }

            process.exit(0);
        } catch (error: any) {
            console.error(chalk.red(`\n✗ Error: ${error.message}`));
            process.exit(1);
        } finally {
            await database.close();
        }
    });

// Health check command
program
    .command('health')
    .description('Check database connectivity')
    .action(async () => {
        try {
            const isHealthy = await database.healthCheck();

            if (isHealthy) {
                console.log(chalk.green('✓ Database connection healthy'));
                process.exit(0);
            } else {
                console.log(chalk.red('✗ Database connection failed'));
                process.exit(1);
            }
        } catch (error: any) {
            console.error(chalk.red(`\n✗ Error: ${error.message}`));
            process.exit(1);
        } finally {
            await database.close();
        }
    });

// Parse and execute
program.parse();

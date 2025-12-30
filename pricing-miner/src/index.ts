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

// Ingest-all command
program
    .command('ingest-all')
    .description('Automatically discover and ingest ALL AWS services')
    .argument('<region>', 'AWS region (e.g., us-east-1)')
    .option('--essential-only', 'Ingest only essential services (faster)')
    .option('--continue-on-error', 'Continue even if individual services fail')
    .action(async (region: string, options: any) => {
        try {
            const { ServiceDiscovery } = await import('./serviceDiscovery');
            const discovery = new ServiceDiscovery();
            const ingestor = new Ingestor();

            console.log(chalk.cyan.bold('\n═══════════════════════════════════════'));
            console.log(chalk.cyan.bold('  AWS Pricing Auto-Ingestion'));
            console.log(chalk.cyan.bold('═══════════════════════════════════════\n'));

            // Get service list
            let services: string[];
            if (options.essentialOnly) {
                services = discovery.getEssentialServices();
                console.log(chalk.yellow(`Mode: Essential services only (${services.length} services)\n`));
            } else {
                services = await discovery.discoverAllServices();
                console.log(chalk.yellow(`Mode: All available services (${services.length} services)\n`));
            }

            console.log(chalk.cyan(`Region: ${region}`));
            console.log(chalk.cyan(`Continue on error: ${options.continueOnError ? 'Yes' : 'No'}\n`));

            let successful = 0;
            let failed = 0;
            const failedServices: string[] = [];

            for (let i = 0; i < services.length; i++) {
                const service = services[i];
                const progress = `[${i + 1}/${services.length}]`;

                console.log(chalk.blue(`\n${progress} Processing: ${service}`));
                console.log(chalk.gray('─'.repeat(50)));

                try {
                    await ingestor.ingest(service, region);
                    successful++;
                    console.log(chalk.green(`✓ ${service} completed successfully`));
                } catch (error: any) {
                    failed++;
                    failedServices.push(service);

                    if (options.continueOnError) {
                        console.log(chalk.yellow(`⚠ ${service} failed: ${error.message}`));
                        console.log(chalk.yellow(`  Continuing to next service...`));
                    } else {
                        console.log(chalk.red(`✗ ${service} failed: ${error.message}`));
                        console.log(chalk.red(`\nAborting. Use --continue-on-error to skip failures.`));
                        throw error;
                    }
                }
            }

            // Summary
            console.log(chalk.cyan.bold('\n═══════════════════════════════════════'));
            console.log(chalk.cyan.bold('  Ingestion Complete!'));
            console.log(chalk.cyan.bold('═══════════════════════════════════════\n'));
            console.log(chalk.green(`✓ Successful: ${successful}/${services.length}`));

            if (failed > 0) {
                console.log(chalk.yellow(`⚠ Failed: ${failed}/${services.length}`));
                console.log(chalk.gray('\nFailed services:'));
                failedServices.forEach(s => console.log(chalk.gray(`  - ${s}`)));
            }

            console.log(chalk.cyan('\nRun "status" command to verify ingested data\n'));

            process.exit(failed > 0 && !options.continueOnError ? 1 : 0);
        } catch (error: any) {
            console.error(chalk.red(`\n✗ Error: ${error.message}`));
            logger.error('Batch ingestion failed', { error: error.stack });
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

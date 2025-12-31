/**
 * Configuration Management
 * All configuration loaded from environment variables with sensible defaults
 */

import { config as loadEnv } from 'dotenv';

// Load .env file
loadEnv();

export interface Config {
    // AWS Pricing API
    aws: {
        pricingBaseUrl: string;
        offerIndexPath: string;
        requestTimeout: number;
        maxRetries: number;
    };

    // Database
    database: {
        host: string;
        port: number;
        database: string;
        user: string;
        password: string;
        maxConnections: number;
    };

    // Ingestion
    ingestion: {
        concurrency: number;
        batchSize: number;
        streamHighWaterMark: number;
    };

    // Logging
    logging: {
        level: string;
        pretty: boolean;
    };
}

function getEnv(key: string, defaultValue: string): string {
    return process.env[key] ?? defaultValue;
}

function getEnvInt(key: string, defaultValue: number): number {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvBool(key: string, defaultValue: boolean): boolean {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true' || value === '1';
}

export const config: Config = {
    aws: {
        pricingBaseUrl: getEnv('AWS_PRICING_BASE_URL', 'https://pricing.us-east-1.amazonaws.com'),
        offerIndexPath: getEnv('AWS_OFFER_INDEX_PATH', '/offers/v1.0/aws/index.json'),
        requestTimeout: getEnvInt('AWS_REQUEST_TIMEOUT', 3600000), // 60 minutes for large files like EC2
        maxRetries: getEnvInt('AWS_MAX_RETRIES', 3),
    },

    database: {
        host: getEnv('DB_HOST', 'localhost'),
        port: getEnvInt('DB_PORT', 5432),
        database: getEnv('DB_NAME', 'pricing'),
        user: getEnv('DB_USER', 'postgres'),
        password: getEnv('DB_PASSWORD', 'postgres'),
        maxConnections: getEnvInt('DB_MAX_CONNECTIONS', 10),
    },

    ingestion: {
        concurrency: getEnvInt('INGESTION_CONCURRENCY', 3),
        batchSize: getEnvInt('INGESTION_BATCH_SIZE', 10000),
        streamHighWaterMark: getEnvInt('STREAM_HIGH_WATER_MARK', 64 * 1024), // 64KB
    },

    logging: {
        level: getEnv('LOG_LEVEL', 'info'),
        pretty: getEnvBool('LOG_PRETTY', true),
    },
};

// AWS Services we know about (auto-discovered from offer index)
// This list is used for priority ordering, not filtering
export const PRIORITY_SERVICES = [
    'AmazonEC2',
    'AmazonRDS',
    'AmazonS3',
    'AmazonDynamoDB',
    'AWSLambda',
    'AmazonCloudFront',
    'AmazonElastiCache',
    'AmazonEKS',
    'AmazonECS',
    'AmazonSNS',
    'AmazonSQS',
    'AmazonKinesis',
    'AmazonRedshift',
    'AmazonRoute53',
    'AmazonAPIGateway',
    'AWSGlue',
    'AmazonAthena',
    'AWSStepFunctions',
    'AmazonCloudWatch',
    'AWSSecretsManager',
    'AWSKMS',
    'ElasticLoadBalancing',
];

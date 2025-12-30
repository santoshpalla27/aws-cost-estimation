import dotenv from 'dotenv';

dotenv.config();

export const config = {
    databaseUrl: process.env.DATABASE_URL || 'postgresql://cost_user:cost_password_dev_only@localhost:5432/aws_cost_estimation',
    logLevel: process.env.LOG_LEVEL || 'info',
    pricingApiBase: process.env.PRICING_API_BASE || 'https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws',
    maxConcurrentDownloads: parseInt(process.env.MAX_CONCURRENT_DOWNLOADS || '3', 10),
    batchInsertSize: parseInt(process.env.BATCH_INSERT_SIZE || '1000', 10),
    streamHighWaterMark: parseInt(process.env.STREAM_HIGH_WATER_MARK || '65536', 10),
    cacheDir: process.env.CACHE_DIR || './cache',
};

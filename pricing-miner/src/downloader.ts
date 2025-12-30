import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { config } from './config';
import { logger } from './logger';

export class Downloader {
    private cacheDir: string;

    constructor() {
        this.cacheDir = config.cacheDir;
        this.ensureCacheDir();
    }

    private ensureCacheDir(): void {
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
            logger.info('Created cache directory', { path: this.cacheDir });
        }
    }

    /**
     * Construct AWS Pricing API URL for a service and region
     */
    getPricingUrl(service: string, region: string): string {
        // AWS service names in pricing API use specific format
        const serviceMap: Record<string, string> = {
            'ec2': 'AmazonEC2',
            'lambda': 'AWSLambda',
            's3': 'AmazonS3',
            'rds': 'AmazonRDS',
            'dynamodb': 'AmazonDynamoDB',
            'cloudfront': 'AmazonCloudFront',
            'apigateway': 'AmazonApiGateway',
        };

        const awsServiceName = serviceMap[service.toLowerCase()] || service;
        return `${config.pricingApiBase}/${awsServiceName}/current/${region}/index.json`;
    }

    /**
     * Calculate SHA256 hash of a file
     */
    async calculateFileHash(filePath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha256');
            const stream = fs.createReadStream(filePath);

            stream.on('data', (data) => hash.update(data));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', reject);
        });
    }

    /**
     * Download pricing catalog with streaming and resume capability
     */
    async download(
        service: string,
        region: string,
        onProgress?: (bytesDownloaded: number, totalBytes: number) => void
    ): Promise<{ filePath: string; fileHash: string; publishedAt: Date }> {
        const url = this.getPricingUrl(service, region);
        const fileName = `${service}_${region}_${Date.now()}.json`;
        const filePath = path.join(this.cacheDir, fileName);

        logger.info('Starting download', { service, region, url });

        try {
            // Check if file already exists (resume capability)
            let existingSize = 0;
            if (fs.existsSync(filePath)) {
                existingSize = fs.statSync(filePath).size;
                logger.info('Found partial download', { existingSize });
            }

            // Make request with Range header for resume
            const headers: Record<string, string> = {};
            if (existingSize > 0) {
                headers['Range'] = `bytes=${existingSize}-`;
            }

            const response = await axios({
                method: 'GET',
                url,
                headers,
                responseType: 'stream',
                timeout: 300000, // 5 minutes timeout
            });

            const totalBytes = parseInt(response.headers['content-length'] || '0', 10) + existingSize;
            let downloadedBytes = existingSize;

            const writer = fs.createWriteStream(filePath, {
                flags: existingSize > 0 ? 'a' : 'w', // Append if resuming
            });

            response.data.on('data', (chunk: Buffer) => {
                downloadedBytes += chunk.length;
                if (onProgress) {
                    onProgress(downloadedBytes, totalBytes);
                }
            });

            await new Promise<void>((resolve, reject) => {
                response.data.pipe(writer);
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            logger.info('Download completed', { filePath, size: downloadedBytes });

            // Calculate file hash for idempotency
            const fileHash = await this.calculateFileHash(filePath);

            // Extract publication date from response headers or content
            const publishedAt = new Date(); // In production, parse from catalog metadata

            return { filePath, fileHash, publishedAt };
        } catch (error: any) {
            logger.error('Download failed', { error: error.message, url });
            throw new Error(`Failed to download pricing catalog: ${error.message}`);
        }
    }

    /**
     * Clean up old cached files
     */
    async cleanupCache(maxAgeHours: number = 168): Promise<void> {
        const files = fs.readdirSync(this.cacheDir);
        const now = Date.now();
        const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

        let deletedCount = 0;

        for (const file of files) {
            const filePath = path.join(this.cacheDir, file);
            const stats = fs.statSync(filePath);
            const age = now - stats.mtimeMs;

            if (age > maxAgeMs) {
                fs.unlinkSync(filePath);
                deletedCount++;
            }
        }

        logger.info('Cache cleanup completed', { deletedCount, maxAgeHours });
    }
}

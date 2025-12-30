/**
 * Data Storage Utilities
 * Save pricing data and logs to persistent volumes
 */

import { writeFile, mkdir, readFile, access, readdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { constants } from 'node:fs';
import { logger } from './logger.js';

// Base directories for persistent storage
const DATA_DIR = process.env.DATA_DIR || '/app/data';
const LOGS_DIR = process.env.LOGS_DIR || '/app/logs';

/**
 * Ensure directory exists
 */
async function ensureDir(dir: string): Promise<void> {
    try {
        await access(dir, constants.F_OK);
    } catch {
        await mkdir(dir, { recursive: true });
        logger.debug({ dir }, 'Created directory');
    }
}

/**
 * Save ingestion summary to data volume
 */
export async function saveIngestionSummary(
    service: string,
    summary: {
        catalogVersionId: number;
        recordCount: number;
        duration: number;
        stats: Record<string, unknown>;
        rosettaStats: Record<string, unknown>;
        timestamp: string;
    }
): Promise<void> {
    await ensureDir(DATA_DIR);

    const filename = `${service}_summary.json`;
    const filepath = path.join(DATA_DIR, filename);

    await writeFile(filepath, JSON.stringify(summary, null, 2));
    logger.debug({ filepath }, 'Saved ingestion summary');
}

/**
 * Save catalog version manifest
 */
export async function saveCatalogManifest(
    manifest: {
        services: Array<{
            service: string;
            catalogVersionId: number;
            versionHash: string;
            recordCount: number;
            ingestedAt: string;
        }>;
        totalRecords: number;
        totalServices: number;
        completedAt: string;
    }
): Promise<void> {
    await ensureDir(DATA_DIR);

    const filepath = path.join(DATA_DIR, 'catalog_manifest.json');
    await writeFile(filepath, JSON.stringify(manifest, null, 2));
    logger.info({ filepath, totalServices: manifest.totalServices }, 'Saved catalog manifest');
}

/**
 * Save ingestion log entry
 */
export async function saveIngestionLog(
    entry: {
        timestamp: string;
        service: string;
        status: 'started' | 'completed' | 'failed';
        recordCount?: number;
        duration?: number;
        error?: string;
    }
): Promise<void> {
    await ensureDir(LOGS_DIR);

    const date = new Date().toISOString().split('T')[0];
    const filepath = path.join(LOGS_DIR, `ingestion_${date}.jsonl`);

    // Append to JSONL file
    const stream = createWriteStream(filepath, { flags: 'a' });
    stream.write(JSON.stringify(entry) + '\n');
    stream.end();
}

/**
 * Save raw pricing index for debugging
 */
export async function savePricingIndex(
    services: Array<{ offerCode: string; currentVersionUrl: string }>
): Promise<void> {
    await ensureDir(DATA_DIR);

    const filepath = path.join(DATA_DIR, 'aws_services_index.json');
    await writeFile(
        filepath,
        JSON.stringify(
            {
                generatedAt: new Date().toISOString(),
                serviceCount: services.length,
                services: services.map((s) => s.offerCode).sort(),
            },
            null,
            2
        )
    );
    logger.info({ filepath, serviceCount: services.length }, 'Saved AWS services index');
}

/**
 * Get ingestion history from logs
 */
export async function getIngestionHistory(): Promise<
    Array<{
        timestamp: string;
        service: string;
        status: string;
        recordCount?: number;
        duration?: number;
    }>
> {
    try {
        await ensureDir(LOGS_DIR);
        const files = await readdir(LOGS_DIR);
        const logFiles = files.filter((f) => f.startsWith('ingestion_') && f.endsWith('.jsonl'));

        const history: Array<{
            timestamp: string;
            service: string;
            status: string;
            recordCount?: number;
            duration?: number;
        }> = [];

        for (const file of logFiles.slice(-7)) {
            // Last 7 days
            const content = await readFile(path.join(LOGS_DIR, file), 'utf-8');
            const lines = content.trim().split('\n').filter(Boolean);
            for (const line of lines) {
                try {
                    history.push(JSON.parse(line));
                } catch {
                    // Skip malformed lines
                }
            }
        }

        return history;
    } catch {
        return [];
    }
}

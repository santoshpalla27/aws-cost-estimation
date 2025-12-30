/**
 * Structured Logging with Pino
 * Production-grade logging with context support
 */

import { pino, type Logger } from 'pino';
import { config } from '../config/index.js';

// Create logger
const loggerOptions = {
    level: config.logging.level,
};

let logger: Logger;

if (config.logging.pretty) {
    logger = pino({
        ...loggerOptions,
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
            },
        },
    });
} else {
    logger = pino(loggerOptions);
}

export { logger };

/**
 * Create a child logger with service context
 */
export function createServiceLogger(service: string) {
    return logger.child({ awsService: service });
}

/**
 * Create a child logger for ingestion operations
 */
export function createIngestionLogger(service: string, catalogVersionId: number) {
    return logger.child({
        awsService: service,
        catalogVersionId,
        operation: 'ingestion',
    });
}

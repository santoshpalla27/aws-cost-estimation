import { Pool } from 'pg';
import { config } from './config';
import { logger } from './logger';

class Database {
    private pool: Pool;

    constructor() {
        this.pool = new Pool({
            connectionString: config.databaseUrl,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        this.pool.on('error', (err) => {
            logger.error('Unexpected database error', { error: err.message });
        });
    }

    async query(text: string, params?: any[]) {
        const start = Date.now();
        try {
            const result = await this.pool.query(text, params);
            const duration = Date.now() - start;
            logger.debug('Executed query', { duration, rows: result.rowCount });
            return result;
        } catch (error: any) {
            logger.error('Query failed', { error: error.message, query: text });
            throw error;
        }
    }

    async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async batchInsert(
        tableName: string,
        columns: string[],
        rows: any[][],
        onConflict?: string
    ): Promise<void> {
        if (rows.length === 0) return;

        const placeholders = rows
            .map(
                (_, rowIdx) =>
                    `(${columns
                        .map((_, colIdx) => `$${rowIdx * columns.length + colIdx + 1}`)
                        .join(', ')})`
            )
            .join(', ');

        const values = rows.flat();
        const conflictClause = onConflict || '';

        const query = `
            INSERT INTO ${tableName} (${columns.join(', ')})
            VALUES ${placeholders}
            ${conflictClause}
        `;

        await this.query(query, values);
    }

    async healthCheck(): Promise<boolean> {
        try {
            await this.query('SELECT 1');
            return true;
        } catch {
            return false;
        }
    }

    async close(): Promise<void> {
        await this.pool.end();
        logger.info('Database connection pool closed');
    }
}

export const database = new Database();

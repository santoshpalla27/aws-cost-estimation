/**
 * SQLite-based Product Store
 * Stores products on disk instead of RAM for large files like EC2
 */

import Database from 'better-sqlite3';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync, unlinkSync } from 'node:fs';
import type { Product } from '../types/pricing.js';

export class SQLiteProductStore {
    private db: Database.Database;
    private dbPath: string;
    private insertStmt: Database.Statement;
    private selectStmt: Database.Statement;
    private productCount = 0;

    constructor(service: string) {
        this.dbPath = join(tmpdir(), `products-${service}-${Date.now()}.sqlite`);
        this.db = new Database(this.dbPath);

        // Optimize for write-heavy workload
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = OFF');
        this.db.pragma('cache_size = 10000');

        // Create products table
        this.db.exec(`
            CREATE TABLE products (
                sku TEXT PRIMARY KEY,
                data TEXT NOT NULL
            )
        `);

        // Prepare statements
        this.insertStmt = this.db.prepare('INSERT OR REPLACE INTO products (sku, data) VALUES (?, ?)');
        this.selectStmt = this.db.prepare('SELECT data FROM products WHERE sku = ?');
    }

    /**
     * Add a product to the store
     */
    addProduct(product: Product): void {
        this.insertStmt.run(product.sku, JSON.stringify(product));
        this.productCount++;
    }

    /**
     * Get a product by SKU
     */
    getProduct(sku: string): Product | undefined {
        const row = this.selectStmt.get(sku) as { data: string } | undefined;
        if (!row) return undefined;
        return JSON.parse(row.data) as Product;
    }

    /**
     * Get total product count
     */
    getCount(): number {
        return this.productCount;
    }

    /**
     * Close and cleanup
     */
    close(): void {
        try {
            this.db.close();
            if (existsSync(this.dbPath)) {
                unlinkSync(this.dbPath);
            }
        } catch {
            // Ignore cleanup errors
        }
    }
}

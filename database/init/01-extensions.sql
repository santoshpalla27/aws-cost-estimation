-- Database initialization script
-- This runs automatically when PostgreSQL container starts

-- Enable useful extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- For fuzzy text search
CREATE EXTENSION IF NOT EXISTS btree_gin; -- For GIN indexes on scalars

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE pricing TO postgres;

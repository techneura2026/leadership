-- Run once on DB creation (docker-entrypoint-initdb.d)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

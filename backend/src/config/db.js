'use strict';

const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME     || 'sd_digitals_scheduler',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', () => {
  if (process.env.NODE_ENV !== 'test') {
    console.log('[db] New client connected to PostgreSQL pool');
  }
});

pool.on('error', (err) => {
  console.error('[db] Unexpected error on idle client:', err.message);
});

/**
 * Execute a parameterized query against the pool.
 * @param {string} text  - SQL query string with $1, $2 placeholders
 * @param {Array}  params - Parameter values
 */
async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;

  if (process.env.NODE_ENV === 'development') {
    console.log(`[db] query executed in ${duration}ms — rows: ${result.rowCount}`);
  }

  return result;
}

/**
 * Acquire a client from the pool for transaction use.
 * Caller is responsible for releasing: client.release()
 */
async function getClient() {
  return pool.connect();
}

module.exports = { query, getClient, pool };

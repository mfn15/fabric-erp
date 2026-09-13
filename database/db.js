const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set. Copy .env.example to .env and add your Postgres/Supabase connection string.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
  max: Number(process.env.DB_POOL_MAX || 5),
  idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_MS || 10 * 60 * 1000),
  connectionTimeoutMillis: 10000
});

pool.on('error', err => console.error('PostgreSQL pool error:', err.message));

// Dashboard/report queries filter with `created_at::date`, which is
// timezone-sensitive -- pin every connection to UTC for consistent date
// math regardless of where this runs.
pool.on('connect', client => {
  client.query("SET TIME ZONE 'UTC'").catch(e => console.error('Failed to set session timezone:', e.message));
});

pool.ensureSchema = async function ensureSchema() {
  const fs = require('fs');
  const path = require('path');
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    await pool.query(stmt);
  }
};

module.exports = pool;

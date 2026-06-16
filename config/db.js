import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pg;

// Pool koneksi database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
});

// Handle pool errors gracefully (no process.exit in serverless)
pool.on('error', (err) => {
  console.error('❌ Pool PostgreSQL error:', err.message);
});

// Optional: test connection on first query (lazy initialization)
let connectionTested = false;
const originalQuery = pool.query.bind(pool);
pool.query = async (...args) => {
  if (!connectionTested) {
    try {
      await pool.query('SELECT 1');
      console.log('✅ PostgreSQL (Supabase) Terhubung!');
      connectionTested = true;
    } catch (err) {
      console.error('❌ Gagal terhubung ke database:', err.message);
    }
  }
  return originalQuery(...args);
};

export default pool;
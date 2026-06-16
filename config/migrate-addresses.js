import pool from './db.js';

const migrate = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_addresses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        label VARCHAR(50) DEFAULT 'Rumah',
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        address TEXT NOT NULL,
        city VARCHAR(100) NOT NULL,
        postal_code VARCHAR(10) NOT NULL,
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Tabel user_addresses siap.');
  } catch (err) {
    console.error('❌ Gagal migrasi:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
};

migrate();
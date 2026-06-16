import pool from './db.js';

const migrate = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Tabel categories siap.');

    //6 kategori awal
    const categories = ['Jaket Coach','Jaket Bomber','Hoodie','Sweater','Jaket Denim','Vest'];
    for (const name of categories) {
      await client.query(
        'INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
        [name]
      );
    }
    console.log(`✅ ${categories.length} kategori berhasil di-seed.`);
  } catch (err) {
    console.error('❌ Gagal migrasi:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
};

migrate();
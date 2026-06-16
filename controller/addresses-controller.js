import pool from '../config/db.js';

export const getAddresses = async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM user_addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC',
    [req.user.id]
  );
  res.status(200).json(rows);
};

export const addAddress = async (req, res) => {
  const { label, name, phone, address, city, postalCode } = req.body;

  if (!name || !phone || !address || !city || !postalCode) {
    return res.status(400).json({ message: 'Semua field alamat wajib diisi.' });
  }

  const { rows: existing } = await pool.query(
    'SELECT COUNT(*)::INT AS count FROM user_addresses WHERE user_id = $1',
    [req.user.id]
  );
  const isDefault = existing[0].count === 0;

  const { rows } = await pool.query(
    `INSERT INTO user_addresses (user_id, label, name, phone, address, city, postal_code, is_default)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [req.user.id, label || 'Rumah', name.trim(), phone.trim(), address.trim(), city.trim(), postalCode.trim(), isDefault]
  );

  res.status(201).json(rows[0]);
};

export const updateAddress = async (req, res) => {
  const { label, name, phone, address, city, postalCode } = req.body;
  const { id } = req.params;

  const { rows } = await pool.query(
    `UPDATE user_addresses
     SET label = COALESCE(NULLIF($1, ''), label),
         name = COALESCE(NULLIF($2, ''), name),
         phone = COALESCE(NULLIF($3, ''), phone),
         address = COALESCE(NULLIF($4, ''), address),
         city = COALESCE(NULLIF($5, ''), city),
         postal_code = COALESCE(NULLIF($6, ''), postal_code)
     WHERE id = $7 AND user_id = $8
     RETURNING *`,
    [label, name, phone, address, city, postalCode, id, req.user.id]
  );

  if (rows.length === 0) {
    return res.status(404).json({ message: 'Alamat tidak ditemukan.' });
  }
  res.status(200).json(rows[0]);
};

export const deleteAddress = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows: deleted } = await client.query(
      'DELETE FROM user_addresses WHERE id = $1 AND user_id = $2 RETURNING is_default',
      [id, req.user.id]
    );

    if (deleted.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Alamat tidak ditemukan.' });
    }

    //Kalau alamat yang dihapus adalah default set alamat terbaru jadi default otomatis
    if (deleted[0].is_default) {
      await client.query(
        `UPDATE user_addresses SET is_default = true
         WHERE id = (SELECT id FROM user_addresses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1)
         AND user_id = $1`,
        [req.user.id]
      );
    }

    await client.query('COMMIT');
    res.status(200).json({ message: 'Alamat berhasil dihapus.' });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

//ubah alamat default reset semua false dulu baru set satu jadi true
//dilakukan dalam 1 transaksi biar konsisten
export const setDefaultAddress = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      'UPDATE user_addresses SET is_default = false WHERE user_id = $1',
      [req.user.id]
    );

    const { rows } = await client.query(
      'UPDATE user_addresses SET is_default = true WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.id]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Alamat tidak ditemukan.' });
    }

    await client.query('COMMIT');
    res.status(200).json(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
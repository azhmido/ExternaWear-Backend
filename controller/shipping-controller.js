import pool from '../config/db.js';

export const getRates = async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM shipping_rates ORDER BY city ASC'
  );
  res.status(200).json(rows);
};

export const addRate = async (req, res) => {
  const { city, cost, estimated_days } = req.body;
  if (!city || !cost) {
    return res.status(400).json({ message: 'Kota dan biaya kirim wajib diisi.' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO shipping_rates (city, cost, estimated_days) VALUES ($1, $2, $3) RETURNING *',
      [city.trim(), Number(cost), estimated_days || '3-5 hari']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: `Kota "${city}" sudah terdaftar.` });
    }
    throw err;
  }
};

export const updateRate = async (req, res) => {
  const { id } = req.params;
  const { city, cost, estimated_days } = req.body;
  const { rows } = await pool.query(
    `UPDATE shipping_rates
     SET city           = COALESCE(NULLIF($1, ''), city),
         cost           = COALESCE($2, cost),
         estimated_days = COALESCE(NULLIF($3, ''), estimated_days)
     WHERE id = $4 RETURNING *`,
    [city, cost ? Number(cost) : null, estimated_days, id]
  );
  if (rows.length === 0) {
    return res.status(404).json({ message: 'Tarif tidak ditemukan.' });
  }
  res.status(200).json(rows[0]);
};

export const deleteRate = async (req, res) => {
  const { id } = req.params;
  const { rows } = await pool.query(
    'DELETE FROM shipping_rates WHERE id = $1 RETURNING id',
    [id]
  );
  if (rows.length === 0) {
    return res.status(404).json({ message: 'Tarif tidak ditemukan.' });
  }
  res.status(200).json({ message: 'Tarif berhasil dihapus.' });
};
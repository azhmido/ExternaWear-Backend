import pool from '../config/db.js';

export const getAllCategories = async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, created_at FROM categories ORDER BY name ASC'
  );
  res.status(200).json(rows);
};

export const createCategory = async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ message: 'Nama kategori wajib diisi.' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO categories (name) VALUES ($1) RETURNING *',
      [name.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: `Kategori "${name}" sudah ada.` });
    }
    throw err;
  }
};

export const updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ message: 'Nama kategori wajib diisi.' });
  }
  try {
    const { rows } = await pool.query(
      'UPDATE categories SET name = $1 WHERE id = $2 RETURNING *',
      [name.trim(), id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Kategori tidak ditemukan.' });
    }
    res.status(200).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: `Kategori "${name}" sudah ada.` });
    }
    throw err;
  }
};

export const deleteCategory = async (req, res) => {
  const { id } = req.params;
  const { rows } = await pool.query(
    'DELETE FROM categories WHERE id = $1 RETURNING id',
    [id]
  );
  if (rows.length === 0) {
    return res.status(404).json({ message: 'Kategori tidak ditemukan.' });
  }
  res.status(200).json({ message: 'Kategori berhasil dihapus.' });
};
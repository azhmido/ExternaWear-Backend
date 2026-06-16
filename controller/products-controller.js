import pool from '../config/db.js';

//reusable SQL fragment aggregate variants jadi JSON array
const PRODUCT_SELECT = `
  SELECT p.*,
    COALESCE(
      json_agg(json_build_object('size', s.size, 'stock', s.stock))
      FILTER (WHERE s.size IS NOT NULL), '[]'
    ) AS variants
  FROM products p
  LEFT JOIN product_stocks s ON p.id = s.product_id
`;

const validateProductInput = ({ name, description, price, category, image_url, variants }) => {
  const errors = [];
  if (!name?.trim())                                errors.push('Nama produk wajib diisi.');
  if (!description?.trim())                         errors.push('Deskripsi wajib diisi.');
  if (!price || isNaN(price) || Number(price) <= 0) errors.push('Harga harus berupa angka positif.');
  if (!category?.trim())                            errors.push('Kategori wajib diisi.');
  if (!image_url?.trim())                           errors.push('URL gambar wajib diisi.');
  if (!Array.isArray(variants) || variants.length === 0) errors.push('Minimal satu varian wajib diisi.');
  return errors;
};

const SORT_MAP = {
  newest:     'p.created_at DESC',
  oldest:     'p.created_at ASC',
  price_asc:  'p.price ASC',
  price_desc: 'p.price DESC',
  name_asc:   'p.name ASC',
  name_desc:  'p.name DESC',
};

//daftar produk dengan filter, search, sort, pagination
export const getAllProducts = async (req, res) => {
  const { search, category, sort, inStock } = req.query;
  const page   = Math.max(1, parseInt(req.query.page) || 1);
  const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const conditions = [];
  const params     = [];

  if (search?.trim()) {
    params.push(`%${search.trim()}%`);
    conditions.push(`(p.name ILIKE $${params.length} OR p.description ILIKE $${params.length} OR p.category ILIKE $${params.length})`);
  }
  if (category?.trim() && category !== 'Semua') {
    params.push(category.trim());
    conditions.push(`p.category = $${params.length}`);
  }

  const where   = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderBy = `ORDER BY ${SORT_MAP[sort] || SORT_MAP.newest}`;

  const havingClause = inStock === 'true'
    ? "HAVING SUM(COALESCE(s.stock, 0)) > 0"
    : '';

  // Count total
  const countResult = await pool.query(
    `SELECT COUNT(*) FROM (SELECT p.id FROM products p LEFT JOIN product_stocks s ON p.id = s.product_id ${where} GROUP BY p.id ${havingClause}) sub`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  // Data with limit/offset
  const { rows } = await pool.query(
    `${PRODUCT_SELECT} ${where} GROUP BY p.id ${havingClause} ${orderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  res.status(200).json({
    data: rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
};

export const getProductById = async (req, res) => {
  const { rows } = await pool.query(
    `${PRODUCT_SELECT} WHERE p.id = $1 GROUP BY p.id`,
    [req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ message: 'Produk tidak ditemukan.' });
  res.status(200).json(rows[0]);
};

//ambil 4 produk random dari kategori yang sama ditampilkan sebagai "Produk Serupa"
export const getRelatedProducts = async (req, res) => {
  const product = await pool.query('SELECT category FROM products WHERE id = $1', [req.params.id]);
  if (product.rows.length === 0) return res.status(404).json({ message: 'Produk tidak ditemukan.' });

  const { rows } = await pool.query(
    `${PRODUCT_SELECT} WHERE p.category = $1 AND p.id != $2 GROUP BY p.id ORDER BY RANDOM() LIMIT 4`,
    [product.rows[0].category, req.params.id]
  );
  res.status(200).json(rows);
};

//insert produk di dalam 1 transaksi
export const createProduct = async (req, res) => {
  const { name, description, price, category, image_url, variants } = req.body;
  const errors = validateProductInput({ name, description, price, category, image_url, variants });
  if (errors.length > 0) return res.status(400).json({ message: 'Validasi gagal.', errors });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [product] } = await client.query(
      'INSERT INTO products (name,description,price,category,image_url) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [name.trim(), description.trim(), Number(price), category.trim(), image_url.trim()]
    );
    for (const { size, stock } of variants) {
      await client.query(
        'INSERT INTO product_stocks (product_id,size,stock) VALUES ($1,$2,$3)',
        [product.id, size, stock]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ message: 'Produk berhasil ditambahkan!', productId: product.id });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

//update produk insert ulang di dalam 1 transaksi
export const updateProduct = async (req, res) => {
  const { id } = req.params;
  const { name, description, price, category, image_url, variants } = req.body;
  const errors = validateProductInput({ name, description, price, category, image_url, variants });
  if (errors.length > 0) return res.status(400).json({ message: 'Validasi gagal.', errors });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: updated } = await client.query(
      'UPDATE products SET name=$1,description=$2,price=$3,category=$4,image_url=$5 WHERE id=$6 RETURNING id',
      [name.trim(), description.trim(), Number(price), category.trim(), image_url.trim(), id]
    );
    if (updated.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Produk tidak ditemukan.' });
    }
    await client.query('DELETE FROM product_stocks WHERE product_id=$1', [id]);
    for (const { size, stock } of variants) {
      await client.query(
        'INSERT INTO product_stocks (product_id,size,stock) VALUES ($1,$2,$3)',
        [id, size, stock]
      );
    }
    await client.query('COMMIT');
    res.status(200).json({ message: 'Produk berhasil diperbarui!' });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const deleteProduct = async (req, res) => {
  const { rows } = await pool.query('DELETE FROM products WHERE id=$1 RETURNING id', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ message: 'Produk tidak ditemukan.' });
  res.status(200).json({ message: 'Produk berhasil dihapus!' });
};
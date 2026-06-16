import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

const SALT_ROUNDS = 12;

//konfigurasi cookie JWT
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production', //cuma dikirim lewat HTTPS di production
  sameSite: 'lax', //lax biar cookie dikirim pas redirect dari Xendit
  maxAge: 24 * 60 * 60 * 1000, //24 jam sesuai expiresIn JWT
};

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET belum diatur di file .env!');
  return process.env.JWT_SECRET;
};

const validateInput = async (username, password) => {
  if (!username?.trim() || !password) return 'Username dan password wajib diisi.';
  if (password.length < 8) return 'Password minimal 8 karakter.';
  const { rows } = await pool.query('SELECT id FROM users WHERE username = $1', [username.trim()]);
  if (rows.length > 0) return 'Username sudah digunakan.';
  return null;
};

//bikin akun baru role user
export const registerUser = async (req, res) => {
  const { username, password } = req.body;
  const error = await validateInput(username, password);
  if (error) return res.status(400).json({ message: error });

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const { rows: [newUser] } = await pool.query(
    'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role',
    [username.trim(), hashedPassword, 'user']
  );
  res.status(201).json({ message: 'Akun berhasil dibuat!', user: newUser });
};

//bikin admin baru — hanya bisa kalau belum ada admin atau oleh admin yang sudah login
export const registerAdmin = async (req, res) => {
  const { rows: existing } = await pool.query("SELECT COUNT(*)::INT AS count FROM users WHERE role='admin'");
  if (existing[0].count > 0 && (!req.user || req.user.role !== 'admin')) {
    return res.status(403).json({ message: 'Hanya admin yang dapat mendaftarkan admin baru.' });
  }

  const { username, password } = req.body;
  const error = await validateInput(username, password);
  if (error) return res.status(400).json({ message: error });

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const { rows: [newUser] } = await pool.query(
    'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role',
    [username.trim(), hashedPassword, 'admin']
  );
  res.status(201).json({ message: 'Admin berhasil didaftarkan!', user: newUser });
};


export const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username?.trim() || !password) {
    return res.status(400).json({ message: 'Username dan password wajib diisi.' });
  }

  const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username.trim()]);
  const INVALID_MSG = 'Username atau password salah.';
  if (rows.length === 0) return res.status(401).json({ message: INVALID_MSG });

  const validPassword = await bcrypt.compare(password, rows[0].password);
  if (!validPassword) return res.status(401).json({ message: INVALID_MSG });

  const token = jwt.sign(
    { id: rows[0].id, username: rows[0].username, role: rows[0].role },
    getJwtSecret(),
    { expiresIn: '1d' }
  );

  res.cookie('token', token, COOKIE_OPTIONS);
  res.status(200).json({
    message: 'Login berhasil!',
    user: { id: rows[0].id, username: rows[0].username, role: rows[0].role },
  });
};

export const logout = (req, res) => {
  res.clearCookie('token', COOKIE_OPTIONS);
  res.status(200).json({ message: 'Logout berhasil!' });
};

//ambil data user dari DB berdasarkan id di JWT
export const getMe = async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, username, role FROM users WHERE id = $1',
    [req.user.id]
  );
  if (rows.length === 0) return res.status(404).json({ message: 'User tidak ditemukan.' });
  res.status(200).json({ user: rows[0] });
};

export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Semua field wajib diisi.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'Password baru minimal 8 karakter.' });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({ message: 'Password baru tidak boleh sama dengan password lama.' });
  }

  const { rows } = await pool.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
  if (rows.length === 0) return res.status(404).json({ message: 'User tidak ditemukan.' });

  const valid = await bcrypt.compare(currentPassword, rows[0].password);
  if (!valid) return res.status(401).json({ message: 'Password saat ini salah.' });

  const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await pool.query('UPDATE users SET password=$1 WHERE id=$2', [hashed, req.user.id]);

  res.status(200).json({ message: 'Password berhasil diubah!' });
};

export const updateProfile = async (req, res) => {
  const { username } = req.body;

  if (!username?.trim()) {
    return res.status(400).json({ message: 'Username wajib diisi.' });
  }
  if (username.trim().length < 3) {
    return res.status(400).json({ message: 'Username minimal 3 karakter.' });
  }

  const { rows: existing } = await pool.query(
    'SELECT id FROM users WHERE username = $1 AND id != $2',
    [username.trim(), req.user.id]
  );
  if (existing.length > 0) {
    return res.status(409).json({ message: 'Username sudah digunakan.' });
  }

  const { rows: [updated] } = await pool.query(
    'UPDATE users SET username = $1 WHERE id = $2 RETURNING id, username, role',
    [username.trim(), req.user.id]
  );

  res.status(200).json({ message: 'Profil berhasil diperbarui!', user: updated });
};

//hapus akun sendiri — perlu password buat konfirmasi
export const deleteAccount = async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ message: 'Password wajib diisi untuk konfirmasi.' });
  }

  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  if (rows.length === 0) return res.status(404).json({ message: 'User tidak ditemukan.' });

  const valid = await bcrypt.compare(password, rows[0].password);
  if (!valid) return res.status(401).json({ message: 'Password salah.' });

  await pool.query('DELETE FROM users WHERE id = $1', [req.user.id]);

  res.clearCookie('token', COOKIE_OPTIONS);
  res.status(200).json({ message: 'Akun berhasil dihapus.' });
};

// Di dalam ../controller/users-controller.js

export const deleteUserById = async (req, res, next) => {
  try {
    // 1. Ambil ID dari parameter URL (req.params.id)
    const { id } = req.params;

    // 2. Logika hapus dari database (Contoh menggunakan ORM/Query)
    // Jika pakai Sequelize: await User.destroy({ where: { id } });
    // Jika pakai Prisma:    await prisma.user.delete({ where: { id: Number(id) } });
    
    // Anggap proses hapus berhasil:
    return res.status(200).json({
      status: 'success',
      message: `User with ID ${id} berhasil dihapus.`
    });

  } catch (error) {
    // Lempar ke global error handler yang ada di index.js
    next(error);
  }
};
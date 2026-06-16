import jwt from 'jsonwebtoken';

//middleware untuk membaca JWT dari cookie, verify, set req.user, lanjut ke controller
export const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ message: 'Akses ditolak! Silakan login terlebih dahulu.' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    const message = error.name === 'TokenExpiredError'
      ? 'Sesi telah berakhir, silakan login kembali.'
      : 'Token tidak valid!';
    res.status(403).json({ message });
  }
};

//middleware untuk panggil verifyToken dulu baru cek role admin
export const verifyAdmin = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Akses ditolak! Hanya admin yang diizinkan.' });
    }
    next();
  });
};
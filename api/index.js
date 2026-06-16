import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import usersRouter     from '../routes/users-router.js';
import productsRouter  from '../routes/products-router.js';
import ordersRouter    from '../routes/orders-router.js';
import addressesRouter from '../routes/addresses-router.js';
import shippingRouter  from '../routes/shipping-router.js';
import categoriesRouter from '../routes/categories-router.js';

dotenv.config();
const app  = express();

//middleware global:
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());

//route registrations
app.use('/api/users',    usersRouter);
app.use('/api/products', productsRouter);
app.use('/api/orders',   ordersRouter);
app.use('/api/addresses',  addressesRouter);
app.use('/api/shipping',   shippingRouter);
app.use('/api/categories', categoriesRouter);

//root endpoint cek server hidup
app.get('/', (req, res) => res.json({ status: 'ok', message: 'Outerwear API berjalan! 🚀' }));

//404 handler
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} tidak ditemukan.` });
});

//global error handler
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.stack}`);
  res.status(err.status || 500).json({ message: err.message || 'Terjadi kesalahan pada server.' });
});

// Local development only
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server API berjalan di http://localhost:${PORT}`));
}

export default app;
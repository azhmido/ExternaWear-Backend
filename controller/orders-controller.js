import pool from '../config/db.js';
import { createXenditInvoice } from '../config/xendit.js';

const VALID_PAYMENT_METHODS = ['transfer_bank', 'e_wallet', 'qris', 'cod', 'credit_card'];

//mapping status dari webhook xendit ke status pesanan internal
const XENDIT_STATUS_MAP = {
  PAID:    'confirmed',
  EXPIRED: 'cancelled',
};

//mapping payment_method xendit dari webhook ke format internal
const XENDIT_PM_MAP = {
  BANK_TRANSFER:  'transfer_bank',
  EWALLET:        'e_wallet',
  QRIS:           'qris',
  QR_CODE:        'qris',
  CREDIT_CARD:    'credit_card',
  RETAIL_OUTLET:  'transfer_bank',
};

//agregasi data buat dashboard admin 
export const getStats = async (req, res) => {
  const [
    products, users, orders, revenue,
    revenueByDay, byStatus, topProducts, lowStock, byPaymentMethod,
  ] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM products'),
    pool.query("SELECT COUNT(*) FROM users WHERE role='user'"),
    pool.query('SELECT COUNT(*) FROM orders'),
    pool.query("SELECT COALESCE(SUM(total_price),0) FROM orders WHERE status!='cancelled'"),

    pool.query(`
      SELECT TO_CHAR(DATE(created_at),'DD Mon') AS date,
             COALESCE(SUM(total_price),0)::FLOAT AS revenue,
             COUNT(*)::INT AS orders
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '7 days' AND status != 'cancelled'
      GROUP BY DATE(created_at), TO_CHAR(DATE(created_at),'DD Mon')
      ORDER BY DATE(created_at)
    `),

    pool.query(`SELECT status, COUNT(*)::INT AS count FROM orders GROUP BY status`),

    pool.query(`
      SELECT p.name, p.category, SUM(oi.quantity)::INT AS total_sold
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      GROUP BY p.id, p.name, p.category
      ORDER BY total_sold DESC LIMIT 5
    `),

    pool.query(`
      SELECT p.name, p.category, s.size, s.stock
      FROM product_stocks s
      JOIN products p ON s.product_id = p.id
      WHERE s.stock <= 5
      ORDER BY s.stock ASC LIMIT 10
    `),

    pool.query(`
      SELECT payment_method,
             COUNT(*)::INT AS count,
             COALESCE(SUM(total_price),0)::FLOAT AS revenue
      FROM orders
      WHERE status != 'cancelled'
      GROUP BY payment_method ORDER BY count DESC
    `),
  ]);

  res.status(200).json({
    totalProducts:    parseInt(products.rows[0].count),
    totalUsers:       parseInt(users.rows[0].count),
    totalOrders:      parseInt(orders.rows[0].count),
    totalRevenue:     parseFloat(revenue.rows[0].coalesce),
    revenueByDay:     revenueByDay.rows,
    byStatus:         byStatus.rows,
    topProducts:      topProducts.rows,
    lowStock:         lowStock.rows,
    byPaymentMethod:  byPaymentMethod.rows,
  });
};

//semua pesanan dipanggil di dashboard admin
export const getAllOrders = async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page) || 1);
  const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const countResult = await pool.query('SELECT COUNT(*) FROM orders');
  const total = parseInt(countResult.rows[0].count);

  const { rows } = await pool.query(`
    SELECT o.*, u.username,
      json_agg(json_build_object(
        'product_name', oi.product_name,
        'size', oi.size, 'quantity', oi.quantity, 'price', oi.price
      ) ORDER BY oi.id) AS items
    FROM orders o
    JOIN users u ON o.user_id = u.id
    JOIN order_items oi ON o.id = oi.order_id
    GROUP BY o.id, u.username
    ORDER BY o.created_at DESC
    LIMIT $1 OFFSET $2
  `, [limit, offset]);

  res.status(200).json({
    data: rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
};

//pesanan milik user yang login
export const getMyOrders = async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page) || 1);
  const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
  const offset = (page - 1) * limit;

  const countResult = await pool.query(
    'SELECT COUNT(*) FROM orders WHERE user_id = $1',
    [req.user.id]
  );
  const total = parseInt(countResult.rows[0].count);

  const { rows } = await pool.query(`
    SELECT o.*,
      json_agg(json_build_object(
        'product_name', oi.product_name,
        'size', oi.size, 'quantity', oi.quantity, 'price', oi.price
      ) ORDER BY oi.id) AS items
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    WHERE o.user_id = $1
    GROUP BY o.id
    ORDER BY o.created_at DESC
    LIMIT $2 OFFSET $3
  `, [req.user.id, limit, offset]);

  res.status(200).json({
    data: rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
};

//detail satu pesanan dipanggil frontend pas halaman payment status
export const getOrderById = async (req, res) => {
  const { rows } = await pool.query(`
    SELECT o.*,
      json_agg(json_build_object(
        'product_name', oi.product_name,
        'size', oi.size, 'quantity', oi.quantity, 'price', oi.price
      ) ORDER BY oi.id) AS items
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    WHERE o.id = $1 AND o.user_id = $2
    GROUP BY o.id
  `, [req.params.id, req.user.id]);

  if (rows.length === 0) return res.status(404).json({ message: 'Pesanan tidak ditemukan.' });
  res.status(200).json(rows[0]);
};

//buat pesanan dan invoice xendit dalam 1 transaksi DB 
export const createOrder = async (req, res) => {
  const { items, deliveryInfo, paymentMethod, addressId } = req.body;

  if (!items || items.length === 0)
    return res.status(400).json({ message: 'Keranjang belanja kosong.' });
  if (!paymentMethod || !VALID_PAYMENT_METHODS.includes(paymentMethod))
    return res.status(400).json({ message: 'Metode pembayaran tidak valid.' });

  let resolvedDelivery = deliveryInfo ? { ...deliveryInfo } : {};
  if (addressId) {
    const { rows } = await pool.query(
      'SELECT name, phone, address, city, postal_code FROM user_addresses WHERE id = $1 AND user_id = $2',
      [addressId, req.user.id]
    );
    if (rows.length === 0) {
      return res.status(400).json({ message: 'Alamat tidak ditemukan.' });
    }
    resolvedDelivery = {
      name: rows[0].name,
      phone: rows[0].phone,
      address: rows[0].address,
      city: rows[0].city,
      postalCode: rows[0].postal_code,
    };
  }

  if (!resolvedDelivery?.name || !resolvedDelivery?.phone || !resolvedDelivery?.address) {
    return res.status(400).json({ message: 'Info pengiriman wajib diisi.' });
  }

  //hitung ongkos kirim berdasarkan kota
  const itemsTotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  let shippingCost = 0;
  if (resolvedDelivery.city) {
    const { rows: rates } = await pool.query(
      'SELECT cost FROM shipping_rates WHERE LOWER(city) = LOWER($1)',
      [resolvedDelivery.city]
    );
    shippingCost = rates.length > 0 ? Number(rates[0].cost) : 50000;
  }
  const totalPrice = itemsTotal + shippingCost;
  resolvedDelivery.shippingCost = shippingCost;

  const client     = await pool.connect();

  try {
    await client.query('BEGIN');

    //simpan pesanan ke DB
    const { rows: [order] } = await client.query(
      'INSERT INTO orders (user_id, total_price, delivery_info, payment_method) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.user.id, totalPrice, JSON.stringify(resolvedDelivery), paymentMethod]
    );

    //simpan items + kurangi stok
    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id,product_id,product_name,size,quantity,price)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [order.id, item.product_id, item.product_name, item.size, item.quantity, item.price]
      );
      await client.query(
        `UPDATE product_stocks SET stock = stock - $1
         WHERE product_id=$2 AND size=$3 AND stock >= $1`,
        [item.quantity, item.product_id, item.size]
      );
    }

    //COD tidak perlu payment gateway
    if (paymentMethod === 'cod') {
      await client.query('COMMIT');
      return res.status(201).json({
        message: 'Pesanan COD berhasil dibuat!',
        order,
        paymentUrl: null,
        isCod: true,
      });
    }

    //non-COD buat xendit Invoice
    const invoice = await createXenditInvoice({
      orderId:       order.id,
      amount:        totalPrice,
      username:      req.user.username,
      description:   `ExternaWear - EW-${String(order.id).padStart(6, '0')} (${items.length} item)`,
      items,
    });

    //update order dengan data invoice xendit
    await client.query(
      `UPDATE orders
       SET xendit_invoice_id=$1, xendit_payment_url=$2, xendit_status=$3
       WHERE id=$4`,
      [invoice.id, invoice.invoice_url, invoice.status, order.id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message:    'Pesanan berhasil dibuat! Mengarahkan ke halaman pembayaran...',
      order:      { ...order, xendit_invoice_id: invoice.id, xendit_payment_url: invoice.invoice_url },
      paymentUrl: invoice.invoice_url,
      isCod:      false,
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[CREATE ORDER ERROR]', error.message);
    return res.status(500).json({ message: 'Gagal membuat pesanan. Silakan coba lagi.' });
  } finally {
    client.release();
  }
};

//batalkan pesanan oleh user
//hanya bisa cancel kalau status masih 'pending'
export const cancelOrder = async (req, res) => {
  const { rows } = await pool.query(
    "UPDATE orders SET status='cancelled' WHERE id=$1 AND user_id=$2 AND status='pending' RETURNING *",
    [req.params.id, req.user.id]
  );
  if (rows.length === 0) {
    return res.status(400).json({ message: 'Pesanan tidak dapat dibatalkan.' });
  }

  //kembalikan stok
  const { rows: items } = await pool.query(
    'SELECT product_id, size, quantity FROM order_items WHERE order_id = $1',
    [req.params.id]
  );
  for (const item of items) {
    await pool.query(
      'UPDATE product_stocks SET stock = stock + $1 WHERE product_id = $2 AND size = $3',
      [item.quantity, item.product_id, item.size]
    );
  }

  res.status(200).json({ message: 'Pesanan berhasil dibatalkan.', order: rows[0] });
};

//ganti status pesanan oleh admin
export const updateOrderStatus = async (req, res) => {
  const { status } = req.body;
  const valid = ['pending','confirmed','shipped','delivered','cancelled'];
  if (!valid.includes(status))
    return res.status(400).json({ message: 'Status tidak valid.' });

  const { rows } = await pool.query(
    'UPDATE orders SET status=$1 WHERE id=$2 RETURNING *',
    [status, req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ message: 'Pesanan tidak ditemukan.' });
  res.status(200).json({ message: 'Status diperbarui!', order: rows[0] });
};

//hapus pesanan oleh admin
export const deleteOrder = async (req, res) => {
  const { rows } = await pool.query(
    'DELETE FROM orders WHERE id=$1 RETURNING id',
    [req.params.id]
  );
  if (rows.length === 0)
    return res.status(404).json({ message: 'Pesanan tidak ditemukan.' });
  res.status(200).json({ message: 'Pesanan berhasil dihapus!' });
};

//xenditwebhook dipanggil xendit saat status pembayaran berubah
export const xenditWebhook = async (req, res) => {
  //verifikasi token dari header x callback token harus cocok dengan .env
  const callbackToken = req.headers['x-callback-token'];
  if (!callbackToken || callbackToken !== process.env.XENDIT_WEBHOOK_TOKEN) {
    console.warn('[WEBHOOK] Token tidak valid:', callbackToken);
    return res.status(403).json({ message: 'Unauthorized webhook' });
  }

  const { id: xenditInvoiceId, status, external_id, payment_method } = req.body;

  console.log(`[WEBHOOK] Invoice ${xenditInvoiceId} → ${status}`);

  try {
    const orderId = external_id?.replace('EW-ORDER-', '');
    if (!orderId || isNaN(Number(orderId))) {
      console.error('[WEBHOOK] external_id tidak valid:', external_id);
      return res.status(400).json({ message: 'Invalid external_id' });
    }

    const newStatus    = XENDIT_STATUS_MAP[status];       //mapping PAID kd confirmed EXPIRED kd cancelled
    const mappedMethod = XENDIT_PM_MAP[payment_method];   //mapping metode pembayaran Xendit ke internal

    if (newStatus) {
      //cegah overwrite kalau user udah cancel manual
      const result = await pool.query(
        `UPDATE orders
         SET status          = $1,
             xendit_status   = $2,
             payment_method  = COALESCE($3, payment_method)
         WHERE id = $4 AND xendit_invoice_id = $5 AND status != 'cancelled'`,
        [newStatus, status, mappedMethod || null, orderId, xenditInvoiceId]
      );

      if (result.rowCount > 0) {
        console.log(`[WEBHOOK] Order #${orderId} → ${newStatus} ✅`);

        //kembalikan stok produk
        if (newStatus === 'cancelled') {
          const { rows: items } = await pool.query(
            'SELECT product_id, size, quantity FROM order_items WHERE order_id = $1',
            [orderId]
          );
          for (const item of items) {
            await pool.query(
              'UPDATE product_stocks SET stock = stock + $1 WHERE product_id = $2 AND size = $3',
              [item.quantity, item.product_id, item.size]
            );
          }
        }
      } else {
        console.log(`[WEBHOOK] Order #${orderId} sudah ${newStatus}, dilewati.`);
      }
    }

    //balas 200 xendit akan retry kalau dapet 500
    res.status(200).json({ message: 'Webhook processed' });

  } catch (error) {
    console.error('[WEBHOOK ERROR]', error.message);
    res.status(200).json({ message: 'Webhook received with error' });
  }
};
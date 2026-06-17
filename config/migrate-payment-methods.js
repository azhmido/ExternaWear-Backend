import pool from './db.js';
import { xenditFetch } from './xendit.js';

const XENDIT_PM_MAP = {
  BANK_TRANSFER:  'transfer_bank',
  EWALLET:        'e_wallet',
  QRIS:           'qris',
  QR_CODE:        'qris',
  CREDIT_CARD:    'credit_card',
  RETAIL_OUTLET:  'transfer_bank',
  BCA:            'transfer_bank',
  BNI:            'transfer_bank',
  BRI:            'transfer_bank',
  MANDIRI:        'transfer_bank',
  PERMATA:        'transfer_bank',
  OVO:            'e_wallet',
  DANA:           'e_wallet',
  SHOPEEPAY:      'e_wallet',
  LINKAJA:        'e_wallet',
  ALFAMART:       'transfer_bank',
  INDOMARET:      'transfer_bank',
};

const migrate = async () => {
  console.log('🔍 Mencari order Xendit PAID yang perlu diperbarui payment_method...\n');

  const { rows: orders } = await pool.query(`
    SELECT id, xendit_invoice_id, payment_method, xendit_status
    FROM orders
    WHERE xendit_status = 'PAID'
      AND payment_method = 'transfer_bank'
      AND xendit_invoice_id IS NOT NULL
    ORDER BY id
  `);

  if (orders.length === 0) {
    console.log('✅ Tidak ada order yang perlu diperbaiki.');
    await pool.end();
    return;
  }

  console.log(`📦 Menemukan ${orders.length} order untuk dicek ke Xendit API...\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const order of orders) {
    try {
      const invoice = await xenditFetch(`/v2/invoices/${order.xendit_invoice_id}`, 'GET');
      const actualMethod = invoice.payment_method;
      const actualChannel = invoice.payment_channel;
      const mappedMethod = XENDIT_PM_MAP[actualMethod] || XENDIT_PM_MAP[actualChannel];

      if (!mappedMethod) {
        console.log(`  ⚠️  Order #${order.id}: ${actualMethod || '-'}/${actualChannel || '-'} → tidak dikenal, dilewati`);
        skipped++;
        continue;
      }

      if (mappedMethod === order.payment_method) {
        console.log(`  ➖ Order #${order.id}: ${actualChannel || actualMethod} → ${mappedMethod} (sama, skip)`);
        skipped++;
        continue;
      }

      await pool.query(
        'UPDATE orders SET payment_method = $1 WHERE id = $2',
        [mappedMethod, order.id]
      );

      console.log(`  ✅ Order #${order.id}: ${actualChannel || actualMethod} → ${mappedMethod} ✓`);
      updated++;
    } catch (err) {
      console.error(`  ❌ Order #${order.id} gagal: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n📊 Selesai! ${updated} diperbarui, ${skipped} dilewati, ${errors} gagal.`);
  await pool.end();
};

migrate();

const XENDIT_BASE_URL = 'https://api.xendit.co';

//encode secret key ke base64 format otentikasi Xendit
const getAuthHeader = () => {
  const encoded = Buffer.from(`${process.env.XENDIT_SECRET_KEY}:`).toString('base64');
  return `Basic ${encoded}`;
};

//wrapper fetch ke Xendit handle method, header, body, error
const xenditFetch = async (endpoint, method = 'GET', body = null) => {
  const options = {
    method,
    headers: {
      'Authorization': getAuthHeader(),
      'Content-Type':  'application/json',
    },
  };
  if (body) options.body = JSON.stringify(body);

  const res  = await fetch(`${XENDIT_BASE_URL}${endpoint}`, options);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || `Xendit API error [${res.status}]`);
  }
  return data;
};

//buat invoice hosted user di redirect ke halaman ini
export const createXenditInvoice = async ({
  orderId,
  amount,
  username,
  description,
  items,
}) => {
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

  const payload = {
    external_id:          `EW-ORDER-${orderId}`,
    amount,
    description,
    currency:             'IDR',
    customer:             { given_names: username },
    success_redirect_url: `${clientOrigin}/payment/success?order_id=${orderId}`,
    failure_redirect_url: `${clientOrigin}/payment/failure?order_id=${orderId}`,
    items: items.map(item => ({
      name:     item.product_name,
      quantity: item.quantity,
      price:    item.price,
      category: 'Outerwear',
    })),
  };

  return xenditFetch('/v2/invoices', 'POST', payload);
};
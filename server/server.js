require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const pg = require('pg');
const paymentRoutes = require('./routes/payment');

const app = express();
const PORT = process.env.PORT || 3000;

// Force PostgreSQL to return BIGINT and NUMERIC columns as JavaScript Numbers
pg.types.setTypeParser(20, val => parseInt(val, 10));
pg.types.setTypeParser(1700, val => parseFloat(val));

const { Pool } = pg;

// PostgreSQL Connection Setup
const DATABASE_URL = (process.env.DATABASE_URL || '').trim();
let pool = null;

if (DATABASE_URL && !DATABASE_URL.includes('YOUR_')) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  console.log('🐘 PostgreSQL Pool configured with DATABASE_URL!');
} else {
  console.log('⚠️ WARNING: DATABASE_URL is missing in Environment Variables!');
}

// Fallback JSON Files
const ORDERS_FILE = path.join(__dirname, 'orders.json');
const PRODUCTS_FILE = path.join(__dirname, 'products.json');
const SETTINGS_FILE = path.join(__dirname, 'settings.json');
const CATEGORIES_FILE = path.join(__dirname, 'categories.json');
const REVIEWS_FILE = path.join(__dirname, 'reviews.json');

const PREVIEWS_DIR = path.join(__dirname, '..', 'public', 'previews');
const PROTECTED_BOOKS_DIR = path.join(__dirname, 'protected_books');

if (!fs.existsSync(PREVIEWS_DIR)) fs.mkdirSync(PREVIEWS_DIR, { recursive: true });
if (!fs.existsSync(PROTECTED_BOOKS_DIR)) fs.mkdirSync(PROTECTED_BOOKS_DIR, { recursive: true });

const DEFAULT_CATEGORIES = [
  { id: 1, name: "Online Books", icon: "📚", isPaywallBook: true },
  { id: 2, name: "Electronics", icon: "💻", isPaywallBook: false },
  { id: 3, name: "Fashion", icon: "👕", isPaywallBook: false },
  { id: 4, name: "Home Essentials", icon: "🏠", isPaywallBook: false }
];

const DEFAULT_PRODUCTS = [
  {
    id: 1,
    name: "Starting a Business in Ghana (PDF Guide)",
    author: "Kwame Mensah",
    price: 50,
    pages: 145,
    category: "Online Books",
    image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400",
    description: "The complete practical guide to starting, funding, and running a profitable business in Ghana.",
    previewUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    hasProtectedFile: false
  },
  {
    id: 2,
    name: "Personal Finance & T-Bill Investment (eBook)",
    author: "E. Osei",
    price: 45,
    pages: 110,
    category: "Online Books",
    image: "https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=400",
    description: "Learn how to budget, save, and invest in Treasury Bills and real estate in Ghana.",
    previewUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    hasProtectedFile: false
  }
];

const DEFAULT_SETTINGS = {
  storeName: "Shop with ease",
  announcement: "⚡ Welcome! Pay instantly via Paystack or Direct MoMo to Mary Appiah (0536473017) 🇬🇭",
  heroTitle: "Quality Products & Instant eBooks",
  heroSubtitle: "Read previews for free. Pay with Paystack or send Direct MoMo to get instant download access.",
  whatsappNumber: "233536473017",
  supportPhone: "0536473017",
  supportEmail: "support@shopwithease.com",
  shopAddress: "Accra, Ghana",
  momoName: "Mary Appiah",
  momoNumber: "0536473017"
};

function getJsonFile(file, defaultData) {
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8') || '[]'); } catch (e) {}
  return defaultData;
}
function saveJsonFile(file, data) {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); } catch (e) {}
}

// Auto-Initialize Postgres Tables
async function initDb() {
  if (!pool) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id BIGINT PRIMARY KEY,
        name TEXT, author TEXT, price NUMERIC, pages INT,
        category TEXT, image TEXT, description TEXT,
        preview_url TEXT, has_protected_file BOOLEAN, download_url TEXT
      );
      CREATE TABLE IF NOT EXISTS categories (
        id BIGINT PRIMARY KEY, name TEXT, icon TEXT, is_paywall_book BOOLEAN
      );
      CREATE TABLE IF NOT EXISTS settings (
        id INT PRIMARY KEY DEFAULT 1,
        data JSONB
      );
      CREATE TABLE IF NOT EXISTS orders (
        reference TEXT PRIMARY KEY,
        amount NUMERIC, customer_email TEXT, customer_name TEXT,
        phone TEXT, address TEXT, items TEXT, status TEXT,
        delivery_note TEXT, downloads JSONB, is_direct_momo BOOLEAN, paid_at TEXT
      );
      CREATE TABLE IF NOT EXISTS reviews (
        id BIGINT PRIMARY KEY, product_id BIGINT, name TEXT, rating INT, comment TEXT, date TEXT
      );
    `);

    const pCheck = await pool.query('SELECT COUNT(*) FROM products');
    if (Number(pCheck.rows[0].count) === 0) {
      for (const p of DEFAULT_PRODUCTS) {
        await pool.query(
          `INSERT INTO products (id, name, author, price, pages, category, image, description, preview_url, has_protected_file, download_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT DO NOTHING`,
          [p.id, p.name, p.author || '', p.price, p.pages || 0, p.category, p.image, p.description || '', p.previewUrl || '', p.hasProtectedFile || false, p.downloadUrl || '']
        );
      }
    }

    const cCheck = await pool.query('SELECT COUNT(*) FROM categories');
    if (Number(cCheck.rows[0].count) === 0) {
      for (const c of DEFAULT_CATEGORIES) {
        await pool.query(`INSERT INTO categories (id, name, icon, is_paywall_book) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`, [c.id, c.name, c.icon, c.isPaywallBook]);
      }
    }

    const sCheck = await pool.query('SELECT COUNT(*) FROM settings');
    if (Number(sCheck.rows[0].count) === 0) {
      await pool.query(`INSERT INTO settings (id, data) VALUES (1, $1) ON CONFLICT DO NOTHING`, [JSON.stringify(DEFAULT_SETTINGS)]);
    }
    console.log('✅ PostgreSQL Tables Ready!');
  } catch (err) {
    console.error('❌ DB Init Error:', err.message);
  }
}

initDb();

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/api/payment', paymentRoutes);

// 🔍 DIAGNOSTIC ENDPOINT (Visit this in browser to check DB connection status)
app.get('/api/db-check', async (req, res) => {
  if (!pool) {
    return res.json({
      connected: false,
      reason: 'DATABASE_URL environment variable is missing on Render!'
    });
  }
  try {
    const q = await pool.query('SELECT COUNT(*) FROM products');
    res.json({
      connected: true,
      message: 'PostgreSQL Database is Connected and Live! 🐘',
      productCount: Number(q.rows[0].count)
    });
  } catch (err) {
    res.json({
      connected: false,
      error: err.message
    });
  }
});

// Public APIs
app.get('/api/categories', async (req, res) => {
  if (pool) {
    try {
      const q = await pool.query('SELECT id, name, icon, is_paywall_book AS "isPaywallBook" FROM categories ORDER BY id ASC');
      if (q.rows.length) return res.json(q.rows);
    } catch(e){ console.error('PG Cat Error:', e.message); }
  }
  res.json(getJsonFile(CATEGORIES_FILE, DEFAULT_CATEGORIES));
});

app.get('/api/products', async (req, res) => {
  let products = [];
  let reviews = [];

  if (pool) {
    try {
      const pQ = await pool.query('SELECT id, name, author, price, pages, category, image, description, preview_url AS "previewUrl" FROM products ORDER BY id DESC');
      const rQ = await pool.query('SELECT * FROM reviews');
      products = pQ.rows;
      reviews = rQ.rows;
    } catch(e){ console.error('PG Prod Fetch Error:', e.message); }
  }

  if (!products.length) products = getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);

  const safeProducts = products.map(p => {
    const prodReviews = reviews.filter(r => Number(r.product_id || r.productId) === Number(p.id));
    const avgRating = prodReviews.length > 0 ? (prodReviews.reduce((sum, r) => sum + Number(r.rating), 0) / prodReviews.length).toFixed(1) : "5.0";
    return {
      id: Number(p.id), name: p.name, author: p.author, price: Number(p.price),
      pages: p.pages, category: p.category, image: p.image, description: p.description,
      previewUrl: p.previewUrl, rating: avgRating, reviewsCount: prodReviews.length || 1
    };
  });
  res.json(safeProducts);
});

app.get('/api/products/:id/preview', async (req, res) => {
  let p = null;
  if (pool) {
    try {
      const q = await pool.query('SELECT id, name, author, price, pages, category, image, description, preview_url AS "previewUrl" FROM products WHERE id = $1', [Number(req.params.id)]);
      p = q.rows[0];
    } catch(e){}
  }
  if (!p) p = getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS).find(x => x.id === Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'Book not found' });
  res.json(p);
});

app.get('/api/settings', async (req, res) => {
  if (pool) {
    try {
      const q = await pool.query('SELECT data FROM settings WHERE id = 1');
      if (q.rows.length) return res.json(q.rows[0].data);
    } catch(e){}
  }
  res.json(getJsonFile(SETTINGS_FILE, DEFAULT_SETTINGS));
});

// Admin Auth
function verifyAdmin(req, res, next) {
  if (req.body.password !== (process.env.ADMIN_PASSWORD || 'admin123')) return res.status(401).json({ success: false });
  next();
}

app.post('/api/admin/orders', verifyAdmin, async (req, res) => {
  if (pool) {
    try {
      const q = await pool.query('SELECT reference, amount, customer_email AS "customerEmail", customer_name AS "customerName", phone, address, items, status, delivery_note AS "deliveryNote", downloads, is_direct_momo AS "isDirectMomo", paid_at AS "paidAt" FROM orders ORDER BY paid_at DESC');
      return res.json({ success: true, orders: q.rows });
    } catch(e){}
  }
  res.json({ success: true, orders: getJsonFile(ORDERS_FILE, []).reverse() });
});

// Save Product directly into PostgreSQL Database
app.post('/api/admin/products/save', verifyAdmin, async (req, res) => {
  const p = req.body.product;
  const prodId = p.id ? Number(p.id) : Date.now();
  let previewUrl = p.previewUrl || '';
  let hasProtectedFile = p.hasProtectedFile || false;

  if (p.previewPdfBase64 && p.previewPdfBase64.startsWith('data:application/pdf;base64,')) {
    const base64Data = p.previewPdfBase64.replace(/^data:application\/pdf;base64,/, '');
    fs.writeFileSync(path.join(PREVIEWS_DIR, `preview_${prodId}.pdf`), base64Data, 'base64');
    previewUrl = `/previews/preview_${prodId}.pdf`;
  }
  if (p.fullPdfBase64 && p.fullPdfBase64.startsWith('data:application/pdf;base64,')) {
    const base64Data = p.fullPdfBase64.replace(/^data:application\/pdf;base64,/, '');
    fs.writeFileSync(path.join(PROTECTED_BOOKS_DIR, `book_${prodId}.pdf`), base64Data, 'base64');
    hasProtectedFile = true;
  }

  if (pool) {
    try {
      await pool.query(`
        INSERT INTO products (id, name, author, price, pages, category, image, description, preview_url, has_protected_file, download_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name, author = EXCLUDED.author, price = EXCLUDED.price,
          category = EXCLUDED.category, image = EXCLUDED.image, description = EXCLUDED.description,
          preview_url = EXCLUDED.preview_url, has_protected_file = EXCLUDED.has_protected_file, download_url = EXCLUDED.download_url
      `, [prodId, p.name, p.author || '', Number(p.price), Number(p.pages || 0), p.category, p.image, p.description || '', previewUrl, hasProtectedFile, p.downloadUrl || '']);
      console.log('✅ Saved product directly to PostgreSQL Cloud Database:', p.name);
    } catch(err){ console.error('❌ PG Product Save Error:', err.message); }
  }

  // Backup to JSON file
  let products = getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);
  if (p.id) {
    const idx = products.findIndex(x => x.id === Number(p.id));
    if (idx !== -1) products[idx] = { ...products[idx], id: prodId, name: p.name, author: p.author || '', price: Number(p.price), category: p.category, image: p.image, description: p.description || '', previewUrl, hasProtectedFile, downloadUrl: p.downloadUrl || '' };
  } else { products.push({ id: prodId, name: p.name, author: p.author || '', price: Number(p.price), category: p.category, image: p.image, description: p.description || '', previewUrl, hasProtectedFile, downloadUrl: p.downloadUrl || '' }); }
  saveJsonFile(PRODUCTS_FILE, products);

  res.json({ success: true });
});

app.post('/api/admin/products/delete', verifyAdmin, async (req, res) => {
  const pId = Number(req.body.productId);
  if (pool) {
    try { await pool.query('DELETE FROM products WHERE id = $1', [pId]); } catch(e){}
  }
  saveJsonFile(PRODUCTS_FILE, getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS).filter(p => p.id !== pId));
  res.json({ success: true });
});

app.post('/api/admin/categories/save', verifyAdmin, async (req, res) => {
  const c = req.body.category;
  const cId = c.id ? Number(c.id) : Date.now();
  if (pool) {
    try {
      await pool.query(`
        INSERT INTO categories (id, name, icon, is_paywall_book) VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, icon = EXCLUDED.icon, is_paywall_book = EXCLUDED.is_paywall_book
      `, [cId, c.name.trim(), c.icon || '🛍️', Boolean(c.isPaywallBook)]);
    } catch(e){}
  }
  res.json({ success: true });
});

app.post('/api/admin/settings/save', verifyAdmin, async (req, res) => {
  const s = req.body.settings;
  if (pool) {
    try {
      await pool.query('INSERT INTO settings (id, data) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data', [JSON.stringify(s)]);
    } catch(e){}
  }
  saveJsonFile(SETTINGS_FILE, { ...getJsonFile(SETTINGS_FILE, DEFAULT_SETTINGS), ...s });
  res.json({ success: true });
});

// Direct MoMo Order
app.post('/api/payment/direct-momo', async (req, res) => {
  const { name, email, phone, address, transactionId, amount, cartItems, itemsSummary } = req.body;
  if (!email || !transactionId || !amount) return res.status(400).json({ success: false });

  let products = [];
  if (pool) {
    try { const q = await pool.query('SELECT * FROM products'); products = q.rows; } catch(e){}
  }
  if (!products.length) products = getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);

  let downloads = [];
  if (Array.isArray(cartItems)) {
    cartItems.forEach(item => {
      const matched = products.find(p => p.id === item.id || p.name === item.name);
      if (matched && (matched.has_protected_file || matched.download_url || matched.category === 'Online Books')) {
        downloads.push({ name: item.name, downloadUrl: `/api/download/${transactionId}/${matched.id}` });
      }
    });
  }

  if (pool) {
    try {
      await pool.query(`
        INSERT INTO orders (reference, amount, customer_email, customer_name, phone, address, items, status, downloads, is_direct_momo, paid_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (reference) DO NOTHING
      `, [String(transactionId).trim(), Number(amount), email, name || 'Customer', phone, address || 'Accra', itemsSummary, 'Awaiting MoMo Verification', JSON.stringify(downloads), true, new Date().toISOString()]);
    } catch(e){}
  }

  res.json({ success: true, reference: String(transactionId).trim() });
});

// Download Gatekeeper
app.get('/api/download/:ref/:id', async (req, res) => {
  const { ref, id } = req.params;
  let order = null;
  let product = null;

  if (pool) {
    try {
      const oQ = await pool.query('SELECT * FROM orders WHERE LOWER(reference) = LOWER($1)', [ref]);
      const pQ = await pool.query('SELECT * FROM products WHERE id = $1', [Number(id)]);
      order = oQ.rows[0];
      product = pQ.rows[0];
    } catch(e){}
  }

  if (!order) order = getJsonFile(ORDERS_FILE, []).find(o => o.reference && o.reference.toLowerCase() === ref.toLowerCase());
  if (!order) return res.status(403).send('Access Denied.');
  if (order.status === 'Awaiting MoMo Verification') return res.status(403).send('Waiting for MoMo verification.');

  if (!product) product = getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS).find(p => p.id === Number(id));
  if (!product) return res.status(404).send('Book not found.');

  const storedFilePath = path.join(PROTECTED_BOOKS_DIR, `book_${id}.pdf`);
  if (fs.existsSync(storedFilePath)) {
    return res.download(storedFilePath, `${product.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
  }
  if (product.download_url || product.downloadUrl) return res.redirect(product.download_url || product.downloadUrl);
  res.status(404).send('File not found.');
});

// Page routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));
app.get('/preview/:id', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'preview.html')));
app.get(['/cart', '/cart.html'], (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'cart.html')));
app.get(['/checkout', '/checkout.html'], (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'checkout.html')));
app.get(['/success', '/success.html'], (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'success.html')));
app.get(['/admin', '/admin.html'], (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));
app.get(['/track', '/track.html'], (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'track.html')));

app.listen(PORT, () => console.log("🚀 Server running on port " + PORT));
module.exports = app;

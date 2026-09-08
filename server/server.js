require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const paymentRoutes = require('./routes/payment');

const app = express();
const PORT = process.env.PORT || 3000;

const ORDERS_FILE = path.join(__dirname, 'orders.json');
const PRODUCTS_FILE = path.join(__dirname, 'products.json');
const SETTINGS_FILE = path.join(__dirname, 'settings.json');
const CATEGORIES_FILE = path.join(__dirname, 'categories.json');

const PREVIEWS_DIR = path.join(__dirname, '..', 'public', 'previews');
const PROTECTED_BOOKS_DIR = path.join(__dirname, 'protected_books');

if (!fs.existsSync(PREVIEWS_DIR)) fs.mkdirSync(PREVIEWS_DIR, { recursive: true });
if (!fs.existsSync(PROTECTED_BOOKS_DIR)) fs.mkdirSync(PROTECTED_BOOKS_DIR, { recursive: true });

// Clean Categories (No Results Checkers)
const DEFAULT_CATEGORIES = [
  { id: 1, name: "Online Books", icon: "📚", isPaywallBook: true },
  { id: 2, name: "Electronics", icon: "💻", isPaywallBook: false },
  { id: 3, name: "Fashion", icon: "👕", isPaywallBook: false },
  { id: 4, name: "Home Essentials", icon: "🏠", isPaywallBook: false }
];

// Clean Products List
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
  },
  {
    id: 3,
    name: "Wireless Headphones",
    price: 250,
    category: "Electronics",
    image: "https://picsum.photos/id/1/400/300",
    description: "Premium noise cancellation headphones with deep bass."
  }
];

const DEFAULT_SETTINGS = {
  storeName: "Shop with ease",
  announcement: "⚡ Read sample previews for free! Full PDF unlocked right after MoMo payment 🇬🇭",
  heroTitle: "Quality Products & Instant eBooks",
  heroSubtitle: "Read sample book previews for free. Pay securely with MoMo or Card to unlock full books.",
  whatsappNumber: "233536473017",
  supportPhone: "0536473017",
  supportEmail: "support@shopwithease.com",
  shopAddress: "Accra, Ghana"
};

function getJsonFile(file, defaultData) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8') || '[]');
  } catch (e) {}
  return defaultData;
}

function saveJsonFile(file, data) {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); } catch (e) {}
}

if (!fs.existsSync(PRODUCTS_FILE)) saveJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);
if (!fs.existsSync(SETTINGS_FILE)) saveJsonFile(SETTINGS_FILE, DEFAULT_SETTINGS);
if (!fs.existsSync(CATEGORIES_FILE)) saveJsonFile(CATEGORIES_FILE, DEFAULT_CATEGORIES);

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/api/payment', paymentRoutes);

// Public APIs
app.get('/api/categories', (req, res) => res.json(getJsonFile(CATEGORIES_FILE, DEFAULT_CATEGORIES)));

app.get('/api/products', (req, res) => {
  const products = getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);
  res.json(products.map(p => ({
    id: p.id,
    name: p.name,
    author: p.author,
    price: p.price,
    pages: p.pages,
    category: p.category,
    image: p.image,
    description: p.description,
    previewUrl: p.previewUrl
  })));
});

app.get('/api/products/:id/preview', (req, res) => {
  const products = getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);
  const p = products.find(x => x.id === Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'Book not found' });
  res.json(p);
});

app.get('/api/settings', (req, res) => res.json(getJsonFile(SETTINGS_FILE, DEFAULT_SETTINGS)));

// Protected Download Gatekeeper
app.get('/api/download/:ref/:id', (req, res) => {
  const { ref, id } = req.params;
  const orders = getJsonFile(ORDERS_FILE, []);
  const products = getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);

  const order = orders.find(o => o.reference && o.reference.toLowerCase() === ref.toLowerCase());
  if (!order) return res.status(403).send('Access Denied.');

  const product = products.find(p => p.id === Number(id));
  if (!product) return res.status(404).send('Book not found.');

  const storedFilePath = path.join(PROTECTED_BOOKS_DIR, `book_${id}.pdf`);
  if (fs.existsSync(storedFilePath)) {
    const cleanFileName = `${product.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    return res.download(storedFilePath, cleanFileName);
  }
  if (product.downloadUrl) return res.redirect(product.downloadUrl);
  res.status(404).send('File not found.');
});

// ORDER VERIFICATION (eBooks & Products Only - No Vouchers)
app.get('/api/orders/:ref', async (req, res) => {
  const ref = (req.params.ref || '').trim();
  const orders = getJsonFile(ORDERS_FILE, []);
  const products = getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);
  let order = orders.find(o => o.reference && o.reference.toLowerCase() === ref.toLowerCase());

  if (order) return res.json({ success: true, order });

  try {
    const ps = (process.env.PAYSTACK_SECRET_KEY || '').trim();
    const pr = await axios.get(`https://api.paystack.co/transaction/verify/${ref}`, { headers: { Authorization: `Bearer ${ps}` } });
    if (pr.data.status && pr.data.data.status === 'success') {
      const tx = pr.data.data;
      const cartItems = tx.metadata?.cartItems || [];

      let downloads = [];
      if (Array.isArray(cartItems) && cartItems.length > 0) {
        cartItems.forEach(item => {
          const matched = products.find(p => p.id === item.id || p.name === item.name);
          if (matched && (matched.hasProtectedFile || matched.downloadUrl || matched.category === 'Online Books')) {
            downloads.push({ name: item.name, downloadUrl: `/api/download/${tx.reference}/${matched.id}` });
          }
        });
      }

      const isDigital = downloads.length > 0;
      const no = {
        reference: tx.reference,
        amount: tx.amount / 100,
        customerEmail: tx.customer.email,
        customerName: tx.metadata?.customerName || tx.customer.email,
        phone: tx.metadata?.phone || (tx.authorization?.mobile_money_number || 'N/A'),
        address: tx.metadata?.address || 'Accra',
        items: tx.metadata?.itemsSummary || 'Order Items',
        status: isDigital ? 'Delivered' : 'Packaging',
        downloads: downloads,
        paidAt: tx.paid_at || new Date().toISOString()
      };

      orders.push(no);
      saveJsonFile(ORDERS_FILE, orders);
      return res.json({ success: true, order: no });
    }
  } catch (err) {}
  res.status(404).json({ success: false, message: 'Order not found' });
});

// Admin Auth
function verifyAdmin(req, res, next) {
  const { password } = req.body;
  if (password !== (process.env.ADMIN_PASSWORD || 'admin123')) {
    return res.status(401).json({ success: false, message: 'Incorrect Admin Password' });
  }
  next();
}

app.post('/api/admin/orders', verifyAdmin, (req, res) => res.json({ success: true, orders: getJsonFile(ORDERS_FILE, []).reverse() }));

app.post('/api/admin/update-progress', verifyAdmin, (req, res) => {
  const { reference, status, deliveryNote } = req.body;
  const orders = getJsonFile(ORDERS_FILE, []);
  const order = orders.find(o => o.reference && o.reference.toLowerCase() === (reference || '').toLowerCase());
  if (order) {
    order.status = status || order.status;
    order.deliveryNote = deliveryNote || '';
    order.updatedAt = new Date().toISOString();
    saveJsonFile(ORDERS_FILE, orders);
    return res.json({ success: true, message: 'Order updated' });
  }
  res.status(404).json({ success: false, message: 'Order not found' });
});

app.post('/api/admin/products/save', verifyAdmin, (req, res) => {
  let products = getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);
  const p = req.body.product;
  const prodId = p.id ? Number(p.id) : Date.now();
  let previewUrl = p.previewUrl || '';
  let hasProtectedFile = p.hasProtectedFile || false;

  if (p.previewPdfBase64 && p.previewPdfBase64.startsWith('data:application/pdf;base64,')) {
    const base64Data = p.previewPdfBase64.replace(/^data:application\/pdf;base64,/, '');
    const previewFileName = `preview_${prodId}.pdf`;
    fs.writeFileSync(path.join(PREVIEWS_DIR, previewFileName), base64Data, 'base64');
    previewUrl = `/previews/${previewFileName}`;
  }

  if (p.fullPdfBase64 && p.fullPdfBase64.startsWith('data:application/pdf;base64,')) {
    const base64Data = p.fullPdfBase64.replace(/^data:application\/pdf;base64,/, '');
    fs.writeFileSync(path.join(PROTECTED_BOOKS_DIR, `book_${prodId}.pdf`), base64Data, 'base64');
    hasProtectedFile = true;
  }

  const updatedProduct = {
    id: prodId,
    name: p.name,
    author: p.author || '',
    price: Number(p.price),
    category: p.category,
    image: p.image,
    description: p.description || '',
    previewUrl: previewUrl,
    hasProtectedFile: hasProtectedFile,
    downloadUrl: p.downloadUrl || ''
  };

  if (p.id) {
    const idx = products.findIndex(x => x.id === Number(p.id));
    if (idx !== -1) products[idx] = { ...products[idx], ...updatedProduct };
  } else {
    products.push(updatedProduct);
  }

  saveJsonFile(PRODUCTS_FILE, products);
  res.json({ success: true });
});

app.post('/api/admin/products/delete', verifyAdmin, (req, res) => {
  let products = getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS).filter(p => p.id !== Number(req.body.productId));
  saveJsonFile(PRODUCTS_FILE, products);
  res.json({ success: true });
});

app.post('/api/admin/categories/save', verifyAdmin, (req, res) => {
  const { category } = req.body;
  let categories = getJsonFile(CATEGORIES_FILE, DEFAULT_CATEGORIES);
  if (category.id) {
    const idx = categories.findIndex(c => c.id === Number(category.id));
    if (idx !== -1) categories[idx] = { ...categories[idx], ...category, id: Number(category.id) };
  } else {
    categories.push({ id: Date.now(), name: category.name.trim(), icon: category.icon || '🛍️', isPaywallBook: Boolean(category.isPaywallBook) });
  }
  saveJsonFile(CATEGORIES_FILE, categories);
  res.json({ success: true, categories });
});

app.post('/api/admin/categories/delete', verifyAdmin, (req, res) => {
  let categories = getJsonFile(CATEGORIES_FILE, DEFAULT_CATEGORIES).filter(c => c.id !== Number(req.body.categoryId));
  saveJsonFile(CATEGORIES_FILE, categories);
  res.json({ success: true, categories });
});

app.post('/api/admin/settings/save', verifyAdmin, (req, res) => {
  saveJsonFile(SETTINGS_FILE, { ...getJsonFile(SETTINGS_FILE, DEFAULT_SETTINGS), ...req.body.settings });
  res.json({ success: true });
});

// Page routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));
app.get('/preview/:id', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'preview.html')));
app.get(['/cart', '/cart.html'], (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'cart.html')));
app.get(['/checkout', '/checkout.html'], (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'checkout.html')));
app.get(['/success', '/success.html'], (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'success.html')));
app.get(['/track', '/track.html'], (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'track.html')));
app.get(['/admin', '/admin.html'], (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));

app.listen(PORT, () => console.log("🚀 Shop with ease is live on Port: " + PORT));
module.exports = app;

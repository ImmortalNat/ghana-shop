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
    description: "The complete practical guide to starting a business in Ghana.",
    previewUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
  }
];

const DEFAULT_SETTINGS = {
  storeName: "Shop with ease",
  announcement: "⚡ Welcome! Pay via Paystack or Direct MoMo to 0536473017",
  heroTitle: "Quality Products & Instant eBooks",
  heroSubtitle: "Read previews for free. Pay with Paystack or send Direct MoMo.",
  whatsappNumber: "233536473017",
  momoName: "Mary Appiah",
  momoNumber: "0536473017"
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

// ==================== 🔄 AUTOMATIC GITHUB SYNC ENGINE ====================
async function syncToGithub(filename, content) {
  const token = (process.env.GITHUB_TOKEN || '').trim();
  const repo = (process.env.GITHUB_REPO || 'ImmortalNat/ghana-shop').trim();

  if (!token || token.includes('YOUR_')) {
    console.log(`[Local Save Only] File ${filename} updated locally.`);
    return;
  }

  try {
    const filePath = `server/${filename}`;
    const url = `https://api.github.com/repos/${repo}/contents/${filePath}`;
    
    // Get current SHA of file
    let sha = '';
    try {
      const currentFile = await axios.get(url, { headers: { Authorization: `token ${token}` } });
      sha = currentFile.data.sha;
    } catch (e) {}

    const base64Content = Buffer.from(JSON.stringify(content, null, 2)).toString('base64');

    await axios.put(
      url,
      {
        message: `Auto-Sync: Updated ${filename} via Admin Panel`,
        content: base64Content,
        sha: sha || undefined
      },
      { headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' } }
    );

    console.log(`✅ [GitHub Auto-Sync] Successfully saved ${filename} directly into GitHub repository!`);
  } catch (err) {
    console.error('GitHub Sync Error:', err.response?.data || err.message);
  }
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
app.get('/api/products', (req, res) => res.json(getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS)));
app.get('/api/settings', (req, res) => res.json(getJsonFile(SETTINGS_FILE, DEFAULT_SETTINGS)));

// Admin Auth
function verifyAdmin(req, res, next) {
  if (req.body.password !== (process.env.ADMIN_PASSWORD || 'admin123')) return res.status(401).json({ success: false });
  next();
}

app.post('/api/admin/orders', verifyAdmin, (req, res) => res.json({ success: true, orders: getJsonFile(ORDERS_FILE, []).reverse() }));

// Save Product & Auto-Push to GitHub Repo
app.post('/api/admin/products/save', verifyAdmin, async (req, res) => {
  let products = getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);
  const p = req.body.product;
  const prodId = p.id ? Number(p.id) : Date.now();

  const updatedProduct = { id: prodId, name: p.name, author: p.author || '', price: Number(p.price), category: p.category, image: p.image, description: p.description || '', previewUrl: p.previewUrl || '', downloadUrl: p.downloadUrl || '' };
  
  if (p.id) {
    const idx = products.findIndex(x => x.id === Number(p.id));
    if (idx !== -1) products[idx] = { ...products[idx], ...updatedProduct };
  } else {
    products.push(updatedProduct);
  }

  saveJsonFile(PRODUCTS_FILE, products);
  await syncToGithub('products.json', products); // 🔄 Pushes directly to GitHub!

  res.json({ success: true });
});

app.post('/api/admin/products/delete', verifyAdmin, async (req, res) => {
  let products = getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS).filter(p => p.id !== Number(req.body.productId));
  saveJsonFile(PRODUCTS_FILE, products);
  await syncToGithub('products.json', products); // 🔄 Pushes directly to GitHub!
  res.json({ success: true });
});

app.post('/api/admin/categories/save', verifyAdmin, async (req, res) => {
  const { category } = req.body;
  let categories = getJsonFile(CATEGORIES_FILE, DEFAULT_CATEGORIES);
  if (category.id) {
    const idx = categories.findIndex(c => c.id === Number(category.id));
    if (idx !== -1) categories[idx] = { ...categories[idx], ...category, id: Number(category.id) };
  } else {
    categories.push({ id: Date.now(), name: category.name.trim(), icon: category.icon || '🛍️', isPaywallBook: Boolean(category.isPaywallBook) });
  }
  saveJsonFile(CATEGORIES_FILE, categories);
  await syncToGithub('categories.json', categories); // 🔄 Pushes directly to GitHub!
  res.json({ success: true, categories });
});

app.post('/api/admin/settings/save', verifyAdmin, async (req, res) => {
  const updated = { ...getJsonFile(SETTINGS_FILE, DEFAULT_SETTINGS), ...req.body.settings };
  saveJsonFile(SETTINGS_FILE, updated);
  await syncToGithub('settings.json', updated); // 🔄 Pushes directly to GitHub!
  res.json({ success: true });
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

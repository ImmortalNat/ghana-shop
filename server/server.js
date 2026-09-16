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
const DELIVERY_FILE = path.join(__dirname, 'delivery.json');

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

// Pre-configured Jumia-style Ghana Regions & Towns Delivery Fees
const DEFAULT_DELIVERY = [
  // Greater Accra Region
  { id: 1, region: "Greater Accra", town: "East Legon / Shiashie / Bawaleshie", fee: 25 },
  { id: 2, region: "Greater Accra", town: "Madina / Adenta / Abokobi", fee: 30 },
  { id: 3, region: "Greater Accra", town: "Circle / Osu / Ridge / Cantonments", fee: 20 },
  { id: 4, region: "Greater Accra", town: "Spintex / Teshie / Nungua", fee: 30 },
  { id: 5, region: "Greater Accra", town: "Dansoman / Kaneshie / Lapaz", fee: 25 },
  { id: 6, region: "Greater Accra", town: "Tema / Ashaiman / Dawhenya", fee: 40 },
  { id: 7, region: "Greater Accra", town: "Kasoa / Weija / Mallam", fee: 35 },
  { id: 8, region: "Greater Accra", town: "Legon Campus / UPSA", fee: 20 },

  // Ashanti Region
  { id: 9, region: "Ashanti", town: "Kumasi Central (Adum / Asafo)", fee: 45 },
  { id: 10, region: "Ashanti", town: "KNUST / Ayigya / Ayeduase", fee: 50 },
  { id: 11, region: "Ashanti", town: "Bantama / Suame / Suntreso", fee: 45 },
  { id: 12, region: "Ashanti", town: "Tafo / Alabar / Mamponteng", fee: 50 },

  // Western Region
  { id: 13, region: "Western", town: "Sekondi-Takoradi Central", fee: 55 },
  { id: 14, region: "Western", town: "Tarkwa / UMaT Campus", fee: 60 },

  // Central Region
  { id: 15, region: "Central", town: "Cape Coast / UCC Campus", fee: 50 },
  { id: 16, region: "Central", town: "Winneba / UEW Campus", fee: 45 },

  // Eastern Region
  { id: 17, region: "Eastern", town: "Koforidua Central", fee: 45 },
  { id: 18, region: "Eastern", town: "Nsawam / Aburi", fee: 40 },

  // Northern Region
  { id: 19, region: "Northern", town: "Tamale Central", fee: 65 },

  // Volta Region
  { id: 20, region: "Volta", town: "Ho Central", fee: 50 },

  // Bono Region
  { id: 21, region: "Bono", town: "Sunyani Central", fee: 60 }
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
    id: 3,
    name: "Wireless Headphones",
    price: 250,
    category: "Electronics",
    image: "https://picsum.photos/id/1/400/300",
    description: "Premium noise cancellation headphones with deep bass."
  }
];

const DEFAULT_REVIEWS = [
  { id: 1, productId: 1, name: "Kofi Owusu", rating: 5, comment: "100% Legit! Paid with MTN MoMo and the PDF downloaded immediately.", date: "2025-02-15" }
];

const DEFAULT_SETTINGS = {
  storeName: "Shop with ease",
  announcement: "⚡ Welcome! Pay instantly via Paystack or Direct MoMo to Mary Appiah (0536473017) 🇬🇭",
  heroTitle: "Quality Products & Instant eBooks",
  heroSubtitle: "Read previews for free. Pay with Paystack or send Direct MoMo to get instant access.",
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

if (!fs.existsSync(PRODUCTS_FILE)) saveJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);
if (!fs.existsSync(SETTINGS_FILE)) saveJsonFile(SETTINGS_FILE, DEFAULT_SETTINGS);
if (!fs.existsSync(CATEGORIES_FILE)) saveJsonFile(CATEGORIES_FILE, DEFAULT_CATEGORIES);
if (!fs.existsSync(REVIEWS_FILE)) saveJsonFile(REVIEWS_FILE, DEFAULT_REVIEWS);
if (!fs.existsSync(DELIVERY_FILE)) saveJsonFile(DELIVERY_FILE, DEFAULT_DELIVERY);

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/api/payment', paymentRoutes);

// Public APIs
app.get('/api/categories', (req, res) => res.json(getJsonFile(CATEGORIES_FILE, DEFAULT_CATEGORIES)));
app.get('/api/delivery', (req, res) => res.json(getJsonFile(DELIVERY_FILE, DEFAULT_DELIVERY)));

app.get('/api/products', (req, res) => {
  const products = getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);
  const reviews = getJsonFile(REVIEWS_FILE, DEFAULT_REVIEWS);
  const safeProducts = products.map(p => {
    const prodReviews = reviews.filter(r => Number(r.productId) === Number(p.id));
    const avgRating = prodReviews.length > 0 ? (prodReviews.reduce((sum, r) => sum + Number(r.rating), 0) / prodReviews.length).toFixed(1) : "5.0";
    return { id: p.id, name: p.name, author: p.author, price: p.price, pages: p.pages, category: p.category, image: p.image, description: p.description, previewUrl: p.previewUrl, rating: avgRating, reviewsCount: prodReviews.length || 1 };
  });
  res.json(safeProducts);
});

app.get('/api/products/:id/preview', (req, res) => {
  const p = getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS).find(x => x.id === Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'Book not found' });
  res.json(p);
});

app.get('/api/reviews/:productId', (req, res) => {
  res.json(getJsonFile(REVIEWS_FILE, DEFAULT_REVIEWS).filter(r => Number(r.productId) === Number(req.params.productId)).reverse());
});

app.post('/api/reviews', (req, res) => {
  const { productId, name, rating, comment } = req.body;
  if (!productId || !name || !rating || !comment) return res.status(400).json({ success: false });
  const reviews = getJsonFile(REVIEWS_FILE, DEFAULT_REVIEWS);
  const newR = { id: Date.now(), productId: Number(productId), name: name.trim(), rating: Number(rating) || 5, comment: comment.trim(), date: new Date().toISOString().split('T')[0] };
  reviews.push(newR);
  saveJsonFile(REVIEWS_FILE, reviews);
  res.json({ success: true, review: newR });
});

app.get('/api/settings', (req, res) => res.json(getJsonFile(SETTINGS_FILE, DEFAULT_SETTINGS)));

// Sitemaps
app.get('/sitemap.xml', (req, res) => {
  const baseUrl = process.env.BASE_URL || 'https://shop-wave-shop.onrender.com';
  const products = getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  ['', '/cart', '/checkout', '/track'].forEach(page => { xml += `  <url><loc>${baseUrl}${page}</loc><changefreq>daily</changefreq><priority>${page === '' ? '1.0' : '0.8'}</priority></url>\n`; });
  products.forEach(p => { xml += `  <url><loc>${baseUrl}/preview/${p.id}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>\n`; });
  xml += `</urlset>`;
  res.header('Content-Type', 'application/xml');
  res.header('Cache-Control', 'public, max-age=86400');
  res.status(200).send(xml);
});

app.get('/robots.txt', (req, res) => {
  const baseUrl = process.env.BASE_URL || 'https://shop-wave-shop.onrender.com';
  res.type('text/plain');
  res.header('Cache-Control', 'public, max-age=86400');
  res.send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${baseUrl}/sitemap.xml`);
});

// Download Gatekeeper
app.get('/api/download/:ref/:id', (req, res) => {
  const { ref, id } = req.params;
  const order = getJsonFile(ORDERS_FILE, []).find(o => o.reference && o.reference.toLowerCase() === ref.toLowerCase());
  if (!order) return res.status(403).send('Access Denied. Order not verified.');
  if (order.status === 'Awaiting MoMo Verification') return res.status(403).send('Access Denied: Waiting for MoMo verification.');

  const product = getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS).find(p => p.id === Number(id));
  if (!product) return res.status(404).send('Book not found.');

  const storedFilePath = path.join(PROTECTED_BOOKS_DIR, `book_${id}.pdf`);
  if (fs.existsSync(storedFilePath)) {
    const cleanFileName = `${product.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    return res.download(storedFilePath, cleanFileName);
  }
  if (product.downloadUrl) return res.redirect(product.downloadUrl);
  res.status(404).send('File not found.');
});

// Direct MoMo Order
app.post('/api/payment/direct-momo', (req, res) => {
  const { name, email, phone, address, transactionId, amount, cartItems, itemsSummary } = req.body;
  if (!transactionId || !amount) return res.status(400).json({ success: false, message: 'Missing fields' });

  const orders = getJsonFile(ORDERS_FILE, []);
  const products = getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);

  let downloads = [];
  if (Array.isArray(cartItems)) {
    cartItems.forEach(item => {
      const matched = products.find(p => p.id === item.id || p.name === item.name);
      if (matched && (matched.hasProtectedFile || matched.downloadUrl || matched.category === 'Online Books')) {
        downloads.push({ name: item.name, downloadUrl: `/api/download/${transactionId}/${matched.id}` });
      }
    });
  }

  const newOrder = {
    reference: String(transactionId).trim(),
    amount: Number(amount),
    customerEmail: email || 'N/A',
    customerName: name || 'Direct MoMo Customer',
    phone: phone,
    address: address || 'Direct MoMo Transfer',
    items: itemsSummary,
    status: 'Awaiting MoMo Verification',
    downloads: downloads,
    isDirectMomo: true,
    paidAt: new Date().toISOString()
  };

  orders.push(newOrder);
  saveJsonFile(ORDERS_FILE, orders);
  res.json({ success: true, reference: transactionId.trim() });
});

// ORDER VERIFICATION
app.get('/api/orders/:ref', async (req, res) => {
  const ref = (req.params.ref || '').trim();
  const orders = getJsonFile(ORDERS_FILE, []);
  const products = getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);
  
  let order = orders.find(o => o.reference && o.reference.toLowerCase() === ref.toLowerCase());
  if (order) return res.json({ success: true, order });

  try {
    const ps = (process.env.PAYSTACK_SECRET_KEY || '').trim();
    if (ps) {
      const pr = await axios.get(`https://api.paystack.co/transaction/verify/${ref}`, { headers: { Authorization: `Bearer ${ps}` } });
      if (pr.data.status && pr.data.data.status === 'success') {
        const tx = pr.data.data;
        const cartItems = tx.metadata?.cartItems || [];

        let downloads = [];
        if (Array.isArray(cartItems)) {
          cartItems.forEach(item => {
            const matched = products.find(p => p.id === item.id || p.name === item.name);
            if (matched && (matched.hasProtectedFile || matched.downloadUrl || matched.category === 'Online Books')) {
              downloads.push({ name: item.name, downloadUrl: `/api/download/${tx.reference}/${matched.id}` });
            }
          });
        }

        const isDigitalOnly = downloads.length === cartItems.length && cartItems.length > 0;
        const no = {
          reference: tx.reference,
          amount: tx.amount / 100,
          customerEmail: tx.customer.email,
          customerName: tx.metadata?.customerName || tx.customer.email,
          phone: tx.metadata?.phone || 'N/A',
          address: tx.metadata?.address || 'Accra',
          items: tx.metadata?.itemsSummary || 'Store Order',
          status: isDigitalOnly ? 'Delivered' : 'Packaging',
          downloads: downloads,
          deliveryNote: isDigitalOnly ? 'Full book unlocked!' : 'Order is confirmed and being prepared.',
          paidAt: tx.paid_at || new Date().toISOString()
        };

        orders.push(no);
        saveJsonFile(ORDERS_FILE, orders);
        return res.json({ success: true, order: no });
      }
    }
  } catch (err) {}
  res.status(404).json({ success: false, message: 'Order not found' });
});

// ADMIN APIS
function verifyAdmin(req, res, next) {
  if (req.body.password !== (process.env.ADMIN_PASSWORD || 'admin123')) return res.status(401).json({ success: false });
  next();
}

app.post('/api/admin/orders', verifyAdmin, (req, res) => res.json({ success: true, orders: getJsonFile(ORDERS_FILE, []).reverse() }));
app.post('/api/admin/reviews', verifyAdmin, (req, res) => res.json({ success: true, reviews: getJsonFile(REVIEWS_FILE, DEFAULT_REVIEWS).reverse() }));
app.post('/api/admin/reviews/delete', verifyAdmin, (req, res) => {
  saveJsonFile(REVIEWS_FILE, getJsonFile(REVIEWS_FILE, DEFAULT_REVIEWS).filter(r => r.id !== Number(req.body.reviewId)));
  res.json({ success: true });
});

app.post('/api/admin/update-status', verifyAdmin, (req, res) => {
  const { reference, status, deliveryNote } = req.body;
  const orders = getJsonFile(ORDERS_FILE, []);
  const order = orders.find(o => o.reference && o.reference.toLowerCase() === (reference || '').toLowerCase());
  if (order) {
    order.status = status || order.status;
    order.deliveryNote = deliveryNote || '';
    order.updatedAt = new Date().toISOString();
    saveJsonFile(ORDERS_FILE, orders);
    return res.json({ success: true });
  }
  res.status(404).json({ success: false });
});

// Admin Delivery Locations API
app.post('/api/admin/delivery/save', verifyAdmin, (req, res) => {
  const { loc } = req.body;
  let locations = getJsonFile(DELIVERY_FILE, DEFAULT_DELIVERY);
  if (loc.id) {
    const idx = locations.findIndex(c => c.id === Number(loc.id));
    if (idx !== -1) locations[idx] = { ...locations[idx], ...loc, id: Number(loc.id), fee: Number(loc.fee) };
  } else {
    locations.push({ id: Date.now(), region: loc.region.trim(), town: loc.town.trim(), fee: Number(loc.fee) });
  }
  saveJsonFile(DELIVERY_FILE, locations);
  res.json({ success: true, locations });
});

app.post('/api/admin/delivery/delete', verifyAdmin, (req, res) => {
  let locations = getJsonFile(DELIVERY_FILE, DEFAULT_DELIVERY).filter(c => c.id !== Number(req.body.id));
  saveJsonFile(DELIVERY_FILE, locations);
  res.json({ success: true });
});

app.post('/api/admin/products/save', verifyAdmin, (req, res) => {
  let products = getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);
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
  const updatedProduct = { id: prodId, name: p.name, author: p.author || '', price: Number(p.price), category: p.category, image: p.image, description: p.description || '', previewUrl, hasProtectedFile, downloadUrl: p.downloadUrl || '' };
  if (p.id) {
    const idx = products.findIndex(x => x.id === Number(p.id));
    if (idx !== -1) products[idx] = { ...products[idx], ...updatedProduct };
  } else { products.push(updatedProduct); }
  saveJsonFile(PRODUCTS_FILE, products);
  res.json({ success: true });
});

app.post('/api/admin/products/delete', verifyAdmin, (req, res) => {
  saveJsonFile(PRODUCTS_FILE, getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS).filter(p => p.id !== Number(req.body.productId)));
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
  saveJsonFile(CATEGORIES_FILE, getJsonFile(CATEGORIES_FILE, DEFAULT_CATEGORIES).filter(c => c.id !== Number(req.body.categoryId)));
  res.json({ success: true });
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
app.get(['/admin', '/admin.html'], (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));
app.get(['/track', '/track.html'], (req, res) => {
  const trackPath = path.join(__dirname, '..', 'public', 'track.html');
  if (fs.existsSync(trackPath)) return res.sendFile(trackPath);
  res.send('<!DOCTYPE html><html><head><title>Track Order</title></head><body><h2>Please commit track.html to public folder</h2></body></html>');
});

app.listen(PORT, () => console.log("🚀 Server running on port " + PORT));
module.exports = app;

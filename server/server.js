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

const DEFAULT_REVIEWS = [
  { id: 1, productId: 1, name: "Kofi Owusu", rating: 5, comment: "100% Legit! Paid with MTN MoMo and the PDF downloaded immediately. Very practical guide.", date: "2025-02-15" },
  { id: 2, productId: 1, name: "Abena Serwaa", rating: 5, comment: "Best business book for Ghana. Clear steps on how to register and start without huge capital.", date: "2025-02-18" }
];

const DEFAULT_SETTINGS = {
  storeName: "Shop with ease",
  announcement: "⚡ Welcome! Pay instantly via Paystack or Direct MoMo to Mary Appiah (0536473017) 🇬🇭",
  heroTitle: "Quality Products & Instant eBooks",
  heroSubtitle: "Read previews for free. Pay with Paystack or send Direct MoMo to get instant download access.",
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
if (!fs.existsSync(REVIEWS_FILE)) saveJsonFile(REVIEWS_FILE, DEFAULT_REVIEWS);

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/api/payment', paymentRoutes);

// Public APIs
app.get('/api/categories', (req, res) => res.json(getJsonFile(CATEGORIES_FILE, DEFAULT_CATEGORIES)));

app.get('/api/products', (req, res) => {
  const products = getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);
  const reviews = getJsonFile(REVIEWS_FILE, DEFAULT_REVIEWS);

  const safeProducts = products.map(p => {
    const prodReviews = reviews.filter(r => Number(r.productId) === Number(p.id));
    const avgRating = prodReviews.length > 0 ? (prodReviews.reduce((sum, r) => sum + Number(r.rating), 0) / prodReviews.length).toFixed(1) : "5.0";
    return {
      id: p.id,
      name: p.name,
      author: p.author,
      price: p.price,
      pages: p.pages,
      category: p.category,
      image: p.image,
      description: p.description,
      previewUrl: p.previewUrl,
      rating: avgRating,
      reviewsCount: prodReviews.length || 1
    };
  });
  res.json(safeProducts);
});

app.get('/api/products/:id/preview', (req, res) => {
  const products = getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);
  const p = products.find(x => x.id === Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'Book not found' });
  res.json(p);
});

app.get('/api/reviews/:productId', (req, res) => {
  const reviews = getJsonFile(REVIEWS_FILE, DEFAULT_REVIEWS);
  res.json(reviews.filter(r => Number(r.productId) === Number(req.params.productId)).reverse());
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

// ==================== 🗺️ GOOGLE SITEMAP & ROBOTS.TXT ====================
app.get('/sitemap.xml', (req, res) => {
  const baseUrl = process.env.BASE_URL || 'https://shop-wave-shop.onrender.com';
  const products = getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  // Static core pages
  const staticPages = ['', '/cart', '/checkout', '/track'];
  staticPages.forEach(page => {
    xml += `  <url>\n`;
    xml += `    <loc>${baseUrl}${page}</loc>\n`;
    xml += `    <changefreq>daily</changefreq>\n`;
    xml += `    <priority>${page === '' ? '1.0' : '0.8'}</priority>\n`;
    xml += `  </url>\n`;
  });

  // Product / eBook Preview Pages
  products.forEach(p => {
    xml += `  <url>\n`;
    xml += `    <loc>${baseUrl}/preview/${p.id}</loc>\n`;
    xml += `    <changefreq>weekly</changefreq>\n`;
    xml += `    <priority>0.7</priority>\n`;
    xml += `  </url>\n`;
  });

  xml += `</urlset>`;

  res.header('Content-Type', 'application/xml');
  res.send(xml);
});

app.get('/robots.txt', (req, res) => {
  const baseUrl = process.env.BASE_URL || 'https://shop-wave-shop.onrender.com';
  res.type('text/plain');
  res.send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/download/\n\nSitemap: ${baseUrl}/sitemap.xml`);
});

// Protected Download Gatekeeper
app.get('/api/download/:ref/:id', (req, res) => {
  const { ref, id } = req.params;
  const orders = getJsonFile(ORDERS_FILE, []);
  const products = getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);

  const order = orders.find(o => o.reference && o.reference.toLowerCase() === ref.toLowerCase());
  if (!order) return res.status(403).send('Access Denied. Order not verified.');
  if (order.status === 'Awaiting MoMo Verification') return res.status(403).send('Access Denied: Waiting for MoMo verification.');

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

// Create Direct MoMo Order
app.post('/api/payment/direct-momo', (req, res) => {
  const { name, email, phone, transactionId, amount, cartItems, itemsSummary } = req.body;
  if (!email || !transactionId || !amount) return res.status(400).json({ success: false });

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
    reference: transactionId.trim(),
    amount: Number(amount),
    customerEmail: email,
    customerName: name || 'Direct MoMo Customer',
    phone: phone,
    address: 'Direct MoMo Transfer',
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
        phone: tx.metadata?.phone || 'N/A',
        address: 'Accra',
        items: tx.metadata?.itemsSummary || 'Store Order',
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
  if (password !== (process.env.ADMIN_PASSWORD || 'admin123')) return res.status(401).json({ success: false });
  next();
}

app.post('/api/admin/orders', verifyAdmin, (req, res) => res.json({ success: true, orders: getJsonFile(ORDERS_FILE, []).reverse() }));
app.post('/api/admin/reviews', verifyAdmin, (req, res) => res.json({ success: true, reviews: getJsonFile(REVIEWS_FILE, DEFAULT_REVIEWS).reverse() }));
app.post('/api/admin/reviews/delete', verifyAdmin, (req, res) => {
  saveJsonFile(REVIEWS_FILE, getJsonFile(REVIEWS_FILE, DEFAULT_REVIEWS).filter(r => r.id !== Number(req.body.reviewId)));
  res.json({ success: true });
});

app.post('/api/admin/update-status', verifyAdmin, (req, res) => {
  const { reference, status } = req.body;
  const orders = getJsonFile(ORDERS_FILE, []);
  const order = orders.find(o => o.reference && o.reference.toLowerCase() === (reference || '').toLowerCase());
  if (order) {
    order.status = status;
    order.updatedAt = new Date().toISOString();
    saveJsonFile(ORDERS_FILE, orders);
    return res.json({ success: true });
  }
  res.status(404).json({ success: false });
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
  } else {
    products.push(updatedProduct);
  }
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

// Dynamic Track Route
app.get(['/track', '/track.html'], (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Track Your Order - Shop with ease</title>
  <link rel="stylesheet" href="/css/styles.css">
  <style>
    .timeline { margin: 2rem 0; text-align: left; }
    .step { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.2rem; }
    .circle { width: 34px; height: 34px; border-radius: 50%; background: #dee2e6; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; }
    .circle.active { background: #ff6b35; }
    .circle.done { background: #28a745; }
    .note-card { background: #eef7f8; border-left: 5px solid #0a7e8c; padding: 1.2rem; border-radius: 8px; margin: 1.2rem 0; text-align: left; }
    .dl-btn { display: inline-flex; align-items: center; gap: 0.5rem; background: #28a745; color: white; font-size: 1.05rem; font-weight: bold; padding: 0.8rem 1.5rem; border-radius: 8px; text-decoration: none; margin-top: 0.5rem; }
  </style>
</head>
<body>
  <nav class="navbar"><a href="/" class="navbar-brand">🛍️ Shop with <span>ease</span></a><ul class="navbar-links"><li><a href="/">Home</a></li><li><a href="/cart">Cart</a></li></ul></nav>
  <div class="page-container" style="max-width:600px; margin-top:3rem; text-align:center;">
    <div style="background:#fff; padding:2rem; border-radius:10px; box-shadow:0 4px 15px rgba(0,0,0,0.05);">
      <h2>📦 Track Your Order</h2>
      <p style="color:#6c757d; margin:0.5rem 0 1.2rem;">Enter your Order Reference Code / MoMo Transaction ID:</p>
      <form id="f" style="display:flex; gap:0.5rem; margin-bottom:1.5rem;">
        <input type="text" id="ref" placeholder="Order Reference" required style="flex:1; padding:0.8rem; border:1.5px solid #ddd; border-radius:6px; font-size:1rem;">
        <button type="submit" class="btn" style="width:auto; padding:0.8rem 1.5rem; background:#0a7e8c;">Track</button>
      </form>
      <div id="res" style="display:none; text-align:left;">
        <h3 id="stText" style="color:#0a7e8c;"></h3>
        <div class="note-card" id="noteText"></div>
        <div id="detailsText" style="background:#f8f9fa; padding:1rem; border-radius:6px; font-size:0.9rem; line-height:1.6; border:1px solid #ddd;"></div>
        
        <div id="downloadContainer" style="display:none; margin-top:1.5rem;">
          <h4 style="color:#0a7e8c; margin-bottom:0.4rem;">📥 Your Unlocked PDF Downloads:</h4>
          <div id="downloadList"></div>
        </div>

        <div class="timeline">
          <div class="step"><div class="circle done" id="s1">✓</div><div><strong>1. Order Confirmed & Paid</strong></div></div>
          <div class="step"><div class="circle" id="s2">2</div><div><strong>2. Packaging & Processing</strong></div></div>
          <div class="step"><div class="circle" id="s3">3</div><div><strong>3. Out for Delivery (Rider Dispatched)</strong></div></div>
          <div class="step"><div class="circle" id="s4">4</div><div><strong>4. Delivered</strong></div></div>
        </div>
        <a id="wa" href="#" target="_blank" class="btn" style="background:#25D366; display:block; text-align:center; text-decoration:none; margin-top:1rem;">💬 Chat on WhatsApp</a>
      </div>
    </div>
  </div>
  <script>
    document.getElementById('f').onsubmit = async (e) => {
      e.preventDefault();
      const r = document.getElementById('ref').value.trim();
      const box = document.getElementById('res');
      box.style.display = 'block';
      document.getElementById('stText').textContent = 'Searching for order...';
      document.getElementById('downloadContainer').style.display = 'none';

      const res = await fetch('/api/orders/' + r);
      const data = await res.json();
      if (data.success) {
        const o = data.order;
        document.getElementById('stText').textContent = 'Status: ' + o.status;
        
        let statusNote = o.deliveryNote || 'Your order has been confirmed.';
        if (o.status === 'Awaiting MoMo Verification') {
          statusNote = '🔒 Awaiting Direct MoMo Verification. Please WhatsApp Mary Appiah (0536473017) with your Transaction Reference screenshot to instantly unlock your book download!';
        }
        document.getElementById('noteText').innerHTML = '<strong>Latest Update:</strong><br>' + statusNote;
        
        document.getElementById('detailsText').innerHTML = '<strong>Order Reference:</strong> ' + o.reference + '<br><strong>Customer:</strong> ' + o.customerName + '<br><strong>Amount:</strong> GH₵' + Number(o.amount).toFixed(2) + '<br><strong>Items:</strong> ' + o.items;
        
        if (o.downloads && o.downloads.length > 0 && o.status !== 'Awaiting MoMo Verification') {
          document.getElementById('downloadContainer').style.display = 'block';
          document.getElementById('downloadList').innerHTML = o.downloads.map(d => \`<div style="margin-bottom:0.5rem;"><strong>\${d.name}</strong><br><a href="\${d.downloadUrl}" target="_blank" class="dl-btn">📥 Download Complete PDF</a></div>\`).join('');
        }

        ['s1','s2','s3','s4'].forEach(id => document.getElementById(id).className = 'circle');
        document.getElementById('s1').className = 'circle done';
        if (o.status === 'Packaging') document.getElementById('s2').className = 'circle active';
        if (o.status === 'Out for Delivery') { document.getElementById('s2').className = 'circle done'; document.getElementById('s3').className = 'circle active'; }
        if (o.status === 'Delivered') { document.getElementById('s2').className = 'circle done'; document.getElementById('s3').className = 'circle done'; document.getElementById('s4').className = 'circle done'; }
        
        document.getElementById('wa').href = 'https://wa.me/233536473017?text=' + encodeURIComponent('Hello, I am checking my order with code: ' + o.reference);
      } else {
        document.getElementById('stText').innerHTML = '<span style="color:red;">❌ Order not found. Check reference code.</span>';
        document.getElementById('noteText').innerHTML = 'If you paid via Direct MoMo, please WhatsApp Mary Appiah (0536473017) directly to activate your download.';
        document.getElementById('detailsText').innerHTML = '';
      }
    };
    const urlRef = new URLSearchParams(window.location.search).get('ref');
    if (urlRef) { document.getElementById('ref').value = urlRef; document.getElementById('f').dispatchEvent(new Event('submit')); }
  </script>
</body>
</html>`);
});

app.listen(PORT, () => console.log("🚀 Server running on port " + PORT));
module.exports = app;

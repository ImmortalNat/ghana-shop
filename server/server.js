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
const VOUCHERS_FILE = path.join(__dirname, 'vouchers.json');
const CATEGORIES_FILE = path.join(__dirname, 'categories.json');

// Default initial categories
const DEFAULT_CATEGORIES = [
  { id: 1, name: "Online Books", icon: "📚", isPaywallBook: true },
  { id: 2, name: "Results Checker", icon: "🎫", isPaywallBook: false },
  { id: 3, name: "Electronics", icon: "💻", isPaywallBook: false },
  { id: 4, name: "Fashion", icon: "👕", isPaywallBook: false },
  { id: 5, name: "Home Essentials", icon: "🏠", isPaywallBook: false }
];

// Initial Catalog
const DEFAULT_PRODUCTS = [
  {
    id: 1,
    name: "Starting a Business in Ghana (PDF Guide)",
    author: "Kwame Mensah",
    price: 50,
    pages: 145,
    category: "Online Books",
    image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400",
    description: "Practical step-by-step roadmap to building and scaling a profitable business in Ghana.",
    previewUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", // Free sample
    downloadUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" // Full book (Protected)
  },
  {
    id: 2,
    name: "Personal Finance & T-Bill Investments (eBook)",
    author: "E. Osei",
    price: 45,
    pages: 110,
    category: "Online Books",
    image: "https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=400",
    description: "Learn how to budget, save, and invest in Treasury Bills and real estate in Ghana.",
    previewUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    downloadUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
  },
  {
    id: 101,
    name: "WASSCE Results Checker (Serial + PIN)",
    price: 22,
    category: "Results Checker",
    image: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400",
    description: "Instant Serial Number and PIN to check WASSCE School & Nov/Dec results on the official WAEC portal."
  },
  {
    id: 3,
    name: "Wireless Noise-Cancelling Headphones",
    price: 250,
    category: "Electronics",
    image: "https://picsum.photos/id/1/400/300",
    description: "Premium wireless headphones with deep bass and microphone."
  }
];

const DEFAULT_SETTINGS = {
  storeName: "Shop with ease",
  announcement: "⚡ Read sample previews for free! Full PDF unlocked right after MoMo payment 🇬🇭",
  heroTitle: "Results Checkers, eBooks & Quality Products",
  heroSubtitle: "Read sample book previews for free. Pay securely with MoMo or Card to unlock full books.",
  whatsappNumber: "233536473017",
  supportPhone: "0536473017",
  supportEmail: "support@shopwithease.com",
  shopAddress: "Accra, Ghana"
};

const DEFAULT_VOUCHERS = [
  { id: 1, type: "WASSCE", serial: "WASS24019283", pin: "849201948271", used: false },
  { id: 2, type: "BECE", serial: "BECE24091823", pin: "573829104829", used: false },
  { id: 3, type: "CSSPS", serial: "CSSPS2400192", pin: "192837465019", used: false }
];

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
if (!fs.existsSync(VOUCHERS_FILE)) saveJsonFile(VOUCHERS_FILE, DEFAULT_VOUCHERS);
if (!fs.existsSync(CATEGORIES_FILE)) saveJsonFile(CATEGORIES_FILE, DEFAULT_CATEGORIES);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/api/payment', paymentRoutes);

// ==================== PUBLIC STORE APIS ====================

// 1. Categories API
app.get('/api/categories', (req, res) => {
  res.json(getJsonFile(CATEGORIES_FILE, DEFAULT_CATEGORIES));
});

// 2. Safe Products API (Hides full downloadUrl from public view)
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
    previewUrl: p.previewUrl // Public sample preview
  })));
});

// 3. Book Preview API
app.get('/api/products/:id/preview', (req, res) => {
  const products = getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);
  const p = products.find(x => x.id === Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'Item not found' });
  res.json({
    id: p.id,
    name: p.name,
    author: p.author || 'N/A',
    price: p.price,
    pages: p.pages || '--',
    category: p.category,
    description: p.description,
    previewUrl: p.previewUrl || "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
  });
});

app.get('/api/settings', (req, res) => res.json(getJsonFile(SETTINGS_FILE, DEFAULT_SETTINGS)));

// ==================== ORDER VERIFICATION & UNLOCKING ====================
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

      let vouchers = getJsonFile(VOUCHERS_FILE, DEFAULT_VOUCHERS);
      let assignedCheckers = [];
      let downloads = [];

      if (Array.isArray(cartItems) && cartItems.length > 0) {
        cartItems.forEach(item => {
          const matched = products.find(p => p.id === item.id || p.name === item.name);
          
          // Allocate PINs for Results Checkers
          if (matched && matched.category === 'Results Checker') {
            const qty = item.qty || 1;
            for (let k = 0; k < qty; k++) {
              let typeKey = 'WASSCE';
              if (matched.name.includes('BECE')) typeKey = 'BECE';
              if (matched.name.includes('Placement') || matched.name.includes('CSSPS')) typeKey = 'CSSPS';

              let unused = vouchers.find(v => v.type === typeKey && !v.used);
              if (!unused) {
                unused = {
                  id: Date.now() + Math.random(),
                  type: typeKey,
                  serial: typeKey + '24' + Math.floor(100000 + Math.random() * 900000),
                  pin: Math.floor(100000000000 + Math.random() * 900000000000).toString(),
                  used: true,
                  assignedTo: tx.customer.email
                };
                vouchers.push(unused);
              } else {
                unused.used = true;
                unused.assignedTo = tx.customer.email;
              }

              assignedCheckers.push({
                itemName: matched.name,
                type: unused.type,
                serial: unused.serial,
                pin: unused.pin,
                portalUrl: unused.type === 'CSSPS' ? 'https://cssps.gov.gh' : 'https://ghana.waecdirect.org'
              });
            }
          }

          // Unlock Full PDF for paid Online Books
          if (matched && matched.downloadUrl) {
            downloads.push({ name: item.name, downloadUrl: matched.downloadUrl });
          }
        });
      }

      saveJsonFile(VOUCHERS_FILE, vouchers);

      const isDigital = assignedCheckers.length > 0 || downloads.length > 0;
      const no = {
        reference: tx.reference,
        amount: tx.amount / 100,
        customerEmail: tx.customer.email,
        customerName: tx.metadata?.customerName || tx.customer.email,
        phone: tx.metadata?.phone || (tx.authorization?.mobile_money_number || 'N/A'),
        address: tx.metadata?.address || 'Accra',
        items: tx.metadata?.itemsSummary || 'Order Items',
        status: isDigital ? 'Delivered' : 'Packaging',
        checkers: assignedCheckers,
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

// Admin Auth Middleware
function verifyAdmin(req, res, next) {
  const { password } = req.body;
  if (password !== (process.env.ADMIN_PASSWORD || 'admin123')) {
    return res.status(401).json({ success: false, message: 'Incorrect Admin Password' });
  }
  next();
}

app.post('/api/admin/orders', verifyAdmin, (req, res) => res.json({ success: true, orders: getJsonFile(ORDERS_FILE, []).reverse() }));

// ==================== DYNAMIC CATEGORIES CRUD ====================
app.post('/api/admin/categories/save', verifyAdmin, (req, res) => {
  const { category } = req.body;
  let categories = getJsonFile(CATEGORIES_FILE, DEFAULT_CATEGORIES);

  if (category.id) {
    const idx = categories.findIndex(c => c.id === Number(category.id));
    if (idx !== -1) {
      categories[idx] = { ...categories[idx], ...category, id: Number(category.id) };
    }
  } else {
    categories.push({
      id: Date.now(),
      name: category.name.trim(),
      icon: category.icon || '🛍️',
      isPaywallBook: Boolean(category.isPaywallBook)
    });
  }

  saveJsonFile(CATEGORIES_FILE, categories);
  res.json({ success: true, categories });
});

app.post('/api/admin/categories/delete', verifyAdmin, (req, res) => {
  const { categoryId } = req.body;
  let categories = getJsonFile(CATEGORIES_FILE, DEFAULT_CATEGORIES);
  categories = categories.filter(c => c.id !== Number(categoryId));
  saveJsonFile(CATEGORIES_FILE, categories);
  res.json({ success: true, categories });
});

// Products CRUD
app.post('/api/admin/products/save', verifyAdmin, (req, res) => {
  let products = getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);
  const p = req.body.product;
  if (p.id) {
    const i = products.findIndex(x => x.id === Number(p.id));
    if (i !== -1) products[i] = { ...products[i], ...p, id: Number(p.id), price: Number(p.price) };
  } else {
    products.push({ ...p, id: Date.now(), price: Number(p.price) });
  }
  saveJsonFile(PRODUCTS_FILE, products);
  res.json({ success: true });
});

app.post('/api/admin/products/delete', verifyAdmin, (req, res) => {
  let products = getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS).filter(p => p.id !== Number(req.body.productId));
  saveJsonFile(PRODUCTS_FILE, products);
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
app.get(['/track', '/track.html'], (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'track.html')));
app.get(['/admin', '/admin.html'], (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));

app.listen(PORT, () => console.log("🚀 Shop with ease is live on Port: " + PORT));
module.exports = app;

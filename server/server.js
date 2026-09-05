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

// Default initial catalog
const DEFAULT_PRODUCTS = [
  // 📚 eBooks with Free Preview + Paid Full Access
  {
    id: 1,
    name: "Starting a Business in Ghana (PDF Guide)",
    author: "Kwame Mensah",
    price: 50,
    pages: 145,
    category: "Online Books",
    image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400",
    description: "The complete practical guide to starting, funding, and running a profitable business in Ghana.",
    previewUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", // Free sample
    downloadUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" // Full book (Protected)
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
    downloadUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
  },
  // 🛍️ Physical Items
  {
    id: 3,
    name: "Wireless Headphones",
    price: 250,
    category: "Electronics",
    image: "https://picsum.photos/id/1/400/300",
    description: "Premium noise cancellation headphones with deep bass."
  },
  {
    id: 4,
    name: "Running Sneakers",
    price: 290,
    category: "Fashion",
    image: "https://picsum.photos/id/3/400/300",
    description: "Lightweight running shoes for daily workouts."
  }
];

const DEFAULT_SETTINGS = {
  storeName: "Shop with ease",
  announcement: "⚡ Read sample previews for free! Full PDF unlocked right after MoMo payment 🇬🇭",
  heroTitle: "Shop Quality Products & Instant eBooks",
  heroSubtitle: "Read sample book previews for free. Pay securely with MoMo or Card to download full books.",
  whatsappNumber: "233536473017",
  supportPhone: "0536473017",
  supportEmail: "support@shopwithease.com",
  shopAddress: "Accra, Ghana",
  aboutTitle: "About Shop with ease",
  aboutText: "We are Ghana's trusted store for quality physical items and softcopy educational books with instant MoMo checkout.",
  aboutImage: "https://images.unsplash.com/photo-1556742049-0a67e55722c3?w=600"
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

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/api/payment', paymentRoutes);

// PUBLIC PRODUCTS API (Secured: Strips full downloadUrl so customers cannot steal books)
app.get('/api/products', (req, res) => {
  const products = getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);
  const safeProducts = products.map(p => ({
    id: p.id,
    name: p.name,
    author: p.author,
    price: p.price,
    pages: p.pages,
    category: p.category,
    image: p.image,
    description: p.description,
    previewUrl: p.previewUrl // Public sample preview
  }));
  res.json(safeProducts);
});

// PREVIEW DETAILS API
app.get('/api/products/:id/preview', (req, res) => {
  const products = getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);
  const p = products.find(x => x.id === Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'Book not found' });
  res.json({
    id: p.id,
    name: p.name,
    author: p.author || 'N/A',
    price: p.price,
    pages: p.pages || '--',
    description: p.description,
    previewUrl: p.previewUrl || "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
  });
});

app.get('/api/settings', (req, res) => res.json(getJsonFile(SETTINGS_FILE, DEFAULT_SETTINGS)));

// ORDER VERIFICATION & FULL BOOK UNLOCK
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

      // Unlock complete full download URLs for paid books
      let downloads = [];
      if (Array.isArray(cartItems) && cartItems.length > 0) {
        cartItems.forEach(item => {
          const matched = products.find(p => p.id === item.id || p.name === item.name);
          if (matched && matched.downloadUrl) {
            downloads.push({ name: item.name, downloadUrl: matched.downloadUrl });
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
        deliveryNote: isDigital ? 'Full book unlocked! Download your complete PDF below.' : 'Order is being packaged for dispatch.',
        paidAt: tx.paid_at || new Date().toISOString()
      };

      orders.push(no);
      saveJsonFile(ORDERS_FILE, orders);
      return res.json({ success: true, order: no });
    }
  } catch (err) {}
  res.status(404).json({ success: false, message: 'Order not found' });
});

// Admin Authentication
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
    order.deliveryNote = deliveryNote || order.deliveryNote || '';
    order.updatedAt = new Date().toISOString();
    saveJsonFile(ORDERS_FILE, orders);
    return res.json({ success: true, message: 'Order updated' });
  }
  res.status(404).json({ success: false, message: 'Order not found' });
});

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
  const current = getJsonFile(SETTINGS_FILE, DEFAULT_SETTINGS);
  saveJsonFile(SETTINGS_FILE, { ...current, ...req.body.settings });
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

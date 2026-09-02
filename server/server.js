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

// Default initial products
const DEFAULT_PRODUCTS = [
  { id: 1, name: "Wireless Headphones", price: 250, image: "https://picsum.photos/id/1/400/300", description: "Premium noise cancellation headphones", category: "Electronics" },
  { id: 2, name: "Smart Watch", price: 380, image: "https://picsum.photos/id/2/400/300", description: "Health monitoring smartwatch", category: "Electronics" },
  { id: 3, name: "Running Sneakers", price: 290, image: "https://picsum.photos/id/3/400/300", description: "Lightweight running shoes", category: "Fashion" },
  { id: 4, name: "Leather Backpack", price: 180, image: "https://picsum.photos/id/4/400/300", description: "Genuine leather laptop backpack", category: "Fashion" },
  { id: 5, name: "Bluetooth Speaker", price: 130, image: "https://picsum.photos/id/5/400/300", description: "Waterproof portable speaker", category: "Electronics" },
  { id: 6, name: "Automatic Coffee Maker", price: 320, image: "https://picsum.photos/id/6/400/300", description: "Drip coffee machine", category: "Home" }
];

const DEFAULT_SETTINGS = {
  storeName: "Shop with ease",
  heroTitle: "Welcome to Shop with ease",
  heroSubtitle: "Pay easily with Mobile Money (MTN, Telecel, AT) or Bank Cards via Paystack.",
  whatsappNumber: "233536473017"
};

function getJsonFile(file, defaultData) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8') || '[]');
    }
  } catch (e) {}
  return defaultData;
}

function saveJsonFile(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('File save error:', e.message);
  }
}

if (!fs.existsSync(PRODUCTS_FILE)) saveJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);
if (!fs.existsSync(SETTINGS_FILE)) saveJsonFile(SETTINGS_FILE, DEFAULT_SETTINGS);

app.use(cors());
// Increased limits for image uploads from phones/files
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/payment', paymentRoutes);

// Store APIs
app.get('/api/products', (req, res) => res.json(getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS)));
app.get('/api/settings', (req, res) => res.json(getJsonFile(SETTINGS_FILE, DEFAULT_SETTINGS)));

// Order tracking API
app.get('/api/orders/:ref', async (req, res) => {
  const ref = (req.params.ref || '').trim();
  const orders = getJsonFile(ORDERS_FILE, []);
  let order = orders.find(o => o.reference && o.reference.toLowerCase() === ref.toLowerCase());

  if (order) return res.json({ success: true, order });

  try {
    const paystackSecret = (process.env.PAYSTACK_SECRET_KEY || '').trim();
    const paystackRes = await axios.get(
      `https://api.paystack.co/transaction/verify/${ref}`,
      { headers: { Authorization: `Bearer ${paystackSecret}` } }
    );

    if (paystackRes.data.status && paystackRes.data.data.status === 'success') {
      const tx = paystackRes.data.data;
      const newOrder = {
        reference: tx.reference,
        amount: tx.amount / 100,
        customerEmail: tx.customer.email,
        customerName: tx.metadata?.customerName || tx.customer.email,
        phone: tx.metadata?.phone || (tx.authorization?.mobile_money_number || 'N/A'),
        address: tx.metadata?.address || 'Accra, Ghana',
        items: tx.metadata?.itemsSummary || 'Store Order',
        status: 'Packaging',
        paidAt: tx.paid_at || new Date().toISOString()
      };

      orders.push(newOrder);
      saveJsonFile(ORDERS_FILE, orders);
      return res.json({ success: true, order: newOrder });
    }
  } catch (err) {}

  res.status(404).json({ success: false, message: 'Order not found' });
});

// Admin Auth Middleware
function verifyAdmin(req, res, next) {
  const { password } = req.body;
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
  if (password !== adminPass) {
    return res.status(401).json({ success: false, message: 'Incorrect Admin Password' });
  }
  next();
}

app.post('/api/admin/orders', verifyAdmin, (req, res) => {
  res.json({ success: true, orders: getJsonFile(ORDERS_FILE, []).reverse() });
});

app.post('/api/admin/update-status', verifyAdmin, (req, res) => {
  const { reference, status } = req.body;
  const orders = getJsonFile(ORDERS_FILE, []);
  const order = orders.find(o => o.reference && o.reference.toLowerCase() === (reference || '').toLowerCase());
  if (order) {
    order.status = status;
    order.updatedAt = new Date().toISOString();
    saveJsonFile(ORDERS_FILE, orders);
    return res.json({ success: true, message: 'Status updated' });
  }
  res.status(404).json({ success: false, message: 'Order not found' });
});

// Save Product (Handles direct file photo uploads)
app.post('/api/admin/products/save', verifyAdmin, (req, res) => {
  const { product } = req.body;
  let products = getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);

  if (product.id) {
    const index = products.findIndex(p => p.id === Number(product.id));
    if (index !== -1) {
      products[index] = { ...products[index], ...product, id: Number(product.id), price: Number(product.price) };
    }
  } else {
    const newProduct = {
      ...product,
      id: Date.now(),
      price: Number(product.price)
    };
    products.push(newProduct);
  }

  saveJsonFile(PRODUCTS_FILE, products);
  res.json({ success: true, products });
});

app.post('/api/admin/products/delete', verifyAdmin, (req, res) => {
  const { productId } = req.body;
  let products = getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);
  products = products.filter(p => p.id !== Number(productId));
  saveJsonFile(PRODUCTS_FILE, products);
  res.json({ success: true, products });
});

app.post('/api/admin/settings/save', verifyAdmin, (req, res) => {
  const { settings } = req.body;
  const current = getJsonFile(SETTINGS_FILE, DEFAULT_SETTINGS);
  const updated = { ...current, ...settings };
  saveJsonFile(SETTINGS_FILE, updated);
  res.json({ success: true, settings: updated });
});

// Page routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));
app.get(['/cart', '/cart.html'], (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'cart.html')));
app.get(['/checkout', '/checkout.html'], (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'checkout.html')));
app.get(['/success', '/success.html'], (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'success.html')));
app.get(['/track', '/track.html'], (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'track.html')));
app.get(['/admin', '/admin.html'], (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));

app.listen(PORT, () => {
  console.log("====================================================");
  console.log("  🚀 ShopWave (GH₵) is live on Port: " + PORT);
  console.log("====================================================");
});

module.exports = app;

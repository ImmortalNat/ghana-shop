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

const DEFAULT_PRODUCTS = [
  { id: 1, name: "Wireless Headphones", price: 250, image: "https://picsum.photos/id/1/400/300", description: "Premium noise cancellation headphones.", category: "Electronics" },
  { id: 2, name: "Smart Watch", price: 380, image: "https://picsum.photos/id/2/400/300", description: "Health monitoring smartwatch.", category: "Electronics" },
  { id: 3, name: "Running Sneakers", price: 290, image: "https://picsum.photos/id/3/400/300", description: "Lightweight running shoes.", category: "Fashion" },
  { id: 4, name: "Leather Backpack", price: 180, image: "https://picsum.photos/id/4/400/300", description: "Genuine leather laptop backpack.", category: "Fashion" },
  { id: 5, name: "Bluetooth Speaker", price: 130, image: "https://picsum.photos/id/5/400/300", description: "Waterproof portable speaker.", category: "Electronics" },
  { id: 6, name: "Automatic Coffee Maker", price: 320, image: "https://picsum.photos/id/6/400/300", description: "Drip coffee machine.", category: "Home" }
];

const DEFAULT_SETTINGS = {
  storeName: "Shop with ease",
  announcement: "⚡ Welcome! Fast delivery across Ghana 🇬🇭",
  heroTitle: "Shop Quality Products with Ease",
  heroSubtitle: "Instant payments with MTN MoMo, Telecel Cash, AT Money, and Bank Cards.",
  whatsappNumber: "233536473017",
  supportPhone: "0536473017",
  supportEmail: "support@shopwithease.com",
  shopAddress: "Accra, Ghana",
  aboutTitle: "About Shop with ease",
  aboutText: "Ghana's trusted online shopping destination for quality products with fast delivery.",
  aboutImage: "https://images.unsplash.com/photo-1556742049-0a67e55722c3?w=600",
  instagramUrl: "",
  tiktokUrl: ""
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

app.get('/api/products', (req, res) => res.json(getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS)));
app.get('/api/settings', (req, res) => res.json(getJsonFile(SETTINGS_FILE, DEFAULT_SETTINGS)));

app.get('/api/orders/:ref', async (req, res) => {
  const ref = (req.params.ref || '').trim();
  const orders = getJsonFile(ORDERS_FILE, []);
  let order = orders.find(o => o.reference && o.reference.toLowerCase() === ref.toLowerCase());
  if (order) return res.json({ success: true, order });
  try {
    const ps = (process.env.PAYSTACK_SECRET_KEY || '').trim();
    const pr = await axios.get(`https://api.paystack.co/transaction/verify/${ref}`, { headers: { Authorization: `Bearer ${ps}` } });
    if (pr.data.status && pr.data.data.status === 'success') {
      const tx = pr.data.data;
      const no = { reference: tx.reference, amount: tx.amount / 100, customerEmail: tx.customer.email, customerName: tx.metadata?.customerName || tx.customer.email, phone: tx.metadata?.phone || 'N/A', address: tx.metadata?.address || 'Accra', items: tx.metadata?.itemsSummary || 'Order', status: 'Packaging', paidAt: tx.paid_at };
      orders.push(no); saveJsonFile(ORDERS_FILE, orders);
      return res.json({ success: true, order: no });
    }
  } catch (err) {}
  res.status(404).json({ success: false, message: 'Order not found' });
});

function verifyAdmin(req, res, next) {
  const { password } = req.body;
  if (password !== (process.env.ADMIN_PASSWORD || 'admin123')) return res.status(401).json({ success: false, message: 'Incorrect Password' });
  next();
}

app.post('/api/admin/orders', verifyAdmin, (req, res) => res.json({ success: true, orders: getJsonFile(ORDERS_FILE, []).reverse() }));
app.post('/api/admin/update-status', verifyAdmin, (req, res) => {
  const orders = getJsonFile(ORDERS_FILE, []);
  const o = orders.find(x => x.reference && x.reference.toLowerCase() === (req.body.reference || '').toLowerCase());
  if (o) { o.status = req.body.status; o.updatedAt = new Date().toISOString(); saveJsonFile(ORDERS_FILE, orders); return res.json({ success: true }); }
  res.status(404).json({ success: false });
});
app.post('/api/admin/products/save', verifyAdmin, (req, res) => {
  let products = getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);
  const p = req.body.product;
  if (p.id) { const i = products.findIndex(x => x.id === Number(p.id)); if (i !== -1) products[i] = { ...products[i], ...p, id: Number(p.id), price: Number(p.price) }; }
  else products.push({ ...p, id: Date.now(), price: Number(p.price) });
  saveJsonFile(PRODUCTS_FILE, products); res.json({ success: true });
});
app.post('/api/admin/products/delete', verifyAdmin, (req, res) => {
  let products = getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS).filter(p => p.id !== Number(req.body.productId));
  saveJsonFile(PRODUCTS_FILE, products); res.json({ success: true });
});
app.post('/api/admin/settings/save', verifyAdmin, (req, res) => {
  const current = getJsonFile(SETTINGS_FILE, DEFAULT_SETTINGS);
  const updated = { ...current, ...req.body.settings };
  saveJsonFile(SETTINGS_FILE, updated); res.json({ success: true, settings: updated });
});

// ==================== 🤖 SMART AI STORE MANAGER ====================
app.post('/api/admin/ai/chat', verifyAdmin, async (req, res) => {
  const { message } = req.body;
  const msg = (message || '').trim();
  const lower = msg.toLowerCase();
  const settings = getJsonFile(SETTINGS_FILE, DEFAULT_SETTINGS);
  const products = getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);

  // If OpenAI key exists, use it for advanced queries
  if (process.env.OPENAI_API_KEY) {
    try {
      const aiRes = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `You are an AI store manager for a Ghanaian e-commerce shop called "${settings.storeName}". Current products: ${products.map(p => p.name + ' GH₵' + p.price).join(', ')}. Current settings: storeName=${settings.storeName}, heroTitle=${settings.heroTitle}, aboutText=${settings.aboutText}. Help the owner modify anything. Be concise and friendly.` },
          { role: 'user', content: msg }
        ],
        max_tokens: 400
      }, { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } });
      return res.json({ success: true, reply: aiRes.data.choices[0].message.content.trim(), action: 'info' });
    } catch (err) { console.error('OpenAI error:', err.message); }
  }

  // ===== BUILT-IN SMART AI (No API Key Needed) =====
  let reply = '';
  let action = 'info';

  // 1. CHANGE STORE NAME
  if (lower.includes('change') && (lower.includes('store name') || lower.includes('shop name') || lower.includes('brand name'))) {
    const newName = msg.replace(/change\s+(my\s+)?(store|shop|brand)\s+name\s+to\s+/i, '').replace(/["']/g, '').trim();
    if (newName.length > 1) {
      settings.storeName = newName;
      saveJsonFile(SETTINGS_FILE, settings);
      reply = `✅ Done! Your store name is now "${newName}". Refresh your live store to see the change!`;
      action = 'executed';
    } else {
      reply = '🤔 Please tell me the new name. Example: "Change store name to K-Store"';
    }
  }

  // 2. CHANGE HERO TITLE
  else if (lower.includes('hero') && (lower.includes('title') || lower.includes('heading') || lower.includes('banner'))) {
    const newTitle = msg.replace(/change\s+(the\s+)?(hero|banner)\s+(title|heading|text)\s+to\s+/i, '').replace(/["']/g, '').trim();
    if (newTitle.length > 1) {
      settings.heroTitle = newTitle;
      saveJsonFile(SETTINGS_FILE, settings);
      reply = `✅ Done! Hero title updated to "${newTitle}". Refresh your store to see it!`;
      action = 'executed';
    } else {
      reply = '🤔 Tell me the new hero title. Example: "Change hero title to Best Deals in Accra"';
    }
  }

  // 3. CHANGE HERO SUBTITLE
  else if (lower.includes('hero') && (lower.includes('subtitle') || lower.includes('subtext') || lower.includes('description'))) {
    const 

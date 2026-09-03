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

// ==================== GHANA SMS GATEWAY INTEGRATION ====================

// Format local phone numbers to international GHS format (e.g. 0536473017 -> 233536473017)
function formatGhanaPhone(phone) {
  let clean = (phone || '').replace(/[^0-9]/g, '');
  if (clean.startsWith('0')) {
    clean = '233' + clean.substring(1);
  } else if (clean.length === 9) {
    clean = '233' + clean;
  }
  return clean;
}

// Send automated SMS using Arkesel SMS API
async function sendProgressSMS(to, storeName, ref, status, note) {
  const apiKey = process.env.SMS_API_KEY;
  const senderId = (process.env.SMS_SENDER_ID || 'ShopWave').substring(0, 11);
  const formattedPhone = formatGhanaPhone(to);
  const trackLink = `${process.env.BASE_URL || 'https://shop-wave-shop.onrender.com'}/track?ref=${ref}`;

  let statusHeader = '';
  if (status === 'Out for Delivery') statusHeader = '🚚 OUT FOR DELIVERY!';
  else if (status === 'Delivered') statusHeader = '🟢 DELIVERED!';
  else statusHeader = '📦 ORDER UPDATED!';

  const message = `Hello! ${statusHeader}\n\nStore: ${storeName}\nOrder: ${ref}\nUpdate: ${note}\n\n🔍 Live Tracking:\n${trackLink}\n\nThank you!`;

  if (!apiKey || apiKey.includes('YOUR_')) {
    console.log(`\n📝 [SMS Demo Log (Set SMS_API_KEY to send for real)]`);
    console.log(`To: ${formattedPhone}\nMessage:\n${message}\n`);
    return { success: false, reason: 'Console logged (API Key missing)' };
  }

  try {
    const url = `https://api.arkesel.com/sms/api?action=send-sms&api_key=${apiKey}&to=${formattedPhone}&from=${senderId}&sms=${encodeURIComponent(message)}`;
    const response = await axios.get(url);
    console.log(`✅ SMS successfully dispatched to ${formattedPhone}:`, response.data);
    return { success: true, data: response.data };
  } catch (err) {
    console.error('❌ SMS Gateway Error:', err.message);
    return { success: false, error: err.message };
  }
}

// Store APIs
app.get('/api/products', (req, res) => res.json(getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS)));
app.get('/api/settings', (req, res) => res.json(getJsonFile(SETTINGS_FILE, DEFAULT_SETTINGS)));

// Live Tracking Page Endpoint
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
      const no = {
        reference: tx.reference,
        amount: tx.amount / 100,
        customerEmail: tx.customer.email,
        customerName: tx.metadata?.customerName || tx.customer.email,
        phone: tx.metadata?.phone || (tx.authorization?.mobile_money_number || 'N/A'),
        address: tx.metadata?.address || 'Accra',
        items: tx.metadata?.itemsSummary || 'Store Order',
        status: 'Packaging',
        deliveryNote: 'Your order is being packaged and prepared for delivery.',
        paidAt: tx.paid_at || new Date().toISOString()
      };
      orders.push(no);
      saveJsonFile(ORDERS_FILE, orders);
      return res.json({ success: true, order: no });
    }
  } catch (err) {}
  res.status(404).json({ success: false, message: 'Order not found' });
});

function verifyAdmin(req, res, next) {
  const { password } = req.body;
  if (password !== (process.env.ADMIN_PASSWORD || 'admin123')) {
    return res.status(401).json({ success: false, message: 'Incorrect Admin Password' });
  }
  next();
}

app.post('/api/admin/orders', verifyAdmin, (req, res) => {
  res.json({ success: true, orders: getJsonFile(ORDERS_FILE, []).reverse() });
});

// ==================== UPDATE STATUS AND AUTO-SEND SMS ====================
app.post('/api/admin/update-progress', verifyAdmin, async (req, res) => {
  const { reference, status, deliveryNote } = req.body;
  const orders = getJsonFile(ORDERS_FILE, []);
  const settings = getJsonFile(SETTINGS_FILE, DEFAULT_SETTINGS);
  const order = orders.find(o => o.reference && o.reference.toLowerCase() === (reference || '').toLowerCase());
  
  if (order) {
    order.status = status || order.status;
    order.deliveryNote = deliveryNote || order.deliveryNote || '';
    order.updatedAt = new Date().toISOString();
    saveJsonFile(ORDERS_FILE, orders);

    // Trigger Automatic SMS Alert
    await sendProgressSMS(
      order.phone,
      settings.storeName,
      order.reference,
      order.status,
      order.deliveryNote
    );

    return res.json({ success: true, message: 'Order progress updated and SMS dispatched!' });
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
  const updated = { ...current, ...req.body.settings };
  saveJsonFile(SETTINGS_FILE, updated);
  res.json({ success: true, settings: updated });
});

// AI Store Manager API
app.post('/api/admin/ai/chat', verifyAdmin, async (req, res) => {
  const { message } = req.body;
  const msg = (message || '').trim();
  const lower = msg.toLowerCase();
  const settings = getJsonFile(SETTINGS_FILE, DEFAULT_SETTINGS);
  const products = getJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);

  if (process.env.OPENAI_API_KEY) {
    try {
      const aiRes = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `You are an AI store manager for "${settings.storeName}". Current products: ${products.map(p => p.name + ' GH₵' + p.price).join(', ')}.` },
          { role: 'user', content: msg }
        ],
        max_tokens: 400
      }, { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } });
      return res.json({ success: true, reply: aiRes.data.choices[0].message.content.trim(), action: 'info' });
    } catch (err) {}
  }

  let reply = '';
  let action = 'info';

  if (lower.includes('change') && (lower.includes('store name') || lower.includes('shop name'))) {
    const newName = msg.replace(/change\s+(my\s+)?(store|shop)\s+name\s+to\s+/i, '').replace(/["']/g, '').trim();
    if (newName) { settings.storeName = newName; saveJsonFile(SETTINGS_FILE, settings); reply = `✅ Done! Store name changed to "${newName}".`; action = 'executed'; }
  } else if (lower.includes('hero') && (lower.includes('title') || lower.includes('heading'))) {
    const newTitle = msg.replace(/change\s+(the\s+)?(hero|banner)\s+(title|heading)\s+to\s+/i, '').replace(/["']/g, '').trim();
    if (newTitle) { settings.heroTitle = newTitle; saveJsonFile(SETTINGS_FILE, settings); reply = `✅ Done! Hero title updated to "${newTitle}".`; action = 'executed'; }
  } else if (lower.includes('announcement')) {
    const newAnn = msg.replace(/change\s+(the\s+)?announcement\s+to\s+/i, '').replace(/["']/g, '').trim();
    if (newAnn) { settings.announcement = newAnn; saveJsonFile(SETTINGS_FILE, settings); reply = `✅ Done! Announcement updated.`; action = 'executed'; }
  } else if (lower.includes('add') && lower.includes('product')) {
    const nameMatch = msg.match(/(?:called|named|name)\s+["']?([^"']+?)["']?\s+(?:for|at|price)/i) || msg.match(/add\s+(?:a\s+)?(?:product|item)\s+["']?([^"']+?)["']?\s+(?:for|at|price)/i);
    const priceMatch = msg.match(/(\d+[\d,.]*)/);
    if (nameMatch && priceMatch) {
      const pName = nameMatch[1].trim();
      const pPrice = parseFloat(priceMatch[1].replace(',', ''));
      products.push({ id: Date.now(), name: pName, price: pPrice, image: 'https://picsum.photos/id/' + Math.floor(Math.random() * 100) + '/400/300', description: `High quality ${pName}.`, category: 'Other' });
      saveJsonFile(PRODUCTS_FILE, products);
      reply = `✅ Done! "${pName}" added at GH₵${pPrice.toFixed(2)}.`;
      action = 'executed';
    }
  } else if (lower.includes('list') && lower.includes('product')) {
    reply = `📦 Products (${products.length}):\n\n${products.map((p, i) => `${i + 1}. ${p.name} - GH₵${p.price.toFixed(2)}`).join('\n')}`;
  } else {
    reply = `Hello! 👋 Tell me what you want to change, or use the Orders tab to update customers on delivery progress!`;
  }

  res.json({ success: true, reply, action });
});

// Page routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));
app.get(['/cart', '/cart.html'], (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'cart.html')));
app.get(['/checkout', '/checkout.html'], (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'checkout.html')));
app.get(['/success', '/success.html'], (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'success.html')));
app.get(['/track', '/track.html'], (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'track.html')));
app.get(['/admin', '/admin.html'], (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));

app.listen(PORT, () => console.log("🚀 ShopWave is live on Port: " + PORT));
module.exports = app;

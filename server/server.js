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

// Phone Formatter for Ghana
function formatGhanaPhone(phone) {
  let clean = (phone || '').replace(/[^0-9]/g, '');
  if (clean.startsWith('0')) {
    clean = '233' + clean.substring(1);
  } else if (clean.length === 9) {
    clean = '233' + clean;
  }
  return clean;
}

// SMS Gateway Helper
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
    console.log(`\n📝 [SMS Console Output]\nTo: ${formattedPhone}\nMessage:\n${message}\n`);
    return { success: false, reason: 'Console logged (API Key missing)' };
  }

  try {
    const url = `https://api.arkesel.com/sms/api?action=send-sms&api_key=${apiKey}&to=${formattedPhone}&from=${senderId}&sms=${encodeURIComponent(message)}`;
    const response = await axios.get(url);
    return { success: true, data: response.data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// APIs
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

// ==================== ALL PAGE ROUTES ====================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));
app.get(['/cart', '/cart.html'], (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'cart.html')));
app.get(['/checkout', '/checkout.html'], (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'checkout.html')));
app.get(['/success', '/success.html'], (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'success.html')));
app.get(['/admin', '/admin.html'], (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));

// 📦 GUARANTEED TRACK ROUTE
app.get(['/track', '/track.html'], (req, res) => {
  const trackPath = path.join(__dirname, '..', 'public', 'track.html');
  if (fs.existsSync(trackPath)) {
    return res.sendFile(trackPath);
  }

  // Backup inline template if track.html file is missing
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
    .note-box { background: #eef7f8; border-left: 5px solid #0a7e8c; padding: 1rem; border-radius: 6px; margin: 1rem 0; text-align: left; }
  </style>
</head>
<body>
  <nav class="navbar"><a href="/" class="navbar-brand">🛍️ Shop with <span>ease</span></a><ul class="navbar-links"><li><a href="/">Home</a></li><li><a href="/cart">Cart</a></li></ul></nav>
  <div class="page-container" style="max-width:600px; margin-top:3rem; text-align:center;">
    <div style="background:#fff; padding:2rem; border-radius:10px; box-shadow:0 4px 15px rgba(0,0,0,0.05);">
      <h2>📦 Track Your Order</h2>
      <p style="color:#6c757d; margin:0.5rem 0 1.2rem;">Enter your Order Reference Code:</p>
      <form id="f" style="display:flex; gap:0.5rem; margin-bottom:1.5rem;">
        <input type="text" id="ref" placeholder="e.g. jwj3lm0yky" required style="flex:1; padding:0.8rem; border:1.5px solid #ddd; border-radius:6px; font-size:1rem;">
        <button type="submit" class="btn" style="width:auto; padding:0.8rem 1.5rem; background:#0a7e8c;">Track</button>
      </form>
      <div id="res" style="display:none; text-align:left;">
        <h3 id="stText" style="color:#0a7e8c;"></h3>
        <div class="note-box" id="noteText"></div>
        <div id="detailsText" style="background:#f8f9fa; padding:1rem; border-radius:6px; font-size:0.9rem; line-height:1.6; border:1px solid #ddd;"></div>
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
      document.getElementById('stText').textContent = 'Searching...';
      const res = await fetch('/api/orders/' + r);
      const data = await res.json();
      if (data.success) {
        const o = data.order;
        document.getElementById('stText').textContent = 'Status: ' + o.status;
        document.getElementById('noteText').innerHTML = '<strong>Latest Update:</strong><br>' + (o.deliveryNote || 'Order confirmed and being prepared.');
        document.getElementById('detailsText').innerHTML = '<strong>Code:</strong> ' + o.reference + '<br><strong>Customer:</strong> ' + o.customerName + '<br><strong>Amount:</strong> GH₵' + Number(o.amount).toFixed(2) + '<br><strong>Address:</strong> ' + o.address;
        ['s1','s2','s3','s4'].forEach(id => document.getElementById(id).className = 'circle');
        document.getElementById('s1').className = 'circle done';
        if (o.status === 'Packaging') document.getElementById('s2').className = 'circle active';
        if (o.status === 'Out for Delivery') { document.getElementById('s2').className = 'circle done'; document.getElementById('s3').className = 'circle active'; }
        if (o.status === 'Delivered') { document.getElementById('s2').className = 'circle done'; document.getElementById('s3').className = 'circle done'; document.getElementById('s4').className = 'circle done'; }
        document.getElementById('wa').href = 'https://wa.me/233536473017?text=' + encodeURIComponent('Hi, checking order: ' + o.reference);
      } else {
        document.getElementById('stText').innerHTML = '<span style="color:red;">❌ Order not found. Check reference code.</span>';
        document.getElementById('noteText').style.display = 'none';
        document.getElementById('detailsText').innerHTML = '';
      }
    };
    const urlRef = new URLSearchParams(window.location.search).get('ref');
    if (urlRef) { document.getElementById('ref').value = urlRef; document.getElementById('f').dispatchEvent(new Event('submit')); }
  </script>
</body>
</html>`);
});

app.listen(PORT, () => console.log("🚀 ShopWave is live on Port: " + PORT));

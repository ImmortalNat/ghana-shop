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

// Ensure orders.json exists
function getOrders() {
  try {
    if (fs.existsSync(ORDERS_FILE)) {
      return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8') || '[]');
    }
  } catch (e) {
    return [];
  }
  return [];
}

function saveOrders(orders) {
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
  } catch (e) {
    console.error('Save error:', e.message);
  }
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/payment', paymentRoutes);

// Catalog in GHS
const products = [
  { id: 1, name: "Wireless Headphones", price: 250, image: "https://picsum.photos/id/1/400/300", description: "Premium noise cancellation headphones", category: "Electronics" },
  { id: 2, name: "Smart Watch", price: 380, image: "https://picsum.photos/id/2/400/300", description: "Health monitoring smartwatch", category: "Electronics" },
  { id: 3, name: "Running Sneakers", price: 290, image: "https://picsum.photos/id/3/400/300", description: "Lightweight running shoes", category: "Fashion" },
  { id: 4, name: "Leather Backpack", price: 180, image: "https://picsum.photos/id/4/400/300", description: "Genuine leather laptop backpack", category: "Fashion" },
  { id: 5, name: "Bluetooth Speaker", price: 130, image: "https://picsum.photos/id/5/400/300", description: "Waterproof portable speaker", category: "Electronics" },
  { id: 6, name: "Automatic Coffee Maker", price: 320, image: "https://picsum.photos/id/6/400/300", description: "Drip coffee machine", category: "Home" }
];

app.get('/api/products', (req, res) => res.json(products));

// ==================== LIVE ORDER TRACKING API ====================
app.get('/api/orders/:ref', async (req, res) => {
  const ref = (req.params.ref || '').trim();
  console.log(`🔍 Customer searching for order reference: [${ref}]`);

  const orders = getOrders();
  let order = orders.find(o => o.reference && o.reference.toLowerCase() === ref.toLowerCase());

  if (order) {
    console.log(`✅ Found in local database: ${ref}`);
    return res.json({ success: true, order });
  }

  // Fallback: Check Paystack Live API directly
  try {
    const paystackSecret = (process.env.PAYSTACK_SECRET_KEY || '').trim();
    console.log(`📡 Checking Paystack API directly for: ${ref}...`);

    const paystackRes = await axios.get(
      `https://api.paystack.co/transaction/verify/${ref}`,
      {
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          'Content-Type': 'application/json'
        }
      }
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
        items: tx.metadata?.itemsSummary || 'Standard Store Order',
        status: 'Packaging', // Default live status
        paidAt: tx.paid_at || new Date().toISOString()
      };

      orders.push(newOrder);
      saveOrders(orders);
      console.log(`✅ Paystack verified successfully! Saved to database.`);
      return res.json({ success: true, order: newOrder });
    } else {
      console.log(`❌ Paystack says transaction is not successful: ${ref}`);
    }
  } catch (err) {
    console.error('❌ Paystack API Error:', err.response?.data || err.message);
  }

  res.status(404).json({ success: false, message: 'Order reference not found' });
});

// Admin endpoints
app.post('/api/admin/orders', (req, res) => {
  const { password } = req.body;
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
  if (password !== adminPass) {
    return res.status(401).json({ success: false, message: 'Incorrect Password' });
  }
  res.json({ success: true, orders: getOrders().reverse() });
});

app.post('/api/admin/update-status', (req, res) => {
  const { password, reference, status } = req.body;
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
  if (password !== adminPass) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const orders = getOrders();
  const order = orders.find(o => o.reference && o.reference.toLowerCase() === (reference || '').toLowerCase());
  if (order) {
    order.status = status;
    order.updatedAt = new Date().toISOString();
    saveOrders(orders);
    return res.json({ success: true, message: 'Status updated' });
  }
  res.status(404).json({ success: false, message: 'Order not found' });
});

// ==================== PAGES ====================
app.get('/cart', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'cart.html')));
app.get('/checkout', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'checkout.html')));
app.get('/success', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'success.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));

// Direct inline track page (Guarantees Track ALWAYS loads, even if public/track.html is missing)
app.get(['/track', '/track.html'], (req, res) => {
  const trackPath = path.join(__dirname, '..', 'public', 'track.html');
  if (fs.existsSync(trackPath)) {
    return res.sendFile(trackPath);
  }
  
  // Backup HTML if file isn't found
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Track Your Order</title>
  <link rel="stylesheet" href="/css/styles.css">
  <style>
    .circle { width:32px; height:32px; border-radius:50%; background:#dee2e6; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:bold; }
    .circle.active { background:#ff6b35; }
    .circle.done { background:#28a745; }
  </style>
</head>
<body>
  <nav class="navbar"><a href="/" class="navbar-brand">🛍️ Shop with <span>ease</span></a></nav>
  <div class="page-container" style="max-width:600px; margin-top:3rem; text-align:center;">
    <div style="background:#fff; padding:2rem; border-radius:10px; box-shadow:0 4px 15px rgba(0,0,0,0.05);">
      <h2>📦 Track Your Order</h2>
      <form id="f" style="display:flex; gap:0.5rem; margin:1.5rem 0;">
        <input type="text" id="ref" placeholder="Enter Order Reference (e.g. jwj3lm0yky)" required style="flex:1; padding:0.8rem; border:1.5px solid #ddd; border-radius:6px;">
        <button type="submit" class="btn" style="width:auto; padding:0.8rem 1.5rem; background:#0a7e8c;">Track</button>
      </form>
      <div id="res" style="display:none; text-align:left; background:#f8f9fa; padding:1.2rem; border-radius:8px;"></div>
    </div>
  </div>
  <script>
    document.getElementById('f').onsubmit = async (e) => {
      e.preventDefault();
      const r = document.getElementById('ref').value.trim();
      const box = document.getElementById('res');
      box.style.display = 'block';
      box.innerHTML = 'Searching...';
      const res = await fetch('/api/orders/' + r);
      const data = await res.json();
      if (data.success) {
        const o = data.order;
        box.innerHTML = '<h3>Status: <span style="color:#0a7e8c;">' + o.status + '</span></h3><p><strong>Ref:</strong> ' + o.reference + '<br><strong>Amount:</strong> GH₵' + Number(o.amount).toFixed(2) + '<br><strong>Customer:</strong> ' + o.customerEmail + '</p><a href="https://wa.me/233536473017?text=Hi, checking order ' + o.reference + '" target="_blank" class="btn" style="background:#25D366; display:block; text-align:center; text-decoration:none; margin-top:1rem;">💬 Chat on WhatsApp</a>';
      } else {
        box.innerHTML = '<span style="color:red;">❌ Order not found. Check reference code.</span>';
      }
    };
  </script>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log("====================================================");
  console.log("  🚀 ShopWave (GH₵) is live on Port: " + PORT);
  console.log("====================================================");
});

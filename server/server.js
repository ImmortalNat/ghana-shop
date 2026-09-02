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

// Ensure orders file exists
if (!fs.existsSync(ORDERS_FILE)) {
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify([]));
  } catch (e) {
    console.error('Could not create orders.json:', e.message);
  }
}

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
    console.error('Error saving orders:', e.message);
  }
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/payment', paymentRoutes);

// Product Catalog
const products = [
  { id: 1, name: "Wireless Headphones", price: 250, image: "https://picsum.photos/id/1/400/300", description: "Premium noise cancellation headphones", category: "Electronics" },
  { id: 2, name: "Smart Watch", price: 380, image: "https://picsum.photos/id/2/400/300", description: "Health monitoring smartwatch", category: "Electronics" },
  { id: 3, name: "Running Sneakers", price: 290, image: "https://picsum.photos/id/3/400/300", description: "Lightweight running shoes", category: "Fashion" },
  { id: 4, name: "Leather Backpack", price: 180, image: "https://picsum.photos/id/4/400/300", description: "Genuine leather laptop backpack", category: "Fashion" },
  { id: 5, name: "Bluetooth Speaker", price: 130, image: "https://picsum.photos/id/5/400/300", description: "Waterproof portable speaker", category: "Electronics" },
  { id: 6, name: "Automatic Coffee Maker", price: 320, image: "https://picsum.photos/id/6/400/300", description: "Drip coffee machine", category: "Home" }
];

app.get('/api/products', (req, res) => res.json(products));

// ==================== ORDER MANAGEMENT API ====================

// 1. Customer checks order status (Searches local DB first, then Paystack API directly!)
app.get('/api/orders/:ref', async (req, res) => {
  const ref = req.params.ref.trim();
  const orders = getOrders();
  let order = orders.find(o => o.reference.toLowerCase() === ref.toLowerCase());

  if (order) {
    return res.json({ success: true, order });
  }

  // Fallback: Check Paystack directly for any order
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
        phone: tx.metadata?.phone || 'N/A',
        address: tx.metadata?.address || 'N/A',
        items: tx.metadata?.itemsSummary || 'Order Item(s)',
        status: 'Packaging',
        paidAt: tx.paid_at || new Date().toISOString()
      };

      orders.push(newOrder);
      saveOrders(orders);
      return res.json({ success: true, order: newOrder });
    }
  } catch (err) {
    console.error('Paystack verification fallback error:', err.response?.data?.message || err.message);
  }

  res.status(404).json({ success: false, message: 'Order not found' });
});

// 2. Admin gets all orders (Password: admin123)
app.post('/api/admin/orders', (req, res) => {
  const { password } = req.body;
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
  if (password !== adminPass) {
    return res.status(401).json({ success: false, message: 'Incorrect Password' });
  }
  res.json({ success: true, orders: getOrders().reverse() });
});

// 3. Admin updates delivery status
app.post('/api/admin/update-status', (req, res) => {
  const { password, reference, status } = req.body;
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
  if (password !== adminPass) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const orders = getOrders();
  const order = orders.find(o => o.reference.toLowerCase() === reference.toLowerCase());
  if (order) {
    order.status = status; // 'Packaging' | 'Out for Delivery' | 'Delivered'
    order.updatedAt = new Date().toISOString();
    saveOrders(orders);
    return res.json({ success: true, message: 'Status updated to ' + status });
  }
  res.status(404).json({ success: false, message: 'Order not found' });
});

// ==================== PAGE ROUTES ====================
app.get('/cart', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'cart.html')));
app.get('/checkout', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'checkout.html')));
app.get('/success', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'success.html')));
app.get('/track', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'track.html')));
app.get('/track.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'track.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));

app.listen(PORT, () => {
  console.log("====================================================");
  console.log("  🚀 ShopWave (GH₵) is live on Port: " + PORT);
  console.log("====================================================");
});

module.exports = app;

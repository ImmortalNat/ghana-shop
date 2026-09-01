require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const paymentRoutes = require('./routes/payment');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/payment', paymentRoutes);

// High-reliability product images
const products = [
  { id: 1, name: "Wireless Headphones", price: 250, image: "https://picsum.photos/id/1/400/300", description: "Premium noise cancellation headphones", category: "Electronics" },
  { id: 2, name: "Smart Watch", price: 380, image: "https://picsum.photos/id/2/400/300", description: "Health monitoring smartwatch with heart-rate sensor", category: "Electronics" },
  { id: 3, name: "Running Sneakers", price: 290, image: "https://picsum.photos/id/3/400/300", description: "Lightweight and breathable running shoes", category: "Fashion" },
  { id: 4, name: "Leather Backpack", price: 180, image: "https://picsum.photos/id/4/400/300", description: "Genuine leather backpack with 15-inch laptop sleeve", category: "Fashion" },
  { id: 5, name: "Bluetooth Speaker", price: 130, image: "https://picsum.photos/id/5/400/300", description: "Waterproof portable speaker with rich bass", category: "Electronics" },
  { id: 6, name: "Automatic Coffee Maker", price: 320, image: "https://picsum.photos/id/6/400/300", description: "Drip coffee machine with thermal warming plate", category: "Home" }
];

app.get('/api/products', (req, res) => res.json(products));
app.get('/cart', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'cart.html')));
app.get('/checkout', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'checkout.html')));
app.get('/success', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'success.html')));

app.listen(PORT, () => {
  console.log("====================================================");
  console.log("  🚀 ShopWave is running at: http://localhost:" + PORT);
  console.log("====================================================");
});
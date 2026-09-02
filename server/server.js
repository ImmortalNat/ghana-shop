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
    const newSub = msg.replace(/change\s+(the\s+)?(hero\s+)?(subtitle|subtext|description)\s+to\s+/i, '').replace(/["']/g, '').trim();
    if (newSub.length > 1) {
      settings.heroSubtitle = newSub;
      saveJsonFile(SETTINGS_FILE, settings);
      reply = `✅ Done! Hero subtitle updated. Refresh your store!`;
      action = 'executed';
    } else {
      reply = '🤔 Tell me the new subtitle text.';
    }
  }

  // 4. CHANGE ANNOUNCEMENT
  else if (lower.includes('announcement') || lower.includes('top bar') || lower.includes('promo bar')) {
    const newAnn = msg.replace(/change\s+(the\s+)?(announcement|top\s+bar|promo\s+bar)\s+to\s+/i, '').replace(/["']/g, '').trim();
    if (newAnn.length > 1) {
      settings.announcement = newAnn;
      saveJsonFile(SETTINGS_FILE, settings);
      reply = `✅ Done! Announcement bar updated to "${newAnn}".`;
      action = 'executed';
    } else {
      reply = '🤔 Tell me the new announcement text.';
    }
  }

  // 5. CHANGE ABOUT US
  else if (lower.includes('about') && (lower.includes('update') || lower.includes('change') || lower.includes('write') || lower.includes('set'))) {
    const newAbout = msg.replace(/(update|change|write|set)\s+(my\s+)?(about\s+us|about\s+section|about\s+text)\s+to\s+/i, '').replace(/["']/g, '').trim();
    if (newAbout.length > 5) {
      settings.aboutText = newAbout;
      saveJsonFile(SETTINGS_FILE, settings);
      reply = `✅ Done! About Us section updated. Refresh your store to see the new story!`;
      action = 'executed';
    } else {
      reply = '🤔 Please provide the full About Us text. Example: "Update about us to say we are the best phone shop in Accra"';
    }
  }

  // 6. CHANGE WHATSAPP NUMBER
  else if (lower.includes('whatsapp') && (lower.includes('number') || lower.includes('change') || lower.includes('update'))) {
    const newNum = msg.replace(/[^0-9+]/g, '').trim();
    if (newNum.length >= 9) {
      settings.whatsappNumber = newNum.replace('+', '');
      saveJsonFile(SETTINGS_FILE, settings);
      reply = `✅ Done! WhatsApp number updated to ${settings.whatsappNumber}.`;
      action = 'executed';
    } else {
      reply = '🤔 Please provide the full number. Example: "Change WhatsApp number to 233551234567"';
    }
  }

  // 7. CHANGE PHONE / EMAIL / ADDRESS
  else if (lower.includes('phone') && lower.includes('change')) {
    const num = msg.replace(/[^0-9+ ]/g, '').trim();
    if (num.length >= 9) { settings.supportPhone = num; saveJsonFile(SETTINGS_FILE, settings); reply = `✅ Phone updated to ${num}.`; action = 'executed'; }
    else reply = '🤔 Please provide the new phone number.';
  }
  else if (lower.includes('email') && lower.includes('change')) {
    const email = msg.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (email) { settings.supportEmail = email[0]; saveJsonFile(SETTINGS_FILE, settings); reply = `✅ Email updated to ${email[0]}.`; action = 'executed'; }
    else reply = '🤔 Please provide the new email address.';
  }
  else if (lower.includes('address') && lower.includes('change')) {
    const addr = msg.replace(/change\s+(my\s+)?(shop\s+)?address\s+to\s+/i, '').replace(/["']/g, '').trim();
    if (addr.length > 2) { settings.shopAddress = addr; saveJsonFile(SETTINGS_FILE, settings); reply = `✅ Address updated to "${addr}".`; action = 'executed'; }
    else reply = '🤔 Please provide the new address.';
  }

  // 8. ADD PRODUCT
  else if (lower.includes('add') && (lower.includes('product') || lower.includes('item'))) {
    const nameMatch = msg.match(/(?:called|named|name)\s+["']?([^"']+?)["']?\s+(?:for|at|price)/i) || msg.match(/add\s+(?:a\s+)?(?:product|item)\s+["']?([^"']+?)["']?\s+(?:for|at|price)/i);
    const priceMatch = msg.match(/(\d+[\d,.]*)/);
    if (nameMatch && priceMatch) {
      const pName = nameMatch[1].trim();
      const pPrice = parseFloat(priceMatch[1].replace(',', ''));
      const newProduct = { id: Date.now(), name: pName, price: pPrice, image: 'https://picsum.photos/id/' + Math.floor(Math.random() * 100) + '/400/300', description: `High quality ${pName}. Order now for fast delivery across Ghana!`, category: 'Other' };
      products.push(newProduct);
      saveJsonFile(PRODUCTS_FILE, products);
      reply = `✅ Done! "${pName}" added to your store at GH₵${pPrice.toFixed(2)}. Go to the Products tab to upload a real photo and edit the description!`;
      action = 'executed';
    } else {
      reply = '🤔 Please include the name and price. Example: "Add product iPhone 15 for 8500"';
    }
  }

  // 9. DELETE PRODUCT
  else if (lower.includes('delete') || lower.includes('remove')) {
    const pName = msg.replace(/(delete|remove)\s+(the\s+)?(product\s+)?/i, '').replace(/["']/g, '').trim();
    const found = products.find(p => p.name.toLowerCase().includes(pName.toLowerCase()));
    if (found) {
      const updated = products.filter(p => p.id !== found.id);
      saveJsonFile(PRODUCTS_FILE, updated);
      reply = `✅ Done! "${found.name}" has been removed from your store.`;
      action = 'executed';
    } else {
      reply = `🤔 I couldn't find a product matching "${pName}". Current products: ${products.map(p => p.name).join(', ')}`;
    }
  }

  // 10. CHANGE PRODUCT PRICE
  else if (lower.includes('price') && (lower.includes('change') || lower.includes('update') || lower.includes('set'))) {
    const priceMatch = msg.match(/(\d+[\d,.]*)/);
    const pName = msg.replace(/change\s+(the\s+)?price\s+of\s+/i, '').replace(/to\s+\d+.*/i, '').replace(/["']/g, '').trim();
    const found = products.find(p => p.name.toLowerCase().includes(pName.toLowerCase()));
    if (found && priceMatch) {
      found.price = parseFloat(priceMatch[1].replace(',', ''));
      saveJsonFile(PRODUCTS_FILE, products);
      reply = `✅ Done! "${found.name}" price updated to GH₵${found.price.toFixed(2)}.`;
      action = 'executed';
    } else {
      reply = '🤔 Example: "Change price of Smart Watch to 450"';
    }
  }

  // 11. GENERATE SOCIAL POST
  else if (lower.includes('social') || lower.includes('instagram') || lower.includes('tiktok') || lower.includes('post') || lower.includes('caption')) {
    reply = `📱 Ready-to-Post Social Media Caption:\n\n🛍️ ${settings.storeName} - Your #1 Online Shop in Ghana! 🇬🇭\n\n🔥 Hot Deals Available Now!\n✅ 100% Genuine Products\n📱 Pay Instantly with MTN MoMo / Telecel / AT\n🚚 Fast Doorstep Delivery\n\n👉 Shop now: ${settings.shopAddress}\n💬 WhatsApp: ${settings.whatsappNumber}\n\n#GhanaShopping #AccraDeals #GhanaFashion #MoMoPay #ShopWithEase #GhanaBusiness`;
  }

  // 12. GENERATE WHATSAPP MESSAGE
  else if (lower.includes('whatsapp') && (lower.includes('message') || lower.includes('draft') || lower.includes('customer'))) {
    reply = `💬 WhatsApp Customer Message Template:\n\nHello [Customer Name]! 👋\n\nThank you for shopping with ${settings.storeName}! 🛍️\n\nYour order [Reference Code] has been confirmed and is being prepared for dispatch. 📦\n\n🚚 Estimated Delivery: Within 24 hours\n📍 Delivery Address: [Customer Address]\n\nIf you have any questions, reply to this message anytime!\n\nThank you for choosing us! 🇬🇭❤️`;
  }

  // 13. LIST PRODUCTS
  else if (lower.includes('list') && lower.includes('product')) {
    reply = `📦 Current Products (${products.length}):\n\n${products.map((p, i) => `${i + 1}. ${p.name} - GH₵${p.price.toFixed(2)} (${p.category})`).join('\n')}`;
  }

  // 14. SHOW CURRENT SETTINGS
  else if (lower.includes('show') && (lower.includes('setting') || lower.includes('config') || lower.includes('current'))) {
    reply = `⚙️ Current Store Settings:\n\n🏷️ Store Name: ${settings.storeName}\n📢 Announcement: ${settings.announcement}\n🎯 Hero Title: ${settings.heroTitle}\n📱 WhatsApp: ${settings.whatsappNumber}\n📞 Phone: ${settings.supportPhone}\n📧 Email: ${settings.supportEmail}\n📍 Address: ${settings.shopAddress}\n📦 Total Products: ${products.length}`;
  }

  // 15. HELP / WHAT CAN YOU DO
  else if (lower.includes('help') || lower.includes('what can you') || lower.includes('commands')) {
    reply = `🤖 I can help you modify ANYTHING on your store! Try these commands:\n\n🏷️ "Change store name to [name]"\n🎯 "Change hero title to [text]"\n📢 "Change announcement to [text]"\n📖 "Update about us to [your story]"\n📱 "Change WhatsApp number to [number]"\n➕ "Add product [name] for [price]"\n🗑️ "Delete product [name]"\n💰 "Change price of [product] to [price]"\n📱 "Generate social media post"\n💬 "Draft WhatsApp customer message"\n📦 "List all products"\n⚙️ "Show current settings"\n\nJust type naturally and I will understand! 😊`;
  }

  // 16. GREETING
  else if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
    reply = `Hello! 👋 I'm your AI Store Manager for ${settings.storeName}. I can help you modify anything on your website. Type "help" to see what I can do, or just tell me what you want to change! 😊`;
  }

  // 17. DEFAULT FALLBACK
  else {
    reply = `🤔 I understand you want to: "${msg}"\n\nI can directly execute these types of changes:\n• Change store name, hero title, announcement\n• Update About Us, contact details\n• Add/delete products, change prices\n• Generate marketing content\n\nTry being specific! Example: "Change store name to K-Store" or type "help" for all commands. 😊`;
  }

  res.json({ success: true, reply, action });
});

// Page routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));
app.get(['/cart', '/cart.html'], (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'cart.html')));
app.get(['/checkout', '/checkout.html'], (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'checkout.html')));
app.get(['/success', '/success.html'], (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'success.html')));
app.get(['/admin', '/admin.html'], (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));
app.listen(PORT, () => console.log("🚀 ShopWave is live on Port: " + PORT));
module.exports = app;

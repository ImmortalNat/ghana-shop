let products = [];

function getCart() { return JSON.parse(localStorage.getItem('shopwave_cart') || '[]'); }
function saveCart(c) { localStorage.setItem('shopwave_cart', JSON.stringify(c)); updateBadge(); }
function updateBadge() {
  const count = getCart().reduce((sum, item) => sum + item.qty, 0);
  const el = document.getElementById('cartCount');
  if (el) el.textContent = count;
}

function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.style.display = 'block';
  setTimeout(() => t.style.display = 'none', 2000);
}

function render(list) {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;
  grid.innerHTML = list.map(p => `
    <div class="product-card">
      <img src="${p.image}" alt="${p.name}" loading="lazy">
      <div class="product-info">
        <span class="product-category">${p.category || 'General'}</span>
        <h3 class="product-name">${p.name}</h3>
        <p style="color:#666; font-size:0.85rem; margin-bottom:0.5rem;">${p.description || ''}</p>
        <div class="product-price">GH₵${Number(p.price).toFixed(2)}</div>
        <button class="btn" onclick="addToCart(${p.id})">Add to Cart 🛒</button>
      </div>
    </div>
  `).join('');
}

function addToCart(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const cart = getCart();
  const existing = cart.find(x => x.id === id);
  if (existing) existing.qty += 1;
  else cart.push({ ...p, qty: 1 });
  saveCart(cart);
  toast('Added ' + p.name + ' to cart!');
}

function filterCat(cat, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  render(cat === 'all' ? products : products.filter(p => p.category === cat));
}

// Load Store Settings & Products dynamically
async function loadStore() {
  try {
    const [prodRes, setRes] = await Promise.all([fetch('/api/products'), fetch('/api/settings')]);
    products = await prodRes.json();
    const settings = await setRes.json();

    // Update Brand Name & Headings
    if (settings.storeName) {
      document.querySelectorAll('.navbar-brand').forEach(el => {
        el.innerHTML = `🛍️ ${settings.storeName}`;
      });
    }
    const heroH1 = document.querySelector('.hero h1');
    if (heroH1 && settings.heroTitle) heroH1.textContent = settings.heroTitle;
    const heroP = document.querySelector('.hero p');
    if (heroP && settings.heroSubtitle) heroP.textContent = settings.heroSubtitle;

    render(products);
  } catch (err) {
    console.error('Error loading store data:', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateBadge();
  loadStore();
});

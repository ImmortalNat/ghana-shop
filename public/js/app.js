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

  grid.innerHTML = list.map(p => {
    const isBook = p.category === 'Online Books' || p.previewUrl;

    return `
      <div class="product-card">
        <div style="position: relative;">
          <img src="${p.image}" alt="${p.name}" loading="lazy">
          ${isBook ? '<span style="position:absolute; top:10px; right:10px; background:#ff6b35; color:#fff; font-size:0.75rem; font-weight:bold; padding:0.25rem 0.6rem; border-radius:4px;">👁️ Sample Available</span>' : ''}
        </div>
        <div class="product-info">
          <span class="product-category">${p.category || 'General'}</span>
          <h3 class="product-name">${p.name}</h3>
          ${p.author ? `<span style="color:#6c757d; font-size:0.85rem; display:block; margin-bottom:0.3rem;">By ${p.author}</span>` : ''}
          <p style="color:#666; font-size:0.85rem; margin-bottom:0.8rem; flex:1;">${p.description || ''}</p>
          <div class="product-price">GH₵${Number(p.price).toFixed(2)}</div>

          ${isBook ? `
            <div style="display:flex; gap:0.5rem; margin-top:auto;">
              <a href="/preview/${p.id}" class="btn" style="flex:1; text-align:center; background:#0a7e8c; text-decoration:none; padding:0.6rem;">👁️ Preview</a>
              <button class="btn" style="flex:1.2; background:#ff6b35; padding:0.6rem;" onclick="addToCart(${p.id})">🔓 Buy Full</button>
            </div>
          ` : `
            <button class="btn" onclick="addToCart(${p.id})">Add to Cart 🛒</button>
          `}
        </div>
      </div>
    `;
  }).join('');
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
  if (btn) btn.classList.add('active');
  render(cat === 'all' ? products : products.filter(p => p.category === cat));
}

async function loadStore() {
  try {
    const [prodRes, setRes] = await Promise.all([fetch('/api/products'), fetch('/api/settings')]);
    products = await prodRes.json();
    const s = await setRes.json();

    if (s.announcement && document.getElementById('announcementBar')) {
      document.getElementById('announcementBar').textContent = s.announcement;
    }
    if (s.storeName) {
      document.querySelectorAll('.navbar-brand').forEach(el => el.innerHTML = `🛍️ ${s.storeName}`);
      if (document.getElementById('footerBrand')) document.getElementById('footerBrand').textContent = s.storeName;
    }
    if (s.heroTitle && document.getElementById('heroTitle')) document.getElementById('heroTitle').textContent = s.heroTitle;
    if (s.heroSubtitle && document.getElementById('heroSubtitle')) document.getElementById('heroSubtitle').textContent = s.heroSubtitle;

    render(products);
  } catch (err) {
    console.error('Error loading store:', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateBadge();
  loadStore();
});

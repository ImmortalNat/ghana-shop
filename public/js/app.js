let products = [];
function getCart() { return JSON.parse(localStorage.getItem('shopwave_cart') || '[]'); }
function saveCart(c) { localStorage.setItem('shopwave_cart', JSON.stringify(c)); updateBadge(); }
function updateBadge() {
  document.getElementById('cartCount').textContent = getCart().reduce((s, i) => s + i.qty, 0);
}
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.display = 'block';
  setTimeout(() => t.style.display = 'none', 2000);
}
function render(list) {
  document.getElementById('productsGrid').innerHTML = list.map(p => `
    <div class="product-card">
      <img src="${p.image}" alt="${p.name}">
      <div class="product-info">
        <span class="product-category">${p.category}</span>
        <h3 class="product-name">${p.name}</h3>
        <p style="color:#666; font-size:0.85rem; margin-bottom:0.5rem;">${p.description}</p>
        <div class="product-price">GH₵${p.price.toFixed(2)}</div>
        <button class="btn" onclick="addToCart(${p.id})">Add to Cart 🛒</button>
      </div>
    </div>
  `).join('');
}
function addToCart(id) {
  const p = products.find(x => x.id === id);
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
fetch('/api/products').then(r => r.json()).then(data => { products = data; render(data); });
updateBadge();

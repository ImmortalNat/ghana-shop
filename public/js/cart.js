function getCart() { return JSON.parse(localStorage.getItem('shopwave_cart') || '[]'); }
function saveCart(c) { localStorage.setItem('shopwave_cart', JSON.stringify(c)); render(); }
function updateQty(id, delta) {
  let cart = getCart();
  const item = cart.find(x => x.id === id);
  if (item) {
    item.qty += delta;
    if (item.qty <= 0) cart = cart.filter(x => x.id !== id);
  }
  saveCart(cart);
}
function render() {
  const cart = getCart();
  const itemsEl = document.getElementById('cartItems');
  const summaryEl = document.getElementById('cartSummary');
  if (cart.length === 0) {
    itemsEl.innerHTML = '<p>Your cart is empty. <a href="/">Start shopping</a></p>';
    summaryEl.innerHTML = '';
    return;
  }
  const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);
  itemsEl.innerHTML = cart.map(item => `
    <div class="cart-item">
      <img src="${item.image}">
      <div style="flex:1;">
        <h4>${item.name}</h4>
        <div style="color:var(--primary); font-weight:bold;">GH₵${item.price.toFixed(2)}</div>
      </div>
      <div>
        <button style="padding:2px 8px;" onclick="updateQty(${item.id}, -1)">-</button>
        <span style="margin: 0 8px; font-weight:bold;">${item.qty}</span>
        <button style="padding:2px 8px;" onclick="updateQty(${item.id}, 1)">+</button>
      </div>
    </div>
  `).join('');
  summaryEl.innerHTML = `
    <h3>Summary</h3>
    <div class="summary-row total"><span>Total:</span><span>GH₵${total.toFixed(2)}</span></div>
    <a href="/checkout" class="btn" style="display:block; text-align:center; margin-top:1rem;">Proceed to Checkout →</a>
  `;
}
render();

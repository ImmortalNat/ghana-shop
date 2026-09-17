let cart = [];
let cartSubtotal = 0;
let deliveryFee = 0;
let grandTotal = 0;
let deliveryLocations = [];

let selectedMethod = 'online';
let hasPhysicalItem = false;
let hasDigitalItem = false;

function initCart() {
  try {
    cart = JSON.parse(localStorage.getItem('shopwave_cart') || '[]');
  } catch (e) {
    cart = [];
  }

  if (!cart || !cart.length) {
    window.location.href = '/cart';
    return;
  }

  cartSubtotal = cart.reduce((s, i) => s + (Number(i.price || 0) * Number(i.qty || 1)), 0);
  grandTotal = cartSubtotal;

  cart.forEach(item => {
    const cat = (item.category || '').toLowerCase();
    const nm = (item.name || '').toLowerCase();
    const isBook = cat.includes('book') || nm.includes('pdf') || nm.includes('ebook');
    if (isBook) hasDigitalItem = true;
    else hasPhysicalItem = true;
  });

  renderSummary();
  loadSettingsAndDelivery();
}

function renderSummary() {
  const summaryEl = document.getElementById('orderSummary');
  if (!summaryEl) return;

  summaryEl.innerHTML = `
    <h3>Your Order</h3>
    ${cart.map(i => `<div class="summary-row"><span>${i.name} (x${i.qty || 1})</span><span>GH₵${(Number(i.price) * Number(i.qty || 1)).toFixed(2)}</span></div>`).join('')}
    
    <div style="border-top: 1px solid #dee2e6; margin-top: 1rem; padding-top: 1rem;">
      <div class="summary-row sub"><span>Subtotal:</span><span>GH₵${cartSubtotal.toFixed(2)}</span></div>
      ${hasPhysicalItem ? `<div class="summary-row sub" style="color:#0a7e8c; font-weight:bold;"><span>Delivery Fee:</span><span>GH₵${deliveryFee.toFixed(2)}</span></div>` : ''}
      <div class="summary-row total"><span>Total to Pay:</span><span>GH₵${grandTotal.toFixed(2)}</span></div>
    </div>
  `;
}

function updateButtonText() {
  const payBtn = document.getElementById('payBtn');
  if (!payBtn) return;

  if (selectedMethod === 'online') {
    payBtn.textContent = (hasDigitalItem && !hasPhysicalItem) ? '🔓 Pay & Auto-Download PDF 📥' : `💳 Pay GH₵${grandTotal.toFixed(2)} with Paystack`;
    payBtn.style.background = 'var(--primary)';
  } else {
    payBtn.textContent = `Submit Direct MoMo Order (GH₵${grandTotal.toFixed(2)}) ✓`;
    payBtn.style.background = '#f59e0b';
  }
}

window.togglePaymentMethod = function(method) {
  selectedMethod = method;
  const btnOnline = document.getElementById('btnOnline');
  const btnDirect = document.getElementById('btnDirect');
  const directMomoBox = document.getElementById('directMomoBox');
  const txInput = document.getElementById('momoTxId');

  if (btnOnline) btnOnline.classList.toggle('active', method === 'online');
  if (btnDirect) btnDirect.classList.toggle('active', method === 'direct');
  if (directMomoBox) directMomoBox.style.display = method === 'online' ? 'none' : 'block';
  if (txInput) txInput.required = (method === 'direct');

  updateButtonText();
};

function populateRegions() {
  const regionSelect = document.getElementById('regionSelect');
  if (!regionSelect || !deliveryLocations.length) return;

  const regions = [...new Set(deliveryLocations.map(l => l.region || 'Greater Accra'))];
  regionSelect.innerHTML = `<option value="">-- Choose Ghana Region --</option>` +
    regions.map(r => `<option value="${r}">${r} Region</option>`).join('');
}

async function loadSettingsAndDelivery() {
  try {
    const [setRes, delRes] = await Promise.all([
      fetch('/api/settings?t=' + Date.now()),
      fetch('/api/delivery?t=' + Date.now())
    ]);
    
    if (setRes.ok) {
      const s = await setRes.json();
      const numEl = document.getElementById('displayMomoNum');
      const nameEl = document.getElementById('displayMomoName');
      if (numEl) numEl.textContent = s.momoNumber || '0536473017';
      if (nameEl) nameEl.textContent = s.momoName || 'Mary Appiah';
    }

    if (delRes.ok) {
      deliveryLocations = await delRes.json();
    }

    const delBox = document.getElementById('deliveryZoneGroup');
    const addressInput = document.getElementById('address');
    const regionSelect = document.getElementById('regionSelect');
    const townSelect = document.getElementById('townSelect');

    if (hasPhysicalItem && delBox) {
      delBox.style.display = 'block';
      if (addressInput) addressInput.required = true;
      if (regionSelect) regionSelect.required = true;
      if (townSelect) townSelect.required = true;
      populateRegions();
    } else if (delBox) {
      delBox.style.display = 'none';
      if (addressInput) addressInput.required = false;
      if (regionSelect) regionSelect.required = false;
      if (townSelect) townSelect.required = false;
      deliveryFee = 0;
      grandTotal = cartSubtotal;
    }

    renderSummary();
    updateButtonText();
  } catch (err) {
    console.error('Error loading checkout settings:', err);
  }
}

document.addEventListener('change', (e) => {
  if (e.target && e.target.id === 'regionSelect') {
    const selectedRegion = e.target.value;
    const townSelect = document.getElementById('townSelect');
    if (!townSelect) return;

    if (!selectedRegion) {
      townSelect.innerHTML = `<option value="">-- Select Region First --</option>`;
      townSelect.disabled = true;
      deliveryFee = 0;
    } else {
      const towns = deliveryLocations.filter(l => (l.region || 'Greater Accra') === selectedRegion);
      townSelect.innerHTML = `<option value="">-- Choose Town / Area --</option>` +
        towns.map(t => `<option value="${t.id}">${t.town} (+ GH₵${Number(t.fee).toFixed(2)})</option>`).join('');
      townSelect.disabled = false;
      deliveryFee = 0;
    }

    grandTotal = cartSubtotal + deliveryFee;
    renderSummary();
    updateButtonText();
  }

  if (e.target && e.target.id === 'townSelect') {
    const selectedId = Number(e.target.value);
    const selectedTown = deliveryLocations.find(l => l.id === selectedId);

    if (selectedTown) {
      deliveryFee = Number(selectedTown.fee);
    } else {
      deliveryFee = 0;
    }

    grandTotal = cartSubtotal + deliveryFee;
    renderSummary();
    updateButtonText();
  }
});

window.processCheckout = async function(e) {
  if (e && e.preventDefault) e.preventDefault();

  const btn = document.getElementById('payBtn');
  const name = (document.getElementById('name')?.value || '').trim();
  const email = (document.getElementById('email')?.value || '').trim();
  const phone = (document.getElementById('phone')?.value || '').trim();

  let fullAddress = 'Digital Delivery';
  if (hasPhysicalItem) {
    const reg = document.getElementById('regionSelect')?.value || '';
    const townId = Number(document.getElementById('townSelect')?.value || 0);
    const townObj = deliveryLocations.find(l => l.id === townId);
    const street = (document.getElementById('address')?.value || '').trim();
    const townName = townObj ? townObj.town : 'General Area';
    fullAddress = `${street}, ${townName}, ${reg} Region`;
  }

  let itemsList = cart.map(i => `${i.name} (x${i.qty || 1})`).join(' | ');
  if (deliveryFee > 0) itemsList += ` | Delivery Fee: GH₵${deliveryFee.toFixed(2)}`;

  if (btn) {
    btn.disabled = true;
  }

  if (selectedMethod === 'online') {
    if (btn) btn.textContent = 'Connecting to Paystack...';
    try {
      const res = await fetch('/api/payment/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          amount: grandTotal,
          metadata: { customerName: name, phone: phone, address: fullAddress, itemsSummary: itemsList, cartItems: cart }
        })
      });
      const d = await res.json();
      if (d.status && d.data && d.data.authorization_url) {
        window.location.href = d.data.authorization_url;
      } else {
        alert(d.message || 'Paystack payment initialization failed.');
        if (btn) btn.disabled = false;
        updateButtonText();
      }
    } catch (err) {
      alert('Network connection error. Please try again.');
      if (btn) btn.disabled = false;
      updateButtonText();
    }
  } else {
    const txId = (document.getElementById('momoTxId')?.value || '').trim();
    if (!txId) {
      alert('Please enter your MoMo Transaction ID.');
      if (btn) btn.disabled = false;
      updateButtonText();
      return;
    }

    if (btn) btn.textContent = 'Submitting direct MoMo payment...';
    try {
      const res = await fetch('/api/payment/direct-momo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          email: email,
          phone: phone,
          address: fullAddress,
          transactionId: txId,
          amount: grandTotal,
          cartItems: cart,
          itemsSummary: itemsList
        })
      });
      const d = await res.json();
      if (d.success) {
        window.location.href = '/success?reference=' + encodeURIComponent(txId);
      } else {
        alert(d.message || 'Direct MoMo submission failed.');
        if (btn) btn.disabled = false;
        updateButtonText();
      }
    } catch (err) {
      alert('Error submitting payment.');
      if (btn) btn.disabled = false;
      updateButtonText();
    }
  }
};

document.addEventListener('DOMContentLoaded', initCart);

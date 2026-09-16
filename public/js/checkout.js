const cart = JSON.parse(localStorage.getItem('shopwave_cart') || '[]');
if (!cart.length) window.location.href = '/cart';

const cartSubtotal = cart.reduce((s, i) => s + (i.price * i.qty), 0);
let deliveryFee = 0;
let grandTotal = cartSubtotal;
let deliveryLocations = [];

let selectedMethod = 'online';
let hasPhysicalItem = false;
let hasDigitalItem = false;

// Analyze Cart Content
cart.forEach(item => {
  const isBook = item.category === 'Online Books' || (item.name && (item.name.toLowerCase().includes('pdf') || item.name.toLowerCase().includes('ebook')));
  if (isBook) hasDigitalItem = true;
  else hasPhysicalItem = true;
});

// Render Order Summary
function renderSummary() {
  const summaryHtml = `
    <h3>Your Order</h3>
    ${cart.map(i => `<div class="summary-row"><span>${i.name} x${i.qty}</span><span>GH₵${(i.price * i.qty).toFixed(2)}</span></div>`).join('')}
    
    <div style="border-top: 1px solid #dee2e6; margin-top: 1rem; padding-top: 1rem;">
      <div class="summary-row sub"><span>Subtotal:</span><span>GH₵${cartSubtotal.toFixed(2)}</span></div>
      ${hasPhysicalItem ? `<div class="summary-row sub" style="color:#0a7e8c; font-weight:bold;"><span>Delivery Fee:</span><span>GH₵${deliveryFee.toFixed(2)}</span></div>` : ''}
      <div class="summary-row total"><span>Total to Pay:</span><span>GH₵${grandTotal.toFixed(2)}</span></div>
    </div>
  `;
  document.getElementById('orderSummary').innerHTML = summaryHtml;
}

function updateButtonText() {
  const payBtn = document.getElementById('payBtn');
  if (selectedMethod === 'online') {
    payBtn.textContent = (hasDigitalItem && !hasPhysicalItem) ? '🔓 Pay & Auto-Download PDF 📥' : `💳 Pay GH₵${grandTotal.toFixed(2)} Securely`;
    payBtn.style.background = 'var(--primary)';
  } else {
    payBtn.textContent = `Submit Direct MoMo Order (GH₵${grandTotal.toFixed(2)}) ✓`;
    payBtn.style.background = '#f59e0b';
  }
}

window.togglePaymentMethod = function(method) {
  selectedMethod = method;
  document.getElementById('btnOnline').classList.toggle('active', method === 'online');
  document.getElementById('btnDirect').classList.toggle('active', method === 'direct');
  document.getElementById('directMomoBox').style.display = method === 'online' ? 'none' : 'block';
  document.getElementById('momoTxId').required = method === 'direct';
  updateButtonText();
};

// Cascading Region ➔ Town Dropdown Logic
function populateRegions() {
  const regionSelect = document.getElementById('regionSelect');
  if (!regionSelect) return;

  // Extract unique regions
  const regions = [...new Set(deliveryLocations.map(l => l.region || "Greater Accra"))];
  regionSelect.innerHTML = `<option value="">-- Choose Ghana Region --</option>` +
    regions.map(r => `<option value="${r}">${r} Region</option>`).join('');
}

document.getElementById('regionSelect').addEventListener('change', (e) => {
  const selectedRegion = e.target.value;
  const townSelect = document.getElementById('townSelect');

  if (!selectedRegion) {
    townSelect.innerHTML = `<option value="">-- Select Region First --</option>`;
    townSelect.disabled = true;
    deliveryFee = 0;
  } else {
    const towns = deliveryLocations.filter(l => (l.region || "Greater Accra") === selectedRegion);
    townSelect.innerHTML = `<option value="">-- Choose Town / Area --</option>` +
      towns.map(t => `<option value="${t.id}">${t.town} (+ GH₵${Number(t.fee).toFixed(2)})</option>`).join('');
    townSelect.disabled = false;
    deliveryFee = 0;
  }

  grandTotal = cartSubtotal + deliveryFee;
  renderSummary();
  updateButtonText();
});

document.getElementById('townSelect').addEventListener('change', (e) => {
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
});

async function loadSettingsAndDelivery() {
  try {
    const [setRes, delRes] = await Promise.all([
      fetch('/api/settings?t=' + Date.now()),
      fetch('/api/delivery?t=' + Date.now())
    ]);
    const s = await setRes.json();
    deliveryLocations = await delRes.json();

    document.getElementById('displayMomoNum').textContent = s.momoNumber || '0536473017';
    document.getElementById('displayMomoName').textContent = s.momoName || 'Mary Appiah';

    const delBox = document.getElementById('deliveryZoneGroup');
    const addressInput = document.getElementById('address');
    const regionSelect = document.getElementById('regionSelect');
    const townSelect = document.getElementById('townSelect');

    if (hasPhysicalItem) {
      delBox.style.display = 'block';
      addressInput.required = true;
      regionSelect.required = true;
      townSelect.required = true;
      populateRegions();
    } else {
      delBox.style.display = 'none';
      addressInput.required = false;
      regionSelect.required = false;
      townSelect.required = false;
      deliveryFee = 0;
      grandTotal = cartSubtotal;
    }

    renderSummary();
    updateButtonText();
  } catch (err) {
    console.error('Error loading checkout setup', err);
    grandTotal = cartSubtotal;
    renderSummary();
    updateButtonText();
  }
}

document.getElementById('checkoutForm').onsubmit = async (e) => {
  e.preventDefault();
  const btn = document.getElementById('payBtn');
  
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  
  let fullAddress = 'Digital Delivery';
  if (hasPhysicalItem) {
    const reg = document.getElementById('regionSelect').value;
    const townId = Number(document.getElementById('townSelect').value);
    const townObj = deliveryLocations.find(l => l.id === townId);
    const street = document.getElementById('address').value.trim();
    
    const townName = townObj ? townObj.town : 'General';
    fullAddress = `${street}, ${townName}, ${reg} Region`;
  }

  let itemsList = cart.map(i => `${i.name} (x${i.qty})`).join(' | ');
  if (deliveryFee > 0) itemsList += ` | Delivery Fee: GH₵${deliveryFee.toFixed(2)}`;

  btn.disabled = true;

  if (selectedMethod === 'online') {
    btn.textContent = 'Connecting to Paystack...';
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
      if (d.status && d.data.authorization_url) window.location.href = d.data.authorization_url;
      else { alert('Paystack failed.'); btn.disabled = false; updateButtonText(); }
    } catch (err) { alert('Connection error.'); btn.disabled = false; updateButtonText(); }
  } else {
    const txId = document.getElementById('momoTxId').value.trim();
    if (!txId) return alert('Please enter your MoMo Transaction ID.');
    
    btn.textContent = 'Submitting your payment...';
    try {
      const res = await fetch('/api/payment/direct-momo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, address: fullAddress, transactionId: txId, amount: grandTotal, cartItems: cart, itemsSummary: itemsList })
      });
      const d = await res.json();
      if (d.success) window.location.href = '/success?reference=' + encodeURIComponent(txId);
      else { alert('Direct MoMo submission failed.'); btn.disabled = false; updateButtonText(); }
    } catch(err) { alert('Error submitting payment.'); btn.disabled = false; updateButtonText(); }
  }
};

document.addEventListener('DOMContentLoaded', loadSettingsAndDelivery);

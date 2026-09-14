const cart = JSON.parse(localStorage.getItem('shopwave_cart') || '[]');
if (!cart.length) window.location.href = '/cart';
const tot = cart.reduce((s, i) => s + (i.price * i.qty), 0);

document.getElementById('orderSummary').innerHTML = `
  <h3>Your Order</h3>
  ${cart.map(i => `<div class="summary-row"><span>${i.name}</span><span>GH₵${Number(i.price).toFixed(2)}</span></div>`).join('')}
  <div class="summary-row total"><span>Total</span><span>GH₵${tot.toFixed(2)}</span></div>
`;

let selectedMethod = 'online';
let hasDigitalItem = false;

cart.forEach(item => {
  if (item.category === 'Online Books' || (item.name && (item.name.toLowerCase().includes('pdf') || item.name.toLowerCase().includes('ebook')))) {
    hasDigitalItem = true;
  }
});

function updateButtonText() {
  const payBtn = document.getElementById('payBtn');
  if (selectedMethod === 'online') {
    payBtn.textContent = hasDigitalItem ? '🔓 Pay & Auto-Download PDF 📥' : '🔓 Pay & Complete Order 💳';
    payBtn.style.background = 'var(--primary)';
  } else {
    payBtn.textContent = 'Submit Direct MoMo Payment ✓';
    payBtn.style.background = '#f59e0b';
  }
}

window.togglePaymentMethod = function(method) {
  selectedMethod = method;
  const btnOnline = document.getElementById('btnOnline');
  const btnDirect = document.getElementById('btnDirect');
  const directMomoBox = document.getElementById('directMomoBox');
  const txInput = document.getElementById('momoTxId');

  if (method === 'online') {
    btnOnline.classList.add('active');
    btnDirect.classList.remove('active');
    directMomoBox.style.display = 'none';
    txInput.required = false;
  } else {
    btnOnline.classList.remove('active');
    btnDirect.classList.add('active');
    directMomoBox.style.display = 'block';
    txInput.required = true;
  }
  updateButtonText();
};

async function loadSettings() {
  try {
    const res = await fetch('/api/settings?t=' + Date.now());
    const s = await res.json();
    document.getElementById('displayMomoNum').textContent = s.momoNumber || '0536473017';
    document.getElementById('displayMomoName').textContent = s.momoName || 'Mary Appiah';
    updateButtonText();
  } catch (err) {
    updateButtonText();
  }
}

document.getElementById('checkoutForm').onsubmit = async (e) => {
  e.preventDefault();
  const btn = document.getElementById('payBtn');
  
  const name = document.getElementById('name').value;
  const email = document.getElementById('email').value;
  const phone = document.getElementById('phone').value;
  const address = document.getElementById('address').value;
  const itemsList = cart.map(i => `${i.name}`).join(', ');

  btn.disabled = true;

  if (selectedMethod === 'online') {
    btn.textContent = 'Connecting to Paystack...';
    try {
      const res = await fetch('/api/payment/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          amount: tot,
          metadata: { customerName: name, phone: phone, address: address, itemsSummary: itemsList, cartItems: cart }
        })
      });
      const d = await res.json();
      if (d.status && d.data.authorization_url) window.location.href = d.data.authorization_url;
      else { alert('Paystack failed.'); btn.disabled = false; updateButtonText(); }
    } catch (err) { alert('Connection error.'); btn.disabled = false; updateButtonText(); }
  } else {
    const txId = document.getElementById('momoTxId').value.trim();
    if (!txId) return alert('Please enter your MoMo Transaction ID.');
    
    btn.textContent = 'Submitting payment...';
    try {
      const res = await fetch('/api/payment/direct-momo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, address, transactionId: txId, amount: tot, cartItems: cart, itemsSummary: itemsList })
      });
      const d = await res.json();
      if (d.success) {
        window.location.href = '/success?reference=' + encodeURIComponent(txId);
      } else {
        alert('Direct MoMo submission failed.');
        btn.disabled = false; updateButtonText();
      }
    } catch(err) {
      alert('Error submitting payment.');
      btn.disabled = false; updateButtonText();
    }
  }
};

document.addEventListener('DOMContentLoaded', loadSettings);

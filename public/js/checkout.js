const cart = JSON.parse(localStorage.getItem('shopwave_cart') || '[]');
if (cart.length === 0) window.location.href = '/cart';
const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);

document.getElementById('orderSummary').innerHTML = `
  <h3>Order Summary</h3>
  ${cart.map(i => `<div class="summary-row"><span>${i.name} x${i.qty}</span><span>GH₵${(i.price * i.qty).toFixed(2)}</span></div>`).join('')}
  <div class="summary-row total"><span>Total:</span><span>GH₵${total.toFixed(2)}</span></div>
`;

document.getElementById('checkoutForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('payBtn');
  btn.disabled = true;
  btn.textContent = 'Connecting to Paystack...';

  try {
    const res = await fetch('/api/payment/initialize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: document.getElementById('email').value,
        amount: total,
        metadata: {
          customerName: document.getElementById('name').value,
          phone: document.getElementById('phone').value,
          address: document.getElementById('address').value
        }
      })
    });
    const data = await res.json();
    if (data.status && data.data.authorization_url) {
      window.location.href = data.data.authorization_url;
    } else {
      alert(data.message || 'Payment failed to initialize.');
      btn.disabled = false;
      btn.textContent = 'Pay with Paystack (MoMo / Card) 💳';
    }
  } catch (err) {
    alert('Network connection error.');
    btn.disabled = false;
  }
});

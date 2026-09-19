// Comprehensive 16-Region Ghana Delivery Database
const DEFAULT_GHANA_DELIVERY = [
  // 1. Greater Accra Region
  { id: 1, region: "Greater Accra", town: "East Legon / Shiashie / Bawaleshie", fee: 25 },
  { id: 2, region: "Greater Accra", town: "Madina / Adenta / Abokobi", fee: 30 },
  { id: 3, region: "Greater Accra", town: "Circle / Osu / Ridge / Cantonments", fee: 20 },
  { id: 4, region: "Greater Accra", town: "Spintex / Teshie / Nungua", fee: 30 },
  { id: 5, region: "Greater Accra", town: "Dansoman / Kaneshie / Lapaz / Achimota", fee: 25 },
  { id: 6, region: "Greater Accra", town: "Tema / Ashaiman / Dawhenya / Prampram", fee: 40 },
  { id: 7, region: "Greater Accra", town: "Kasoa / Weija / Mallam / Bortianor", fee: 35 },
  { id: 8, region: "Greater Accra", town: "Legon Campus / UPSA / Haatso", fee: 20 },

  // 2. Ashanti Region
  { id: 9, region: "Ashanti", town: "Kumasi Central (Adum / Asafo / Kejetia)", fee: 45 },
  { id: 10, region: "Ashanti", town: "KNUST / Ayigya / Ayeduase / Kentinkrono", fee: 50 },
  { id: 11, region: "Ashanti", town: "Bantama / Suame / Suntreso / Abrepo", fee: 45 },
  { id: 12, region: "Ashanti", town: "Tafo / Pankrono / Alabar / Mamponteng", fee: 50 },
  { id: 13, region: "Ashanti", town: "Asokwa / Ahodwo / Nhyiaeso", fee: 45 },
  { id: 14, region: "Ashanti", town: "Ejisu / Mampong / Offinso", fee: 55 },
  { id: 15, region: "Ashanti", town: "Obuasi / Bekwai", fee: 60 },

  // 3. Western Region
  { id: 16, region: "Western", town: "Sekondi-Takoradi Central (Market Circle)", fee: 55 },
  { id: 17, region: "Western", town: "Effia / Kwesimintsim / Fijai", fee: 55 },
  { id: 18, region: "Western", town: "Tarkwa / UMaT Campus", fee: 60 },
  { id: 19, region: "Western", town: "Axim / Elubo", fee: 65 },

  // 4. Central Region
  { id: 20, region: "Central", town: "Cape Coast / UCC Campus / Pedu", fee: 50 },
  { id: 21, region: "Central", town: "Elmina / Komenda", fee: 55 },
  { id: 22, region: "Central", town: "Winneba / UEW Campus", fee: 45 },
  { id: 23, region: "Central", town: "Mankessim / Agona Swedru", fee: 50 },

  // 5. Eastern Region
  { id: 24, region: "Eastern", town: "Koforidua Central / Effiduase", fee: 45 },
  { id: 25, region: "Eastern", town: "Nsawam / Aburi / Larteh", fee: 40 },
  { id: 26, region: "Eastern", town: "Suhum / Nkawkaw", fee: 50 },
  { id: 27, region: "Eastern", town: "Akosombo / Somanya / Oda", fee: 55 },

  // 6. Volta Region
  { id: 28, region: "Volta", town: "Ho Central / UHAS Campus", fee: 50 },
  { id: 29, region: "Volta", town: "Hohoe / Kpando", fee: 55 },
  { id: 30, region: "Volta", town: "Aflao / Sogakope / Anloga", fee: 60 },

  // 7. Northern Region
  { id: 31, region: "Northern", town: "Tamale Central / UDS Campus", fee: 65 },
  { id: 32, region: "Northern", town: "Savelugu / Yendi", fee: 70 },

  // 8. Upper East Region
  { id: 33, region: "Upper East", town: "Bolgatanga Central", fee: 70 },
  { id: 34, region: "Upper East", town: "Navrongo / Bawku", fee: 75 },

  // 9. Upper West Region
  { id: 35, region: "Upper West", town: "Wa Central / UDS Wa", fee: 70 },
  { id: 36, region: "Upper West", town: "Jirapa / Lawra", fee: 75 },

  // 10. Bono Region
  { id: 37, region: "Bono", town: "Sunyani Central / Fiapre", fee: 60 },
  { id: 38, region: "Bono", town: "Berekum / Dormaa Ahenkro", fee: 65 },

  // 11. Bono East Region
  { id: 39, region: "Bono East", town: "Techiman Central", fee: 60 },
  { id: 40, region: "Bono East", town: "Kintampo / Atebubu", fee: 65 },

  // 12. Ahafo Region
  { id: 41, region: "Ahafo", town: "Goaso / Mim / Kenyasi", fee: 65 },

  // 13. Oti Region
  { id: 42, region: "Oti", town: "Dambai / Jasikan / Nkwanta", fee: 65 },

  // 14. Savannah Region
  { id: 43, region: "Savannah", town: "Damongo / Salaga / Buipe", fee: 70 },

  // 15. North East Region
  { id: 44, region: "North East", town: "Nalerigu / Walewale", fee: 70 },

  // 16. Western North Region
  { id: 45, region: "Western North", town: "Sefwi Wiawso / Bibiani / Enchi", fee: 65 }
];

let cart = [];
let cartSubtotal = 0;
let deliveryFee = 0;
let grandTotal = 0;
let deliveryLocations = DEFAULT_GHANA_DELIVERY;

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
    if (isBook) {
      hasDigitalItem = true;
    } else {
      hasPhysicalItem = true;
    }
  });

  if (!hasPhysicalItem && !hasDigitalItem) {
    hasPhysicalItem = true;
  }

  renderSummary();
  setupDeliveryUI();
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
    payBtn.textContent = (!hasPhysicalItem && hasDigitalItem) ? '🔓 Pay & Auto-Download PDF 📥' : `💳 Pay GH₵${grandTotal.toFixed(2)} with Paystack`;
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
  if (!regionSelect) return;

  const regions = [...new Set(deliveryLocations.map(l => l.region || 'Greater Accra'))];
  regionSelect.innerHTML = `<option value="">-- Choose Ghana Region --</option>` +
    regions.map(r => `<option value="${r}">${r} Region</option>`).join('');
}

function setupDeliveryUI() {
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
      const fetchedLocations = await delRes.json();
      if (Array.isArray(fetchedLocations) && fetchedLocations.length > 0) {
        deliveryLocations = fetchedLocations;
        populateRegions();
      }
    }
  } catch (err) {
    console.error('Error loading delivery settings:', err);
  } finally {
    renderSummary();
    updateButtonText();
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

  if (btn) btn.disabled = true;

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

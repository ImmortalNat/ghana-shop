const express = require('express');
const router = express.Router();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const PAYSTACK_SECRET_KEY = (process.env.PAYSTACK_SECRET_KEY || '').trim();
const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const ORDERS_FILE = path.join(__dirname, '..', 'orders.json');

router.post('/initialize', async (req, res) => {
  try {
    const { email, amount, metadata, callback_url } = req.body;
    if (!email || !amount) {
      return res.status(400).json({ status: false, message: 'Email and amount are required' });
    }

    const amountInPesewas = Math.round(amount * 100);

    const customFields = [
      { display_name: "Items Purchased", variable_name: "items_purchased", value: metadata?.itemsSummary || "N/A" },
      { display_name: "Customer Name", variable_name: "customer_name", value: metadata?.customerName || "N/A" },
      { display_name: "Phone Number", variable_name: "phone_number", value: metadata?.phone || "N/A" },
      { display_name: "Delivery Address", variable_name: "delivery_address", value: metadata?.address || "N/A" }
    ];

    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/transaction/initialize`,
      {
        email,
        amount: amountInPesewas,
        currency: 'GHS',
        channels: ['card', 'mobile_money'],
        callback_url: callback_url || `${process.env.BASE_URL}/success`,
        metadata: {
          ...metadata,
          custom_fields: customFields
        }
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Paystack error:', error.response?.data || error.message);
    res.status(500).json({ status: false, message: error.response?.data?.message || 'Payment initialization failed' });
  }
});

router.get('/verify/:reference', async (req, res) => {
  try {
    const response = await axios.get(
      `${PAYSTACK_BASE_URL}/transaction/verify/${req.params.reference}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
    );

    if (response.data.status && response.data.data.status === 'success') {
      const tx = response.data.data;
      
      // Auto-save to Orders Database
      try {
        let orders = [];
        if (fs.existsSync(ORDERS_FILE)) {
          orders = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8') || '[]');
        }
        
        if (!orders.find(o => o.reference === tx.reference)) {
          orders.push({
            reference: tx.reference,
            amount: tx.amount / 100,
            customerEmail: tx.customer.email,
            customerName: tx.metadata?.customerName || 'N/A',
            phone: tx.metadata?.phone || 'N/A',
            address: tx.metadata?.address || 'N/A',
            items: tx.metadata?.itemsSummary || 'N/A',
            status: 'Packaging', // Default initial status
            channel: tx.channel,
            paidAt: tx.paid_at || new Date().toISOString()
          });
          fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
        }
      } catch (err) {
        console.error('Error saving order locally:', err);
      }
    }

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ status: false, message: 'Verification failed' });
  }
});

module.exports = router;

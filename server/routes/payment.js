const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');

const PAYSTACK_SECRET_KEY = (process.env.PAYSTACK_SECRET_KEY || '').trim();
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

router.post('/initialize', async (req, res) => {
  try {
    const { email, amount, metadata, callback_url } = req.body;
    if (!email || !amount) {
      return res.status(400).json({ status: false, message: 'Email and amount are required' });
    }

    const amountInPesewas = Math.round(amount * 100);

    // Format custom fields so Paystack displays them clearly on your dashboard
    const customFields = [
      {
        display_name: "Items Purchased",
        variable_name: "items_purchased",
        value: metadata?.itemsSummary || "N/A"
      },
      {
        display_name: "Customer Name",
        variable_name: "customer_name",
        value: metadata?.customerName || "N/A"
      },
      {
        display_name: "Phone Number",
        variable_name: "phone_number",
        value: metadata?.phone || "N/A"
      },
      {
        display_name: "Delivery Address",
        variable_name: "delivery_address",
        value: metadata?.address || "N/A"
      }
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
    res.status(500).json({
      status: false,
      message: error.response?.data?.message || 'Payment initialization failed'
    });
  }
});

router.get('/verify/:reference', async (req, res) => {
  try {
    const response = await axios.get(
      `${PAYSTACK_BASE_URL}/transaction/verify/${req.params.reference}`,
      {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` }
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ status: false, message: 'Verification failed' });
  }
});

module.exports = router;

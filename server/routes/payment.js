const express = require('express');
const router = express.Router();
const axios = require('axios');

const PAYSTACK_SECRET_KEY = (process.env.PAYSTACK_SECRET_KEY || '').trim();
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

router.post('/initialize', async (req, res) => {
  try {
    const { email, amount, metadata, callback_url } = req.body;

    if (!email || !amount) {
      return res.status(400).json({ status: false, message: 'Email and amount are required' });
    }

    if (!PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY.includes('YOUR_SECRET_KEY_HERE')) {
      console.error('❌ ERROR: You have not set your PAYSTACK_SECRET_KEY in .env');
      return res.status(500).json({
        status: false,
        message: 'Paystack Secret Key is missing in .env'
      });
    }

    // Convert Cedis to Pesewas (GHS * 100)
    const amountInPesewas = Math.round(amount * 100);

    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/transaction/initialize`,
      {
        email,
        amount: amountInPesewas,
        currency: 'GHS',
        channels: ['card', 'mobile_money'],
        callback_url: callback_url || `${process.env.BASE_URL}/success`,
        metadata: metadata || {}
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
    console.error('❌ Paystack Error:', error.response?.data || error.message);
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
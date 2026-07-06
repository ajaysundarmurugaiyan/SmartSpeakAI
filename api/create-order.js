// Vercel Serverless Function: create a Razorpay order.
// Runs on the server — the Razorpay SECRET never reaches the browser.
// Requires env vars: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
import Razorpay from 'razorpay';

const PREMIUM_PRICE_INR = 149; // keep in sync with src/config/plan.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return res.status(500).json({ error: 'Razorpay keys not configured on the server' });
  }

  try {
    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const order = await razorpay.orders.create({
      amount: PREMIUM_PRICE_INR * 100, // amount in paise
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
      notes: { payee_upi: 'ajaysundarmurugaiyan@oksbi' },
    });
    // Return the public key id so the browser can open checkout.
    return res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
    });
  } catch (e) {
    console.error('create-order error:', e);
    return res.status(500).json({ error: 'Failed to create order' });
  }
}

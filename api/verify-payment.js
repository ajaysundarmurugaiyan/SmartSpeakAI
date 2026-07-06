// Vercel Serverless Function: verify a Razorpay payment, then grant Premium.
// This is the ONLY place Premium is granted — it uses the Firebase Admin SDK
// (which bypasses Firestore rules), so the browser can never self-upgrade.
// Requires env vars: RAZORPAY_KEY_SECRET, FIREBASE_SERVICE_ACCOUNT (the full
// service-account JSON as a string).
import crypto from 'crypto';
import admin from 'firebase-admin';

const DAY_MS = 24 * 60 * 60 * 1000;

function getAdmin() {
  if (!admin.apps.length) {
    const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
    admin.initializeApp({ credential: admin.credential.cert(svc) });
  }
  return admin;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'Razorpay secret not configured on the server' });
  }

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, idToken } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !idToken) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 1) Verify the Razorpay signature (proves the payment is genuine)
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    if (expected !== razorpay_signature) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    // 2) Verify WHO is paying (their Firebase ID token) — can't be spoofed
    const app = getAdmin();
    const decoded = await app.auth().verifyIdToken(idToken);
    const uid = decoded.uid;

    // 3) Grant Premium (server-side only)
    await app.firestore().collection('users').doc(uid).set(
      {
        plan: 'premium',
        premiumSince: Date.now(),
        premiumUntil: Date.now() + 30 * DAY_MS,
        lastPayment: {
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
          at: Date.now(),
        },
      },
      { merge: true }
    );

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('verify-payment error:', e);
    return res.status(500).json({ error: 'Verification failed' });
  }
}

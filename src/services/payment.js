// Client-side Razorpay checkout flow.
// 1) ask our server to create an order  -> /api/create-order
// 2) open Razorpay checkout in the browser
// 3) send the result + the user's Firebase ID token to /api/verify-payment
//    (the server verifies the signature and grants Premium)
import { auth } from '../firebase/config';

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export async function startPremiumCheckout({ user, onSuccess, onError } = {}) {
  try {
    const loaded = await loadRazorpayScript();
    if (!loaded) throw new Error('Could not load Razorpay. Check your connection.');

    // 1) create the order on our server
    const orderRes = await fetch('/api/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!orderRes.ok) {
      const err = await orderRes.json().catch(() => ({}));
      throw new Error(err.error || 'Could not start payment.');
    }
    const { orderId, amount, currency, keyId } = await orderRes.json();

    const idToken = await auth.currentUser.getIdToken();

    // 2) open Razorpay checkout
    const rzp = new window.Razorpay({
      key: keyId,
      amount,
      currency,
      order_id: orderId,
      name: 'SpeakSmart AI',
      description: 'Premium subscription',
      prefill: { email: user?.email || '', name: user?.displayName || '' },
      theme: { color: '#111827' },
      handler: async (response) => {
        try {
          // 3) verify on the server, which grants Premium
          const verifyRes = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...response, idToken }),
          });
          const data = await verifyRes.json().catch(() => ({}));
          if (verifyRes.ok && data.success) onSuccess?.();
          else throw new Error(data.error || 'Payment verification failed.');
        } catch (e) {
          onError?.(e);
        }
      },
      modal: { ondismiss: () => onError?.(new Error('Payment cancelled')) },
    });
    rzp.open();
  } catch (e) {
    onError?.(e);
  }
}

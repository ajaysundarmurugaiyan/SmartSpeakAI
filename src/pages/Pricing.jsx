import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Crown, Sparkles, CreditCard, Smartphone, X, PartyPopper } from 'lucide-react';
import confetti from 'canvas-confetti';
import Navbar from '../components/Navbar';
import { useAuth } from '../contexts/AuthContext';
import { FREE_FEATURES, PREMIUM_FEATURES, PREMIUM_PRICE_INR } from '../config/plan';

const Pricing = () => {
  const { isPremium, isTrialActive, daysLeftInTrial } = useAuth();
  const [showPay, setShowPay] = useState(false);
  const [paid, setPaid] = useState(false);

  const openPay = () => {
    setPaid(false);
    setShowPay(true);
  };

  // Confetti: bursts from the bottom-left and bottom-right corners, arc up to the
  // top, then fall back down. (UI only — this does NOT change your plan.)
  const celebrate = () => {
    const end = Date.now() + 900;
    (function frame() {
      confetti({ particleCount: 6, angle: 60, spread: 60, startVelocity: 60, origin: { x: 0, y: 1 } });
      confetti({ particleCount: 6, angle: 120, spread: 60, startVelocity: 60, origin: { x: 1, y: 1 } });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  };

  const pay = () => {
    setPaid(true);
    celebrate();
  };

  const subtitle = isPremium
    ? 'You are a Premium member 💛'
    : isTrialActive
      ? `You're on a free trial — ${daysLeftInTrial} day${daysLeftInTrial !== 1 ? 's' : ''} left`
      : 'Upgrade anytime for unlimited practice';

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-10"
          >
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">
              Choose your plan
            </h1>
            <p className="text-gray-500 text-sm">{subtitle}</p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Free */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-gray-200 p-8"
            >
              <h3 className="text-xl font-semibold text-gray-900">Free</h3>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                ₹0<span className="text-base font-normal text-gray-500">/forever</span>
              </p>
              <ul className="mt-6 space-y-3">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                    <Check className="w-5 h-5 text-gray-400 flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Premium */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl border-2 border-amber-400 p-8 relative shadow-lg"
            >
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Most popular
              </span>
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-500" />
                <h3 className="text-xl font-semibold text-gray-900">Premium</h3>
              </div>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                ₹{PREMIUM_PRICE_INR}<span className="text-base font-normal text-gray-500">/month</span>
              </p>
              <ul className="mt-6 space-y-3">
                {PREMIUM_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                    <Check className="w-5 h-5 text-amber-500 flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={openPay}
                disabled={isPremium}
                className="w-full mt-8 bg-gray-900 text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isPremium ? 'You are Premium ✨' : (<><Crown className="w-5 h-5" /> Upgrade to Premium</>)}
              </button>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Payment card / celebration popup */}
      <AnimatePresence>
        {showPay && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowPay(false)}
          >
            <motion.div
              initial={{ y: 120, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 120, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 relative"
            >
              <button onClick={() => setShowPay(false)} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>

              {!paid ? (
                <>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">Payment</h3>
                  <p className="text-sm text-gray-500 mb-5">Premium — ₹{PREMIUM_PRICE_INR}/month</p>

                  <div className="space-y-2 mb-6">
                    <div className="flex items-center gap-3 border-2 border-gray-900 rounded-xl px-4 py-3">
                      <Smartphone className="w-5 h-5 text-gray-700" />
                      <span className="text-sm font-medium text-gray-800">UPI</span>
                      <span className="ml-auto w-4 h-4 rounded-full border-4 border-gray-900" />
                    </div>
                    <div className="flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3">
                      <CreditCard className="w-5 h-5 text-gray-400" />
                      <span className="text-sm font-medium text-gray-500">Card</span>
                    </div>
                  </div>

                  <button
                    onClick={pay}
                    className="w-full bg-gray-900 text-white py-3 rounded-xl font-semibold hover:bg-gray-800 transition-colors"
                  >
                    Pay ₹{PREMIUM_PRICE_INR}
                  </button>
                  <p className="text-center text-[11px] text-gray-400 mt-3">Demo only — no real charge.</p>
                </>
              ) : (
                <div className="text-center py-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mx-auto mb-4">
                    <PartyPopper className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-1">🎉 Congratulations!</h3>
                  <p className="text-gray-500 mb-6">Your payment was successful — welcome to Premium!</p>
                  <button
                    onClick={() => setShowPay(false)}
                    className="w-full bg-gray-900 text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition-colors"
                  >
                    Done
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Pricing;

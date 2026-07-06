import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Crown, Sparkles } from 'lucide-react';
import Navbar from '../components/Navbar';
import { useAuth } from '../contexts/AuthContext';
import { FREE_FEATURES, PREMIUM_FEATURES, PREMIUM_PRICE_INR } from '../config/plan';

const Pricing = () => {
  const { isPremium, isTrialActive, daysLeftInTrial } = useAuth();
  const [notice, setNotice] = useState('');

  // Payment integration is added in a later step. For now this just informs.
  const handleUpgrade = () => {
    setNotice('💳 Payments are coming soon! Enjoy your free trial in the meantime.');
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

          {notice && (
            <div className="mb-6 text-center bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm">
              {notice}
            </div>
          )}

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
                onClick={handleUpgrade}
                disabled={isPremium}
                className="w-full mt-8 bg-gray-900 text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isPremium ? 'You are Premium ✨' : (<><Crown className="w-5 h-5" /> Upgrade to Premium</>)}
              </button>
              {!isPremium && (
                <p className="text-center text-xs text-gray-400 mt-3">
                  Secure payment coming soon
                </p>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pricing;

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, X, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FREE_DAILY_LIMIT } from '../config/plan';

// Shown when a free user hits their daily limit (or taps an upgrade prompt).
const UpgradeModal = ({ open, onClose, title, message }) => {
  const navigate = useNavigate();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-4 shadow-lg">
              <Crown className="w-7 h-7 text-white" />
            </div>

            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              {title || 'Upgrade to Premium'}
            </h3>
            <p className="text-gray-600 mb-6">
              {message || `You've used your ${FREE_DAILY_LIMIT} free conversations for today. Upgrade for unlimited practice!`}
            </p>

            <button
              onClick={() => { onClose?.(); navigate('/pricing'); }}
              className="w-full bg-gray-900 text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-5 h-5" /> See Premium Plans
            </button>
            <button
              onClick={onClose}
              className="w-full mt-3 text-gray-500 text-sm hover:text-gray-700 transition-colors"
            >
              Maybe later
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UpgradeModal;

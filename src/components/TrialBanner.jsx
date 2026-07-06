import React from 'react';
import { Link } from 'react-router-dom';
import { Crown, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// Slim status bar shown at the top of the main pages.
// - Trial active  -> "X days left in your free Premium trial"
// - Free (ended)  -> "You're on Free · N conversations left today"
// - Premium       -> hidden (no nag needed)
const TrialBanner = () => {
  const { isPremium, isTrialActive, daysLeftInTrial, remainingToday } = useAuth();

  if (isPremium) return null;

  if (isTrialActive) {
    return (
      <div className="mb-6 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-amber-800 text-sm">
          <Clock className="w-4 h-4 flex-shrink-0" />
          <span>
            <b>{daysLeftInTrial} day{daysLeftInTrial !== 1 ? 's' : ''} left</b> in your free Premium trial
          </span>
        </div>
        <Link
          to="/pricing"
          className="text-xs font-semibold text-amber-900 bg-amber-200/70 px-3 py-1.5 rounded-lg hover:bg-amber-200 transition-colors whitespace-nowrap"
        >
          Upgrade
        </Link>
      </div>
    );
  }

  const left = typeof remainingToday === 'function' ? remainingToday() : null;
  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-gray-700 text-sm">
        <Crown className="w-4 h-4 text-amber-500 flex-shrink-0" />
        <span>
          You're on the <b>Free</b> plan
          {typeof left === 'number' ? ` · ${left} conversation${left !== 1 ? 's' : ''} left today` : ''}
        </span>
      </div>
      <Link
        to="/pricing"
        className="text-xs font-semibold text-white bg-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors whitespace-nowrap"
      >
        Go Premium
      </Link>
    </div>
  );
};

export default TrialBanner;

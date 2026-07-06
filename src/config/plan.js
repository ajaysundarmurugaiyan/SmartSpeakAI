// Central plan / entitlement config for Free vs Premium + the free trial.
// Tweak these numbers in ONE place and the whole app follows.

export const TRIAL_DAYS = 7;              // every new user gets 7 days of full Premium
export const FREE_DAILY_LIMIT = 5;        // AI conversations/day once the trial ends
export const PREMIUM_PRICE_INR = 149;     // monthly price shown on the pricing page

// Your payout destination. NOTE: Razorpay settles money to the BANK ACCOUNT you
// register during KYC — not to a UPI id in code. Register the bank account behind
// this UPI in Razorpay to receive funds. Recorded on each order for reference.
export const PAYEE_UPI = 'ajaysundarmurugaiyan@oksbi';

export const FREE_FEATURES = [
  `${FREE_DAILY_LIMIT} AI conversations per day`,
  'Daily activities & quizzes',
  'Streaks & progress tracking',
];

export const PREMIUM_FEATURES = [
  'Unlimited AI voice & text conversations',
  'All daily activities & quizzes',
  'Detailed progress analytics',
  'Priority access to new features',
  'Support an indie developer 💛',
];

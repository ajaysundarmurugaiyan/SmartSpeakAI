import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase/config';
import { TRIAL_DAYS, FREE_DAILY_LIMIT } from '../config/plan';

const AuthContext = createContext();
const DAY_MS = 24 * 60 * 60 * 1000;
const REFERRAL_REWARD_DAYS = 3;
const REFERRAL_MAX = 5;

// Local YYYY-MM-DD key for the daily free-usage counter.
const todayKey = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const referralHandledRef = useRef(false);

  // Create user profile in Firestore (seeds plan, 7-day trial, and referral fields)
  const createUserProfile = async (user, additionalData = {}) => {
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      const { email, displayName, photoURL } = user;
      const now = Date.now();

      try {
        await setDoc(userRef, {
          displayName: displayName || additionalData.displayName || 'English Learner',
          email,
          photoURL: photoURL || null,
          createdAt: serverTimestamp(),
          level: 'Beginner',
          streak: 0,
          totalLessons: 0,
          hoursLearned: 0,
          // --- Plan / trial ---
          plan: 'free',
          trialStartsAt: now,
          trialEndsAt: now + TRIAL_DAYS * DAY_MS,
          premiumUntil: 0,          // bonus premium (from referrals) expiry in ms
          dailyUsageDate: null,
          dailyUsageCount: 0,
          // --- Referral ---
          referralCode: user.uid,   // share link uses this
          referralCount: 0,
          referralActive: true,
          referredBy: additionalData.referredBy || null,
          referralProcessed: false,
          ...additionalData
        });
        console.log('✅ User profile created in Firestore');
      } catch (error) {
        console.error('Error creating user profile:', error);
      }
    }
  };

  const signup = async (email, password, displayName, referredBy = null) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) {
        await updateProfile(userCredential.user, { displayName });
      }
      await createUserProfile(userCredential.user, { displayName, referredBy });
      console.log('✅ User signed up successfully');
      return userCredential;
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const login = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ User logged in successfully');
      return userCredential;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const loginWithGoogle = async (referredBy = null) => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await createUserProfile(result.user, referredBy ? { referredBy } : {});
      console.log('✅ User logged in with Google');
      return result;
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
    }
  };

  const logout = () => {
    console.log('👋 User logged out');
    setUserProfile(null);
    return signOut(auth);
  };

  // Credit a referrer once, when a new user they invited signs up.
  const processReferralOnce = async (uid, refCode) => {
    try {
      if (!refCode || refCode === uid) {
        await updateDoc(doc(db, 'users', uid), { referralProcessed: true }).catch(() => {});
        return;
      }
      const refRef = doc(db, 'users', refCode);
      const refSnap = await getDoc(refRef);
      if (!refSnap.exists()) {
        await updateDoc(doc(db, 'users', uid), { referralProcessed: true }).catch(() => {});
        return;
      }
      const r = refSnap.data();
      const count = r.referralCount || 0;
      if (r.referralActive === false || count >= REFERRAL_MAX) {
        // Link already maxed out — no reward, just close it and mark processed.
        await updateDoc(refRef, { referralActive: false }).catch(() => {});
        await updateDoc(doc(db, 'users', uid), { referralProcessed: true }).catch(() => {});
        return;
      }
      const newCount = count + 1;
      const base = Math.max(Date.now(), typeof r.premiumUntil === 'number' ? r.premiumUntil : 0);
      await updateDoc(refRef, {
        referralCount: newCount,
        premiumUntil: base + REFERRAL_REWARD_DAYS * DAY_MS,
        referralActive: newCount < REFERRAL_MAX,
      });
      await updateDoc(doc(db, 'users', uid), { referralProcessed: true }).catch(() => {});
      console.log(`🎁 Referral credited to ${refCode}: now ${newCount}/${REFERRAL_MAX}`);
    } catch (e) {
      console.error('processReferral error:', e);
    }
  };

  // Track the Firebase auth user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
      if (user) console.log('👤 Current user:', user.email);
    });
    return unsubscribe;
  }, []);

  // Live-subscribe to the Firestore profile; backfill fields + process referral
  useEffect(() => {
    referralHandledRef.current = false;
    if (!currentUser) {
      setUserProfile(null);
      return;
    }
    const userRef = doc(db, 'users', currentUser.uid);
    const unsub = onSnapshot(
      userRef,
      (snap) => {
        if (!snap.exists()) {
          setUserProfile(null);
          return;
        }
        const data = snap.data();

        const needsBackfill =
          data.plan === undefined ||
          data.trialEndsAt === undefined ||
          data.premiumUntil === undefined ||
          data.referralCode === undefined;

        if (needsBackfill) {
          const now = Date.now();
          const patch = {};
          if (data.plan === undefined) patch.plan = 'free';
          if (data.trialStartsAt === undefined) patch.trialStartsAt = now;
          if (data.trialEndsAt === undefined) patch.trialEndsAt = now + TRIAL_DAYS * DAY_MS;
          if (data.premiumUntil === undefined) patch.premiumUntil = 0;
          if (data.referralCode === undefined) patch.referralCode = currentUser.uid;
          if (data.referralCount === undefined) patch.referralCount = 0;
          if (data.referralActive === undefined) patch.referralActive = true;
          updateDoc(userRef, patch).catch(() => {});
          setUserProfile({ ...data, ...patch });
        } else {
          setUserProfile(data);
        }

        // Credit the referrer exactly once for this new account.
        if (data.referredBy && !data.referralProcessed && !referralHandledRef.current) {
          referralHandledRef.current = true;
          processReferralOnce(currentUser.uid, data.referredBy);
        }
      },
      (err) => console.error('Profile subscribe error:', err)
    );
    return unsub;
  }, [currentUser]);

  // ---- Entitlements (derived) ----
  const now = Date.now();
  const premiumUntil = typeof userProfile?.premiumUntil === 'number' ? userProfile.premiumUntil : 0;
  const trialEndsAt = typeof userProfile?.trialEndsAt === 'number' ? userProfile.trialEndsAt : 0;
  // premiumUntil === 0 (with plan 'premium') = UNLIMITED/lifetime; premiumUntil > 0 = active only UNTIL that date.
  const isPaidPremium = userProfile?.plan === 'premium' && (premiumUntil === 0 || premiumUntil > now);
  const isBonusPremium = userProfile?.plan !== 'premium' && premiumUntil > now; // referral bonus (timed)
  const isPremium = isPaidPremium || isBonusPremium;                            // "premium" in the UI
  const isTrialActive = !isPremium && trialEndsAt > now;
  const isPro = isPremium || isTrialActive;                                     // full, unlimited access
  const daysLeftInTrial = isTrialActive ? Math.max(0, Math.ceil((trialEndsAt - now) / DAY_MS)) : 0;
  const bonusDaysLeft = isBonusPremium ? Math.max(0, Math.ceil((premiumUntil - now) / DAY_MS)) : 0;
  // Days left on a TIMED premium (0 = unlimited / none)
  const premiumDaysLeft = (isPremium && premiumUntil > now) ? Math.max(0, Math.ceil((premiumUntil - now) / DAY_MS)) : 0;

  // Referral data
  const referralCode = userProfile?.referralCode || currentUser?.uid || '';
  const referralCount = userProfile?.referralCount || 0;
  const referralActive = userProfile ? userProfile.referralActive !== false : true;
  const referralLink =
    referralCode && typeof window !== 'undefined'
      ? `${window.location.origin}/signup?ref=${referralCode}`
      : '';

  // How many free conversations remain today (Infinity when Pro)
  const remainingToday = () => {
    if (isPro) return Infinity;
    const count = userProfile?.dailyUsageDate === todayKey() ? (userProfile?.dailyUsageCount || 0) : 0;
    return Math.max(0, FREE_DAILY_LIMIT - count);
  };

  // Call before an AI conversation. Pro = unlimited; free = metered per day.
  const consumeConversation = async () => {
    if (!currentUser) return { allowed: false, remaining: 0, limit: FREE_DAILY_LIMIT };
    if (isPro) return { allowed: true, remaining: Infinity, limit: Infinity };
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const snap = await getDoc(userRef);
      const data = snap.exists() ? snap.data() : {};
      const key = todayKey();
      let count = data.dailyUsageDate === key ? (data.dailyUsageCount || 0) : 0;
      if (count >= FREE_DAILY_LIMIT) {
        return { allowed: false, remaining: 0, limit: FREE_DAILY_LIMIT };
      }
      count += 1;
      await updateDoc(userRef, { dailyUsageDate: key, dailyUsageCount: count });
      setUserProfile((prev) => ({ ...(prev || {}), dailyUsageDate: key, dailyUsageCount: count }));
      return { allowed: true, remaining: FREE_DAILY_LIMIT - count, limit: FREE_DAILY_LIMIT };
    } catch (e) {
      console.error('consumeConversation error:', e);
      return { allowed: true, remaining: 0, limit: FREE_DAILY_LIMIT }; // don't block on error
    }
  };

  const updateUserProfile = async (data) => {
    if (!currentUser) return;
    const userRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userRef, data);
    setUserProfile((prev) => ({ ...(prev || {}), ...data }));
  };

  const updateDisplayName = async (name) => {
    if (!currentUser || !name) return;
    try {
      await updateProfile(auth.currentUser, { displayName: name });
    } catch (e) {
      console.error('updateDisplayName (auth) error:', e);
    }
    await updateUserProfile({ displayName: name });
  };

  // ---- Dev/test helpers (only wired to buttons that show on localhost) ----
  const devExpireTrial = () => updateUserProfile({ trialEndsAt: Date.now() - 1000, premiumUntil: 0, plan: 'free' });
  const devResetTrial = () => updateUserProfile({
    trialEndsAt: Date.now() + TRIAL_DAYS * DAY_MS, premiumUntil: 0, plan: 'free', dailyUsageCount: 0, dailyUsageDate: null,
  });
  const devTogglePremium = () => updateUserProfile(
    isPaidPremium ? { plan: 'free' } : { plan: 'premium', premiumUntil: 0, premiumSince: Date.now() }
  );
  const devClearUsage = () => updateUserProfile({ dailyUsageCount: 0, dailyUsageDate: null });
  const devSimulateReferral = async () => {
    const count = userProfile?.referralCount || 0;
    if (userProfile?.referralActive === false || count >= REFERRAL_MAX) return;
    const newCount = count + 1;
    const base = Math.max(Date.now(), typeof userProfile?.premiumUntil === 'number' ? userProfile.premiumUntil : 0);
    await updateUserProfile({
      referralCount: newCount,
      premiumUntil: base + REFERRAL_REWARD_DAYS * DAY_MS,
      referralActive: newCount < REFERRAL_MAX,
    });
  };

  const value = {
    currentUser,
    userProfile,
    signup,
    login,
    loginWithGoogle,
    logout,
    loading,
    createUserProfile,
    // plan / entitlements
    plan: userProfile?.plan || 'free',
    isPaidPremium,
    isBonusPremium,
    isPremium,
    isTrialActive,
    isPro,
    daysLeftInTrial,
    bonusDaysLeft,
    premiumDaysLeft,
    remainingToday,
    consumeConversation,
    updateUserProfile,
    updateDisplayName,
    // referral
    referralCode,
    referralCount,
    referralActive,
    referralLink,
    // dev/test
    devExpireTrial,
    devResetTrial,
    devTogglePremium,
    devClearUsage,
    devSimulateReferral,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Award, Flame, LogOut, Edit2, Save, X, Crown, Gift, Copy, Check, TrendingUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import activityTracker from '../services/activityTracker';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

const formatDate = (dateKey) => {
  const date = new Date(dateKey);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateObj = new Date(dateKey);
  dateObj.setHours(0, 0, 0, 0);

  if (dateObj.getTime() === today.getTime()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateObj.getTime() === yesterday.getTime()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// --- grouping helpers for the Day / Week / Month history views ---
const getMonday = (dateKey) => {
  const d = new Date(dateKey + 'T00:00:00');
  const shift = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - shift);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};
const weekLabel = (mondayKey) => {
  const start = new Date(mondayKey + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const opts = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
};
const monthLabel = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};
const scoreBadge = (s) =>
  s >= 80 ? 'bg-green-100 text-green-700' : s >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
const avgOf = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);

const Profile = () => {
  const {
    currentUser, logout, updateDisplayName,
    isPremium, isPaidPremium, isBonusPremium, isTrialActive, daysLeftInTrial, bonusDaysLeft,
    referralLink, referralCount, referralActive,
    devExpireTrial, devResetTrial, devTogglePremium, devClearUsage, devSimulateReferral,
  } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(currentUser?.displayName || 'English Learner');
  const [tempName, setTempName] = useState(displayName);
  const [userStats, setUserStats] = useState({ level: 'Beginner', streak: 0, totalLessons: 0, hoursLearned: 0 });
  const [dailyHistory, setDailyHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [historyView, setHistoryView] = useState('day'); // 'day' | 'week' | 'month'

  const copyReferral = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      console.error('copy failed', e);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadUserData();
      const unsubscribeDaily = subscribeToDailyActivities();
      return () => { if (unsubscribeDaily) unsubscribeDaily(); };
    }
  }, [currentUser]);

  const loadUserData = async () => {
    if (!currentUser) return;
    try {
      const stats = await activityTracker.getUserStats(currentUser.uid);
      if (stats) {
        setUserStats(stats);
        setDisplayName(currentUser.displayName || 'English Learner');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToDailyActivities = () => {
    if (!currentUser) return null;
    const ref = collection(db, 'users', currentUser.uid, 'dailyActivities');
    return onSnapshot(ref, (snap) => {
      const dailyByDate = {};
      snap.forEach((d) => {
        const id = d.id || '';
        const data = d.data();
        const dateKey = id.split('_')[0];
        if (!dailyByDate[dateKey]) dailyByDate[dateKey] = [];
        dailyByDate[dateKey].push({ id, ...data });
      });
      const datesArray = Object.keys(dailyByDate)
        .sort((a, b) => b.localeCompare(a))
        .map((dateKey) => ({ dateKey, activities: dailyByDate[dateKey] }));
      setDailyHistory(datesArray);
    }, (error) => console.error('Error subscribing to daily activities:', error));
  };

  const getTaskData = (activities, taskId) => {
    const taskDoc = activities.find((d) => {
      const key = d.activityId ? d.activityId : (d.id || '').split('_')[1] || '';
      return key === taskId;
    });
    if (!taskDoc) return { attempts: 0, attempt1Score: null, attempt2Score: null };
    const arr = Array.isArray(taskDoc.attempts) ? taskDoc.attempts : [];
    const v = (x) => (typeof x === 'number' ? x : x != null ? Number(x) : undefined);
    const a1 = typeof taskDoc.attempt1Score === 'number' ? taskDoc.attempt1Score : v(arr[0]?.score);
    const a2 = typeof taskDoc.attempt2Score === 'number' ? taskDoc.attempt2Score : v(arr[1]?.score);
    const attempts = Math.min(2, typeof taskDoc.attemptCount === 'number' ? taskDoc.attemptCount : arr.length || 0);
    return { attempts, attempt1Score: a1, attempt2Score: a2 };
  };

  const summarizeDay = (activities) => {
    const tasks = ['daily-1', 'daily-2', 'daily-3', 'daily-4'].map((t) => getTaskData(activities, t));
    const scores = [];
    let completed = 0;
    tasks.forEach((t) => {
      if (typeof t.attempt1Score === 'number') scores.push(t.attempt1Score);
      if (typeof t.attempt2Score === 'number') scores.push(t.attempt2Score);
      if (t.attempts > 0) completed += 1;
    });
    return { scores, completed };
  };

  // Group the day-level history into day / week / month buckets.
  const buildGroups = (history, mode) => {
    const map = new Map();
    for (const entry of history) {
      const { scores, completed } = summarizeDay(entry.activities);
      let key, label;
      if (mode === 'week') { key = getMonday(entry.dateKey); label = weekLabel(key); }
      else if (mode === 'month') { key = entry.dateKey.slice(0, 7); label = monthLabel(key); }
      else { key = entry.dateKey; label = formatDate(entry.dateKey); }
      if (!map.has(key)) map.set(key, { key, label, scores: [], completed: 0, activeDays: new Set(), days: [] });
      const g = map.get(key);
      g.scores.push(...scores);
      g.completed += completed;
      g.activeDays.add(entry.dateKey);
      g.days.push(entry);
    }
    return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
  };

  const handleLogout = async () => {
    try { await logout(); navigate('/login'); } catch (error) { console.error('Failed to logout:', error); }
  };
  const handleSave = async () => {
    setDisplayName(tempName);
    setIsEditing(false);
    try { await updateDisplayName(tempName); } catch (error) { console.error('Failed to update name:', error); }
  };
  const handleCancel = () => { setTempName(displayName); setIsEditing(false); };

  const groups = buildGroups(dailyHistory, historyView);

  const stats = [
    { icon: Award, label: 'Level', value: userStats.level, card: 'from-emerald-50 to-emerald-100', text: 'text-emerald-600' },
    { icon: Flame, label: 'Day Streak', value: userStats.streak, card: 'from-orange-50 to-orange-100', text: 'text-orange-600' },
    { icon: Award, label: 'Lessons', value: userStats.totalLessons, card: 'from-teal-50 to-teal-100', text: 'text-teal-600' },
    { icon: Award, label: 'Hours', value: userStats.hoursLearned?.toFixed(1) || 0, card: 'from-cyan-50 to-cyan-100', text: 'text-cyan-600' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="pt-24 pb-10 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">
              My Profile
            </h1>
            <p className="text-gray-500 text-sm">Manage your account and track your progress</p>
          </motion.div>

          {/* Profile Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden mb-6"
          >
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 h-28 sm:h-32" />
            <div className="px-5 sm:px-8 pb-6 sm:pb-8">
              <div className="flex flex-col sm:flex-row items-center sm:items-end -mt-16 mb-6 gap-4">
                <div className="w-28 h-28 sm:w-32 sm:h-32 bg-gradient-to-br from-gray-800 to-gray-700 rounded-full border-4 border-white shadow-lg flex items-center justify-center shrink-0">
                  <User className="w-14 h-14 sm:w-16 sm:h-16 text-white" />
                </div>

                <div className="sm:ml-2 text-center sm:text-left flex-1 min-w-0">
                  {isEditing ? (
                    <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                      <input
                        type="text"
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        className="text-xl sm:text-2xl font-bold text-gray-800 border-b-2 border-gray-900 outline-none px-2 py-1 w-full max-w-[220px]"
                      />
                      <button onClick={handleSave} className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors shrink-0">
                        <Save className="w-5 h-5" />
                      </button>
                      <button onClick={handleCancel} className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shrink-0">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                      <h2 className="text-xl sm:text-2xl font-bold text-gray-800 truncate">{displayName}</h2>
                      <button onClick={() => setIsEditing(true)} className="p-1 hover:bg-gray-100 rounded-lg transition-colors shrink-0">
                        <Edit2 className="w-5 h-5 text-gray-600" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center justify-center sm:justify-start gap-2 text-gray-600 text-sm">
                    <Mail className="w-4 h-4 shrink-0" />
                    <span className="truncate">{currentUser?.email}</span>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors shrink-0"
                >
                  <LogOut className="w-5 h-5" /> <span>Logout</span>
                </button>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-6">
                {stats.map((s) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className={`bg-gradient-to-br ${s.card} rounded-xl p-4 text-center`}>
                      <Icon className={`w-7 h-7 mx-auto mb-2 ${s.text}`} />
                      <p className={`text-xl sm:text-2xl font-bold ${s.text}`}>{s.value}</p>
                      <p className="text-xs sm:text-sm text-gray-600">{s.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>

          {/* Subscription / Plan */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-6 bg-white rounded-2xl shadow-lg border border-gray-100 p-6 sm:p-8"
          >
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0">
                  <Crown className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">
                    {isPaidPremium ? 'Premium' : isBonusPremium ? 'Premium (bonus)' : isTrialActive ? 'Free Trial' : 'Free Plan'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {isPaidPremium
                      ? 'Unlimited access — thank you! 💛'
                      : isBonusPremium
                        ? `${bonusDaysLeft} day${bonusDaysLeft !== 1 ? 's' : ''} of bonus Premium left`
                        : isTrialActive
                          ? `${daysLeftInTrial} day${daysLeftInTrial !== 1 ? 's' : ''} of Premium trial left`
                          : 'Upgrade for unlimited practice'}
                  </p>
                </div>
              </div>
              {!isPremium && (
                <button
                  onClick={() => navigate('/pricing')}
                  className="px-5 py-2.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors flex items-center gap-2"
                >
                  <Crown className="w-4 h-4" /> {isTrialActive ? 'Upgrade Early' : 'Go Premium'}
                </button>
              )}
            </div>
          </motion.div>

          {/* Refer & Earn */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6 bg-white rounded-2xl shadow-lg border border-gray-100 p-6 sm:p-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0">
                <Gift className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Refer &amp; Earn</h3>
                <p className="text-sm text-gray-500">Invite friends — get <b>3 days Premium</b> per signup (up to 5)</p>
              </div>
            </div>

            {referralActive ? (
              <>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    readOnly
                    value={referralLink}
                    onClick={(e) => e.target.select()}
                    className="flex-1 min-w-0 px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-700 outline-none"
                  />
                  <button
                    onClick={copyReferral}
                    className="px-5 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 shrink-0"
                  >
                    {copied ? <><Check className="w-4 h-4" /> Copied</> : <><Copy className="w-4 h-4" /> Copy</>}
                  </button>
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                    <span>Referrals used</span>
                    <span className="font-semibold">{referralCount} / 5</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all"
                      style={{ width: `${Math.min(100, (referralCount / 5) * 100)}%` }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-6 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-emerald-800 font-semibold">🎉 You've used all 5 referrals!</p>
                <p className="text-emerald-600 text-sm mt-1">Your referral link is now closed. Thanks for spreading the word!</p>
              </div>
            )}
          </motion.div>

          {/* Developer / Test controls — only on localhost (import.meta.env.DEV) */}
          {import.meta.env.DEV && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="mb-6 bg-yellow-50 border-2 border-dashed border-yellow-300 rounded-2xl p-6"
            >
              <h3 className="text-sm font-bold text-yellow-800 mb-1">🧪 Dev / Test panel (localhost only)</h3>
              <p className="text-xs text-yellow-700 mb-4">These buttons won't appear on the deployed site. Use them to preview each plan state.</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={devExpireTrial} className="px-3 py-2 bg-white border border-yellow-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-yellow-100 transition-colors">⏱️ Expire trial (see Free view)</button>
                <button onClick={devResetTrial} className="px-3 py-2 bg-white border border-yellow-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-yellow-100 transition-colors">🔄 Reset 7-day trial</button>
                <button onClick={devTogglePremium} className="px-3 py-2 bg-white border border-yellow-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-yellow-100 transition-colors">👑 Toggle admin Premium</button>
                <button onClick={devClearUsage} className="px-3 py-2 bg-white border border-yellow-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-yellow-100 transition-colors">♻️ Clear today's usage</button>
                <button onClick={devSimulateReferral} className="px-3 py-2 bg-white border border-yellow-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-yellow-100 transition-colors">🎁 Simulate referral (+1)</button>
              </div>
            </motion.div>
          )}

          {/* Progress History — Day / Week / Month, scrollable list */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 sm:p-8"
          >
            <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-gray-700" />
                <h3 className="text-xl font-bold text-gray-800">Progress History</h3>
              </div>
              <div className="inline-flex bg-gray-100 rounded-xl p-1">
                {['day', 'week', 'month'].map((m) => (
                  <button
                    key={m}
                    onClick={() => setHistoryView(m)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                      historyView === m ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12 text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-3" />
                <div>Loading history...</div>
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-lg mb-2">No history yet</div>
                <div className="text-sm">Complete daily tasks to see your progress here!</div>
              </div>
            ) : (
              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                {groups.map((g) => {
                  const avg = avgOf(g.scores);
                  if (historyView === 'day') {
                    const tasks = ['daily-1', 'daily-2', 'daily-3', 'daily-4'].map((t) => getTaskData(g.days[0].activities, t));
                    return (
                      <div key={g.key} className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 text-sm truncate">{g.label}</div>
                            <div className="text-xs text-gray-400">{g.key}</div>
                          </div>
                          {avg !== null && (
                            <span className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold ${scoreBadge(avg)}`}>avg {avg}%</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {tasks.map((t, i) => (
                            <div key={i} className="flex items-center gap-1.5 rounded-lg bg-white border border-gray-100 px-2.5 py-1.5">
                              <span className="text-[11px] font-medium text-gray-400">D{i + 1}</span>
                              {[t.attempt1Score, t.attempt2Score].map((s, k) =>
                                typeof s === 'number' ? (
                                  <span key={k} className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${scoreBadge(s)}`}>{s}%</span>
                                ) : (
                                  <span key={k} className="text-gray-300 text-[11px]">—</span>
                                )
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={g.key} className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 text-sm truncate">{g.label}</div>
                        <div className="text-xs text-gray-400">
                          {g.activeDays.size} active day{g.activeDays.size !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-teal-50 text-teal-700">
                          {g.completed} task{g.completed !== 1 ? 's' : ''}
                        </span>
                        {avg !== null && (
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${scoreBadge(avg)}`}>avg {avg}%</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Profile;

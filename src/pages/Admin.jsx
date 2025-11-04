import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X } from 'lucide-react';
import { db } from '../firebase/config';
import { collection, doc, getDoc, getDocs, setDoc, onSnapshot, deleteDoc, query, where, updateDoc } from 'firebase/firestore';

const getDateKey = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatDate = (dateKey) => {
  const date = new Date(dateKey);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateObj = new Date(dateKey);
  dateObj.setHours(0, 0, 0, 0);
  
  if (dateObj.getTime() === today.getTime()) {
    return 'Today';
  }
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateObj.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const Admin = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [liveUnsubs, setLiveUnsubs] = useState([]);
  const [passInput, setPassInput] = useState('');
  const [passError, setPassError] = useState('');
  const [passChecked, setPassChecked] = useState(() => sessionStorage.getItem('admin-pass-ok') === '1');
  const [passwordResetRequests, setPasswordResetRequests] = useState([]);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch all users
      const usersSnap = await getDocs(collection(db, 'users'));
      const result = await Promise.all(usersSnap.docs.map(async (userDoc) => {
        try {
          const userData = userDoc.data();
          // Fetch ALL daily activity docs for this user (not just today)
          const dailySnap = await getDocs(collection(db, 'users', userDoc.id, 'dailyActivities'));
          const dailyByDate = {};
          
          dailySnap.forEach((d) => {
            const id = d.id || '';
            const data = d.data();
            // Extract date from document ID (format: YYYY-MM-DD_activityId)
            const dateKey = id.split('_')[0];
            if (!dailyByDate[dateKey]) {
              dailyByDate[dateKey] = [];
            }
            dailyByDate[dateKey].push({ id, ...data });
          });

          // Convert to array sorted by date (newest first)
          const datesArray = Object.keys(dailyByDate)
            .sort((a, b) => b.localeCompare(a))
            .map(dateKey => ({
              dateKey,
              activities: dailyByDate[dateKey]
            }));

          return { 
            id: userDoc.id, 
            ...userData, 
            dates: datesArray 
          };
        } catch (e) {
          console.error('Error reading user activities:', e);
          return { id: userDoc.id, ...userDoc.data(), dates: [], _error: String(e?.message || e) };
        }
      }));
      setUsers(result);

      // Load password reset requests
      const resetRequestsSnap = await getDocs(collection(db, 'passwordResetRequests'));
      const requests = resetRequestsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPasswordResetRequests(requests);
      
      // Count unread requests
      const unread = requests.filter(req => !req.adminRead).length;
      setUnreadCount(unread);

      // Clear previous live listeners
      liveUnsubs.forEach((u) => {
        try { u(); } catch {}
      });
      const newUnsubs = [];
      
      // Attach live listeners for ALL activities per user to reflect scores immediately
      result.forEach((u) => {
        try {
          const ref = collection(db, 'users', u.id, 'dailyActivities');
          const unsub = onSnapshot(ref, (snap) => {
            const dailyByDate = {};
            snap.forEach((d) => {
              const id = d.id || '';
              const data = d.data();
              const dateKey = id.split('_')[0];
              if (!dailyByDate[dateKey]) {
                dailyByDate[dateKey] = [];
              }
              dailyByDate[dateKey].push({ id, ...data });
            });

            const datesArray = Object.keys(dailyByDate)
              .sort((a, b) => b.localeCompare(a))
              .map(dateKey => ({
                dateKey,
                activities: dailyByDate[dateKey]
              }));

            setUsers((prev) => prev.map((pu) => pu.id === u.id ? { ...pu, dates: datesArray } : pu));
          });
          newUnsubs.push(unsub);
        } catch (e) {
          console.warn('Failed to attach live listener for user', u.id, e);
        }
      });
      setLiveUnsubs(newUnsubs);
    } catch (e) {
      console.error('Error loading admin data:', e);
      setError(`Failed to load admin data: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (passChecked || !(import.meta.env.VITE_ADMIN_PASS)) {
      loadAll();
    }
  }, []);

  // Auto-refresh when window gains focus
  useEffect(() => {
    const onFocus = () => {
      if (passChecked || !(import.meta.env.VITE_ADMIN_PASS)) loadAll();
    };
    const onVisibility = () => {
      if (!document.hidden && (passChecked || !(import.meta.env.VITE_ADMIN_PASS))) loadAll();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [passChecked]);

  useEffect(() => {
    return () => {
      liveUnsubs.forEach((u) => {
        try { u(); } catch {}
      });
    };
  }, [liveUnsubs]);

  const handlePassSubmit = (e) => {
    e.preventDefault();
    const expected = import.meta.env.VITE_ADMIN_PASS || '';
    if (passInput && passInput === expected) {
      sessionStorage.setItem('admin-pass-ok', '1');
      setPassChecked(true);
      setPassError('');
      loadAll();
    } else {
      setPassError('Invalid admin password');
    }
  };

  const resetUserToday = async (userId) => {
    try {
      setRefreshing(true);
      const today = getDateKey();
      const dailySnap = await getDocs(collection(db, 'users', userId, 'dailyActivities'));
      const ops = [];
      dailySnap.forEach((d) => {
        const id = d.id || '';
        if (id.startsWith(`${today}_`)) {
          ops.push(setDoc(doc(db, 'users', userId, 'dailyActivities', id), {
            attemptCount: 0,
            completed: false,
            retestInProgress: false,
            attempts: [],
            attempt1Score: null,
            attempt2Score: null
          }, { merge: true }));
        }
      });
      await Promise.all(ops);
      await loadAll();
    } catch (e) {
      console.error('Error resetting limits:', e);
      setError(`Failed to reset: ${e?.message || e}`);
    } finally {
      setRefreshing(false);
    }
  };

  const clearUserData = async (userId) => {
    if (!window.confirm('Are you sure you want to clear all data for this user? This cannot be undone.')) {
      return;
    }
    try {
      setRefreshing(true);
      const dailySnap = await getDocs(collection(db, 'users', userId, 'dailyActivities'));
      const ops = [];
      dailySnap.forEach((d) => {
        ops.push(deleteDoc(doc(db, 'users', userId, 'dailyActivities', d.id)));
      });
      await Promise.all(ops);
      await loadAll();
    } catch (e) {
      console.error('Error clearing data:', e);
      setError(`Failed to clear data: ${e?.message || e}`);
    } finally {
      setRefreshing(false);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadRequests = passwordResetRequests.filter(req => !req.adminRead);
      const updatePromises = unreadRequests.map(req => 
        updateDoc(doc(db, 'passwordResetRequests', req.id), {
          adminRead: true,
          readAt: new Date()
        })
      );
      await Promise.all(updatePromises);
      setUnreadCount(0);
    } catch (e) {
      console.error('Error marking as read:', e);
    }
  };

  const approvePasswordReset = async (requestId, userEmail) => {
    if (!window.confirm(`Approve password reset for ${userEmail}?`)) {
      return;
    }
    try {
      setRefreshing(true);
      await updateDoc(doc(db, 'passwordResetRequests', requestId), {
        approved: true,
        status: 'approved',
        approvedAt: new Date()
      });
      await loadAll();
    } catch (e) {
      console.error('Error approving reset:', e);
      setError(`Failed to approve reset: ${e?.message || e}`);
    } finally {
      setRefreshing(false);
    }
  };

  const completePasswordReset = async (requestId, userEmail) => {
    if (!window.confirm(`Mark password reset as complete and remove request for ${userEmail}?`)) {
      return;
    }
    try {
      setRefreshing(true);
      await deleteDoc(doc(db, 'passwordResetRequests', requestId));
      await loadAll();
    } catch (e) {
      console.error('Error completing reset:', e);
      setError(`Failed to complete reset: ${e?.message || e}`);
    } finally {
      setRefreshing(false);
    }
  };

  const denyPasswordReset = async (requestId, userEmail) => {
    if (!window.confirm(`Deny password reset for ${userEmail}?`)) {
      return;
    }
    try {
      setRefreshing(true);
      await deleteDoc(doc(db, 'passwordResetRequests', requestId));
      await loadAll();
    } catch (e) {
      console.error('Error denying reset:', e);
      setError(`Failed to deny reset: ${e?.message || e}`);
    } finally {
      setRefreshing(false);
    }
  };

  const getTaskData = (activities, taskId) => {
    const taskDoc = activities.find(d => {
      const key = (d.activityId) ? d.activityId : ((d.id || '').split('_')[1] || '');
      return key === taskId;
    });
    if (!taskDoc) return { attempts: 0, attempt1Score: null, attempt2Score: null };
    
    const arr = Array.isArray(taskDoc.attempts) ? taskDoc.attempts : [];
    const v = (x) => (typeof x === 'number') ? x : (x != null ? Number(x) : undefined);
    const a1 = (typeof taskDoc.attempt1Score === 'number') ? taskDoc.attempt1Score : v(arr[0]?.score);
    const a2 = (typeof taskDoc.attempt2Score === 'number') ? taskDoc.attempt2Score : v(arr[1]?.score);
    const attempts = Math.min(2, (typeof taskDoc.attemptCount === 'number' ? taskDoc.attemptCount : arr.length || 0));
    
    return { attempts, attempt1Score: a1, attempt2Score: a2 };
  };

  if (!passChecked && import.meta.env.VITE_ADMIN_PASS) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="pt-12 pb-8 px-4">
          <div className="max-w-md mx-auto bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
            <h1 className="text-xl font-semibold mb-4 text-gray-900">Admin Password Required</h1>
            {passError && <div className="mb-3 text-red-600 text-sm bg-red-50 border border-red-200 px-3 py-2 rounded-xl">{passError}</div>}
            <form onSubmit={handlePassSubmit} className="space-y-4">
              <input
                type="password"
                value={passInput}
                onChange={(e) => setPassInput(e.target.value)}
                placeholder="Enter admin password"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none transition-all text-sm bg-white"
              />
              <button type="submit" className="w-full px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all font-medium shadow-md hover:shadow-lg">Unlock</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="pt-24 pb-8 px-4"><div className="max-w-6xl mx-auto text-gray-600">Loading admin…</div></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="pt-16 pb-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
              <p className="text-gray-600">Manage users and view activity data</p>
            </div>
            <div className="flex gap-3">
              {/* Requests Button with Notification Badge */}
              <button
                onClick={() => {
                  setShowRequestsModal(true);
                  if (unreadCount > 0) {
                    markAllAsRead();
                  }
                }}
                className="relative px-6 py-3 bg-yellow-500 text-white rounded-xl hover:bg-yellow-600 transition-all shadow-md hover:shadow-lg font-medium flex items-center gap-2"
              >
                <Bell className="w-5 h-5" />
                <span>Requests</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button
                disabled={refreshing}
                onClick={loadAll}
                className="px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all disabled:opacity-50 shadow-md hover:shadow-lg font-medium"
              >
                {refreshing ? 'Refreshing...' : 'Refresh Data'}
              </button>
            </div>
          </div>

          {error && <div className="mb-4 text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-xl text-sm">{error}</div>}

          {/* Password Reset Requests Section - REMOVED FROM MAIN VIEW */}
          {false && passwordResetRequests.length > 0 && (
            <div className="mb-8 bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Password Reset Requests</h2>
              <div className="space-y-3">
                {passwordResetRequests.map((request) => (
                  <div key={request.id} className="bg-white rounded-xl p-4 border border-yellow-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{request.email}</div>
                        <div className="text-sm text-gray-600">
                          Status: <span className={`font-medium ${
                            request.status === 'password_set' ? 'text-blue-600' :
                            request.status === 'approved' ? 'text-green-600' : 
                            'text-yellow-600'
                          }`}>
                            {request.status === 'password_set' ? 'Password Set by User' : request.status || 'pending'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Requested: {request.requestedAt?.toDate?.()?.toLocaleString() || 'Unknown'}
                        </div>
                        {request.status === 'password_set' && request.newPassword && (
                          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="text-xs font-medium text-blue-900 mb-1">New Password:</div>
                            <div className="font-mono text-sm text-blue-700">{request.newPassword}</div>
                            <div className="text-xs text-blue-600 mt-1">
                              ⚠️ Manually update this password in Firebase Authentication Console
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        {request.status === 'pending' && (
                          <>
                            <button
                              onClick={() => approvePasswordReset(request.id, request.email)}
                              disabled={refreshing}
                              className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all disabled:opacity-50 text-sm font-medium"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => denyPasswordReset(request.id, request.email)}
                              disabled={refreshing}
                              className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all disabled:opacity-50 text-sm font-medium"
                            >
                              Deny
                            </button>
                          </>
                        )}
                        {request.status === 'approved' && (
                          <span className="px-4 py-2 bg-green-100 text-green-700 rounded-xl text-sm font-medium">
                            ✓ Approved - Waiting for User
                          </span>
                        )}
                        {request.status === 'password_set' && (
                          <button
                            onClick={() => denyPasswordReset(request.id, request.email)}
                            disabled={refreshing}
                            className="px-4 py-2 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition-all disabled:opacity-50 text-sm font-medium"
                          >
                            Mark Complete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6">
            {users.map((u) => {
              const name = u.displayName || '—';
              const email = u.email || '—';
              return (
                <motion.div key={u.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                  {/* User Header */}
                  <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-200">
                    <div>
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">User</div>
                      <div className="font-semibold text-gray-900 text-lg">{name}</div>
                      <div className="text-sm text-gray-600 mt-1">{email}</div>
                      <div className="text-xs font-mono text-gray-400 mt-1">{u.id}</div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        disabled={refreshing} 
                        onClick={() => resetUserToday(u.id)} 
                        className="px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all disabled:opacity-50 text-sm font-medium shadow-md hover:shadow-lg"
                      >
                        Reset Today
                      </button>
                      <button 
                        disabled={refreshing} 
                        onClick={() => clearUserData(u.id)} 
                        className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all disabled:opacity-50 text-sm font-medium shadow-md hover:shadow-lg"
                      >
                        Clear Data
                      </button>
                    </div>
                  </div>

                  {/* Activity History Table */}
                  <div className="overflow-x-auto">
                    {u.dates && u.dates.length > 0 ? (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b-2 border-gray-300">
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                            <th className="text-center py-3 px-4 font-semibold text-gray-700">Daily 1</th>
                            <th className="text-center py-3 px-4 font-semibold text-gray-700">Daily 2</th>
                            <th className="text-center py-3 px-4 font-semibold text-gray-700">Daily 3</th>
                            <th className="text-center py-3 px-4 font-semibold text-gray-700">Daily 4</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {u.dates.map((dateGroup) => {
                            const tasks = ['daily-1', 'daily-2', 'daily-3', 'daily-4'].map(taskId => 
                              getTaskData(dateGroup.activities, taskId)
                            );
                            
                            return (
                              <tr key={dateGroup.dateKey} className="hover:bg-gray-50 transition-colors">
                                <td className="py-4 px-4">
                                  <div className="font-medium text-gray-900">{formatDate(dateGroup.dateKey)}</div>
                                  <div className="text-xs text-gray-500 mt-1">{dateGroup.dateKey}</div>
                                </td>
                                {tasks.map((taskData, idx) => (
                                  <td key={idx} className="py-4 px-4 text-center">
                                    <div className="inline-flex flex-col items-center space-y-1">
                                      <div className="text-xs text-gray-600">({taskData.attempts}/2)</div>
                                      <div className="flex items-center gap-2">
                                        {typeof taskData.attempt1Score === 'number' ? (
                                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                                            taskData.attempt1Score >= 80 ? 'bg-green-100 text-green-700' :
                                            taskData.attempt1Score >= 60 ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-red-100 text-red-700'
                                          }`}>
                                            {taskData.attempt1Score}%
                                          </span>
                                        ) : (
                                          <span className="text-gray-300 text-xs">—</span>
                                        )}
                                        {typeof taskData.attempt2Score === 'number' ? (
                                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                                            taskData.attempt2Score >= 80 ? 'bg-green-100 text-green-700' :
                                            taskData.attempt2Score >= 60 ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-red-100 text-red-700'
                                          }`}>
                                            {taskData.attempt2Score}%
                                          </span>
                                        ) : (
                                          <span className="text-gray-300 text-xs">—</span>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        <div className="text-lg mb-2">No activity data available</div>
                        <div className="text-sm">This user hasn't completed any daily tasks yet.</div>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Requests Modal */}
      <AnimatePresence>
        {showRequestsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-yellow-50">
                <div className="flex items-center gap-3">
                  <Bell className="w-6 h-6 text-yellow-600" />
                  <h2 className="text-2xl font-bold text-gray-900">Password Reset Requests</h2>
                  {passwordResetRequests.length > 0 && (
                    <span className="bg-red-600 text-white text-sm font-bold rounded-full px-3 py-1">
                      {passwordResetRequests.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowRequestsModal(false)}
                  className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-gray-600" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(80vh-100px)]">
                {passwordResetRequests.length === 0 ? (
                  <div className="text-center py-12">
                    <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No Requests</h3>
                    <p className="text-gray-600">There are no password reset requests at the moment.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {passwordResetRequests.map((request) => (
                      <motion.div
                        key={request.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`bg-gray-50 rounded-xl p-5 border-2 hover:border-yellow-300 transition-all ${
                          !request.adminRead ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {!request.adminRead && (
                                <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full">NEW</span>
                              )}
                              <div className="font-bold text-lg text-gray-900">{request.email}</div>
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                request.status === 'password_reset_sent' ? 'bg-blue-100 text-blue-700' :
                                request.status === 'approved' ? 'bg-green-100 text-green-700' : 
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                {request.status === 'password_reset_sent' ? 'Reset Email Sent' :
                                 request.status === 'approved' ? 'Approved' : 
                                 request.status || 'Pending'}
                              </span>
                            </div>
                            
                            <div className="text-sm text-gray-600 mb-3">
                              <div>📅 Requested: {request.requestedAt?.toDate?.()?.toLocaleString() || 'Unknown'}</div>
                              {request.approvedAt && (
                                <div>✓ Approved: {request.approvedAt?.toDate?.()?.toLocaleString()}</div>
                              )}
                            </div>

                            {request.status === 'password_reset_sent' && request.newPasswordToSet && (
                              <div className="mt-3 p-3 bg-blue-50 border-2 border-blue-200 rounded-lg">
                                <div className="text-xs font-semibold text-blue-900 mb-1">User's New Password:</div>
                                <div className="font-mono text-base font-bold text-blue-700 mb-2">{request.newPasswordToSet}</div>
                                <div className="text-xs text-blue-600">
                                  ℹ️ Password reset email sent. User will set this password after clicking the reset link.
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col gap-2 ml-4">
                            {request.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => approvePasswordReset(request.id, request.email)}
                                  disabled={refreshing}
                                  className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all disabled:opacity-50 text-sm font-semibold shadow-md"
                                >
                                  ✓ Approve
                                </button>
                                <button
                                  onClick={() => denyPasswordReset(request.id, request.email)}
                                  disabled={refreshing}
                                  className="px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all disabled:opacity-50 text-sm font-semibold shadow-md"
                                >
                                  ✗ Deny
                                </button>
                              </>
                            )}
                            {request.status === 'approved' && (
                              <div className="px-5 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-semibold text-center">
                                ✓ Approved<br/>
                                <span className="text-xs">Waiting for User</span>
                              </div>
                            )}
                            {request.status === 'password_reset_sent' && (
                              <button
                                onClick={() => completePasswordReset(request.id, request.email)}
                                disabled={refreshing}
                                className="px-5 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-all disabled:opacity-50 text-sm font-semibold shadow-md"
                              >
                                Mark Complete
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Admin;

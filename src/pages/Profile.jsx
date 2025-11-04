import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Award, Flame, LogOut, Edit2, Save, X } from 'lucide-react';
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

const Profile = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(currentUser?.displayName || 'English Learner');
  const [tempName, setTempName] = useState(displayName);
  const [userStats, setUserStats] = useState({
    level: 'Beginner',
    streak: 0,
    totalLessons: 0,
    hoursLearned: 0,
  });
  const [dailyHistory, setDailyHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      loadUserData();
      const unsubscribeDaily = subscribeToDailyActivities();
      return () => {
        if (unsubscribeDaily) unsubscribeDaily();
      };
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
    const unsubscribe = onSnapshot(ref, (snap) => {
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

      setDailyHistory(datesArray);
    }, (error) => {
      console.error('Error subscribing to daily activities:', error);
    });

    return unsubscribe;
  };

  // Achievements removed per request

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

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };

  const handleSave = () => {
    setDisplayName(tempName);
    setIsEditing(false);
    // Here you would update the user profile in Firebase
  };

  const handleCancel = () => {
    setTempName(displayName);
    setIsEditing(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="pt-24 pb-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">
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
            {/* Header Section with Gradient */}
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 h-32"></div>

            <div className="px-8 pb-8">
              {/* Avatar */}
              <div className="flex flex-col sm:flex-row items-center sm:items-end -mt-16 mb-6">
                <div className="w-32 h-32 bg-gradient-to-br from-gray-800 to-gray-700 rounded-full border-4 border-white shadow-lg flex items-center justify-center mb-4 sm:mb-0">
                  <User className="w-16 h-16 text-white" />
                </div>

                <div className="sm:ml-6 text-center sm:text-left flex-1">
                  {isEditing ? (
                    <div className="flex items-center space-x-2 mb-2">
                      <input
                        type="text"
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        className="text-2xl font-bold text-gray-800 border-b-2 border-gray-900 outline-none px-2 py-1"
                      />
                      <button
                        onClick={handleSave}
                        className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                      >
                        <Save className="w-5 h-5" />
                      </button>
                      <button
                        onClick={handleCancel}
                        className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center sm:justify-start space-x-2 mb-2">
                      <h2 className="text-2xl font-bold text-gray-800">{displayName}</h2>
                      <button
                        onClick={() => setIsEditing(true)}
                        className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-5 h-5 text-gray-600" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center justify-center sm:justify-start space-x-2 text-gray-600">
                    <Mail className="w-4 h-4" />
                    <span>{currentUser?.email}</span>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="mt-4 sm:mt-0 flex items-center space-x-2 px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Logout</span>
                </button>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 text-center">
                  <Award className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-emerald-600">{userStats.level}</p>
                  <p className="text-sm text-gray-600">Level</p>
                </div>

                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 text-center">
                  <Flame className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-orange-600">{userStats.streak}</p>
                  <p className="text-sm text-gray-600">Day Streak</p>
                </div>

                <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-xl p-4 text-center">
                  <Award className="w-8 h-8 text-teal-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-teal-600">{userStats.totalLessons}</p>
                  <p className="text-sm text-gray-600">Lessons</p>
                </div>

                <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-xl p-4 text-center">
                  <Award className="w-8 h-8 text-cyan-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-cyan-600">{userStats.hoursLearned?.toFixed(1) || 0}</p>
                  <p className="text-sm text-gray-600">Hours</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Achievements section removed per request */}

          {/* Daily Task History */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6 bg-white rounded-2xl shadow-lg border border-gray-100 p-8"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-800">Daily Task History</h3>
              {dailyHistory && dailyHistory.length > 0 && (
                <span className="text-sm text-gray-500">{dailyHistory.length} day{dailyHistory.length !== 1 ? 's' : ''} tracked</span>
              )}
            </div>

            {loading ? (
              <div className="text-center py-12 text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-3"></div>
                <div>Loading history...</div>
              </div>
            ) : dailyHistory && dailyHistory.length > 0 ? (
              <div className="overflow-x-auto">
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
                    {dailyHistory.map((dateGroup) => {
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
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <div className="text-lg mb-2">No daily task history yet</div>
                <div className="text-sm">Start completing tasks to see your progress here!</div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Profile;

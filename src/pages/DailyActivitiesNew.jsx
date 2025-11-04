import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, MessageCircle, Mic, Trophy, CheckCircle, Target, Star, TrendingUp, Award, Clock } from 'lucide-react';
import Navbar from '../components/Navbar';
import QuizModal from '../components/QuizModal';
import { useAuth } from '../contexts/AuthContext';
import activityTracker from '../services/activityTracker';
import { grammarQuizzes, vocabularyQuizzes, dailyTasks } from '../data/quizData';
import { doc, getDoc, collection, query, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useNavigate } from 'react-router-dom';
import { getDateKey, getMillisecondsUntilMidnight } from '../utils/dateUtils';

const DailyActivities = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [activities, setActivities] = useState(dailyTasks);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [streak, setStreak] = useState(0);
  const [userStats, setUserStats] = useState(null);
  const [quizScores, setQuizScores] = useState({});

  // Midnight refresh - reset activities at 12:00 AM
  useEffect(() => {
    const scheduleNextMidnightRefresh = () => {
      const msUntilMidnight = getMillisecondsUntilMidnight();
      const timeoutId = setTimeout(() => {
        // Reload activities at midnight
        if (currentUser) {
          loadUserData();
        }
        // Schedule next midnight refresh
        scheduleNextMidnightRefresh();
      }, msUntilMidnight);
      return timeoutId;
    };

    const timeoutId = scheduleNextMidnightRefresh();
    return () => clearTimeout(timeoutId);
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadUserData();
      activityTracker.startSession(currentUser.uid);
      activityTracker.updateStreak(currentUser.uid);
    }

    return () => {
      if (currentUser) {
        activityTracker.endSession();
      }
    };
  }, [currentUser]);

  // Refresh activities when tab regains focus or becomes visible
  useEffect(() => {
    const onFocus = () => {
      if (currentUser) loadUserData();
    };
    const onVisibility = () => {
      if (!document.hidden && currentUser) loadUserData();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [currentUser]);

  const loadUserData = async () => {
    if (!currentUser) return;

    try {
      // Load user stats
      const stats = await activityTracker.getUserStats(currentUser.uid);
      setUserStats(stats);
      setStreak(stats?.streak || 0);

      // Today key for daily activity per-activity tracking
      const dateKey = getDateKey();

      // Fetch each activity's daily status (attempts, completion)
      const updated = await Promise.all(activities.map(async (activity) => {
        const ref = doc(db, 'users', currentUser.uid, 'dailyActivities', `${dateKey}_${activity.id}`);
        const snap = await getDoc(ref);
        
        if (activity.type === 'quiz') {
          if (snap.exists()) {
            const d = snap.data();
            const attempts = d.attemptCount || 0;
            let attemptScores = Array.isArray(d.attempts) ? d.attempts.map(a => a.score || 0).slice(0, 2) : [];
            // Prefer explicit fields if present
            if (typeof d.attempt1Score === 'number' || typeof d.attempt2Score === 'number') {
              attemptScores = [d.attempt1Score, d.attempt2Score].filter(v => typeof v === 'number');
            }
            const isCompleted = attempts >= 2; // completed only after 2 attempts
            return {
              ...activity,
              completed: isCompleted,
              attemptCount: attempts,
              progress: isCompleted ? 100 : (attempts > 0 ? 50 : 0),
              attemptScores
            };
          }
          return { ...activity, completed: false, attemptCount: 0 };
        } else if (activity.type === 'speaking' || activity.type === 'conversation') {
          // Check if speaking/conversation activity is completed
          if (snap.exists()) {
            const d = snap.data();
            const isCompleted = Boolean(d.completed);
            return {
              ...activity,
              completed: isCompleted,
              progress: isCompleted ? 100 : 0
            };
          }
          return { ...activity, completed: false, progress: 0 };
        }
        
        return { ...activity };
      }));

      setActivities(updated);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleStartActivity = (activity) => {
    if (activity.type === 'quiz') {
      // Enforce lockout on second attempt
      if (activity.attemptCount >= 2) {
        return;
      }
      // If one attempt already used, lock retake (attempt 2) before navigating
      if ((activity.attemptCount || 0) === 1) {
        const dateKey = getDateKey();
        const ref = doc(db, 'users', currentUser.uid, 'dailyActivities', `${dateKey}_${activity.id}`);
        setDoc(ref, { attemptCount: 2, completed: false, retestInProgress: true, retestSeeded: false, retestStartedAt: serverTimestamp() }, { merge: true });
        setActivities(prev => prev.map(a => a.id === activity.id ? { ...a, attemptCount: 2, completed: false, progress: 50 } : a));
      }
      // Navigate to dedicated quiz page
      navigate(`/activity/${activity.id}`);
    } else if (activity.type === 'speaking') {
      navigate('/speaking-practice');
    } else if (activity.type === 'conversation') {
      navigate('/conversation-challenge');
    }
    activityTracker.logActivity('activity_started', { activityId: activity.id });
  };

  const handleQuizComplete = async (score) => {
    // Reload user data to reflect new scores
    await loadUserData();
    activityTracker.logActivity('quiz_completed', { score });
  };

  const completedCount = activities.filter((a) => a.completed).length;
  const totalActivities = activities.length;
  
  // Calculate average score from all quiz attempts
  const calculateAverageScore = () => {
    const quizActivities = activities.filter(a => a.type === 'quiz');
    const scores = [];
    quizActivities.forEach(activity => {
      if (activity.attemptScores && activity.attemptScores.length > 0) {
        scores.push(...activity.attemptScores);
      }
    });
    if (scores.length === 0) return 0;
    const sum = scores.reduce((acc, score) => acc + score, 0);
    return Math.round(sum / scores.length);
  };
  
  const averageScore = calculateAverageScore();
  const bestStreak = userStats?.bestStreak || streak;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="pt-24 pb-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">
              Daily Activities
            </h1>
            <p className="text-gray-500 text-sm">Complete your daily tasks to improve your English</p>
          </motion.div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {/* Streak Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium mb-1">Current Streak</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
                    {streak} Days
                  </p>
                </div>
                <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center">
                  <Trophy className="w-8 h-8 text-white" />
                </div>
              </div>
            </motion.div>

            {/* Completed Today */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-2xl shadow-lg p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium mb-1">Completed Today</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">
                    {completedCount}/{totalActivities}
                  </p>
                </div>
                <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
              </div>
            </motion.div>

            {/* Average Score */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-2xl shadow-lg p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium mb-1">Average Score</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
                    {averageScore}%
                  </p>
                </div>
                <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                  <Target className="w-8 h-8 text-white" />
                </div>
              </div>
            </motion.div>

            {/* Best Streak */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-2xl shadow-lg p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium mb-1">Best Streak</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
                    {bestStreak} Days
                  </p>
                </div>
                <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                  <Award className="w-8 h-8 text-white" />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Activities Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {activities.map((activity, index) => {
              const Icon = activity.icon === 'BookOpen' ? BookOpen :
                          activity.icon === 'MessageCircle' ? MessageCircle :
                          activity.icon === 'Mic' ? Mic : Trophy;
              
              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                  className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow duration-300"
                >
                  <div className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-4">
                        <div
                          className={`w-14 h-14 bg-gradient-to-br ${activity.color} rounded-xl flex items-center justify-center`}
                        >
                          <Icon className="w-7 h-7 text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-800">{activity.title}</h3>
                          <p className="text-sm text-gray-500 flex items-center mt-1">
                            <Clock className="w-4 h-4 mr-1" />
                            {activity.duration} • {activity.points} points
                          </p>
                        </div>
                      </div>
                      {activity.completed && (
                        <div className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-sm font-semibold flex items-center space-x-1">
                          <CheckCircle className="w-4 h-4" />
                          <span>Done</span>
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    <p className="text-gray-600 mb-4">{activity.description}</p>

                    {/* Scores per Attempt */}
                    {Array.isArray(activity.attemptScores) && activity.attemptScores.length > 0 && (
                      <div className="mb-4 p-3 bg-emerald-50 rounded-lg">
                        <div className="flex flex-wrap gap-4 text-sm text-gray-700">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Attempt 1:</span>
                            <span className="font-bold text-emerald-600">{activity.attemptScores[0] ?? '-'}%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Attempt 2:</span>
                            <span className="font-bold text-emerald-600">{activity.attemptScores[1] ?? '-'}%</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>Progress</span>
                        <span>{activity.progress || 0}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${activity.progress || 0}%` }}
                          transition={{ duration: 1, delay: 0.2 * index }}
                          className={`h-full bg-gradient-to-r ${activity.color}`}
                        />
                      </div>
                    </div>

                    {/* Action Button(s) */}
                    {activity.type === 'quiz' ? (
                      <div className="grid grid-cols-1 gap-3">
                        <button
                          onClick={() => handleStartActivity(activity)}
                          disabled={activity.attemptCount >= 2}
                          className={`w-full py-3 rounded-xl font-semibold transition-all duration-200 ${
                            activity.attemptCount >= 2
                              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                              : `bg-gray-900 text-white hover:bg-gray-800 hover:shadow-lg`
                          }`}
                        >
                          {activity.attemptCount >= 2 ? 'Completed' : (activity.attemptCount === 1 ? 'Retake (1 left)' : 'Start Activity')}
                        </button>
                        <p className="text-center text-sm text-gray-600">Attempts today: {activity.attemptCount || 0}/2</p>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleStartActivity(activity)}
                        className={`w-full py-3 rounded-xl font-semibold transition-all duration-200 ${
                          `bg-gray-900 text-white hover:bg-gray-800 hover:shadow-lg`
                        }`}
                      >
                        Start Activity
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Motivational Message */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl shadow-lg border border-gray-700/20 p-6 text-white text-center"
          >
            <TrendingUp className="w-12 h-12 mx-auto mb-3" />
            <h3 className="text-2xl font-bold mb-2">Keep Going! 🎉</h3>
            <p className="text-gray-300">
              You're doing great! Complete all activities to maintain your streak and unlock achievements.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Quiz Modal */}
      {selectedQuiz && (
        <QuizModal
          quiz={selectedQuiz}
          onClose={() => setSelectedQuiz(null)}
          onComplete={handleQuizComplete}
        />
      )}
    </div>
  );
};

export default DailyActivities;

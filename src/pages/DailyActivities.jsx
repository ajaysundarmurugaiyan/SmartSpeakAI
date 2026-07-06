import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, MessageCircle, Mic, Trophy, CheckCircle, Clock, Star, TrendingUp } from 'lucide-react';
import Navbar from '../components/Navbar';
import QuizModal from '../components/QuizModal';
import { useAuth } from '../contexts/AuthContext';
import activityTracker from '../services/activityTracker';
import { grammarQuizzes, vocabularyQuizzes, dailyTasks } from '../data/quizData';
import { doc, getDoc, collection, query, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';

const DailyActivities = () => {
  const [activities, setActivities] = useState([
    {
      id: 1,
      title: 'Grammar Quiz',
      description: 'Test your knowledge of English grammar rules',
      icon: BookOpen,
      color: 'from-blue-400 to-blue-600',
      progress: 60,
      completed: false,
      duration: '10 min',
    },
    {
      id: 2,
      title: 'Vocabulary Challenge',
      description: 'Learn 10 new words and their usage',
      icon: MessageCircle,
      color: 'from-purple-400 to-purple-600',
      progress: 30,
      completed: false,
      duration: '15 min',
    },
    {
      id: 3,
      title: 'Daily Speaking Practice',
      description: 'Practice pronunciation with AI feedback',
      icon: Mic,
      color: 'from-pink-400 to-pink-600',
      progress: 0,
      completed: false,
      duration: '20 min',
    },
    {
      id: 4,
      title: 'Conversation Challenge',
      description: 'Complete a full conversation scenario',
      icon: Trophy,
      color: 'from-green-400 to-green-600',
      progress: 100,
      completed: true,
      duration: '25 min',
    },
  ]);

  const [streak, setStreak] = useState(7);

  const handleComplete = (id) => {
    setActivities((prev) =>
      prev.map((activity) =>
        activity.id === id
          ? { ...activity, progress: 100, completed: true }
          : activity
      )
    );
  };

  const completedCount = activities.filter((a) => a.completed).length;
  const totalActivities = activities.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <Navbar />

      <div className="pt-24 pb-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
              Daily Activities
            </h1>
            <p className="text-gray-600">Complete your daily tasks to improve your English</p>
          </motion.div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Streak Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl shadow-lg p-6"
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

            {/* Total Time */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-2xl shadow-lg p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium mb-1">Time Invested</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
                    45 min
                  </p>
                </div>
                <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                  <Clock className="w-8 h-8 text-white" />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Activities Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {activities.map((activity, index) => {
              const Icon = activity.icon;
              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                  className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300"
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
                            {activity.duration}
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

                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>Progress</span>
                        <span>{activity.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${activity.progress}%` }}
                          transition={{ duration: 1, delay: 0.2 * index }}
                          className={`h-full bg-gradient-to-r ${activity.color}`}
                        />
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      onClick={() => handleComplete(activity.id)}
                      disabled={activity.completed}
                      className={`w-full py-3 rounded-lg font-semibold transition-all duration-200 ${
                        activity.completed
                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          : `bg-gradient-to-r ${activity.color} text-white hover:shadow-lg`
                      }`}
                    >
                      {activity.completed ? 'Completed' : 'Start Activity'}
                    </button>
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
            className="mt-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl shadow-lg p-6 text-white text-center"
          >
            <h3 className="text-2xl font-bold mb-2">Keep Going! 🎉</h3>
            <p className="text-blue-100">
              You're doing great! Complete all activities to maintain your streak and unlock achievements.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default DailyActivities;

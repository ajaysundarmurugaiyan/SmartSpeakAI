import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Trash2, Bot, User, Clock, CheckCircle, ArrowLeft, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import openAIService from '../services/openAIService';
import geminiService from '../services/geminiService';
import activityTracker from '../services/activityTracker';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase/config';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getDateKey, getMillisecondsUntilMidnight } from '../utils/dateUtils';

const REQUIRED_TIME_MS = 20 * 60 * 1000; // 20 minutes in milliseconds

const ConversationChallengeActivity = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([
    {
      type: 'ai',
      text: "Hello! I'm your English conversation partner. Let's have a natural conversation to practice your English skills. Feel free to talk about anything! 😊",
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  
  const messagesEndRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const startTimeRef = useRef(Date.now());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Prevent browser back button until activity is completed
  useEffect(() => {
    if (!isCompleted) {
      const handlePopState = (e) => {
        e.preventDefault();
        window.history.pushState(null, '', window.location.href);
        setShowExitWarning(true);
      };

      // Push initial state
      window.history.pushState(null, '', window.location.href);
      
      // Listen for back button
      window.addEventListener('popstate', handlePopState);

      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [isCompleted]);

  // Midnight refresh - reset activities at 12:00 AM
  useEffect(() => {
    const scheduleNextMidnightRefresh = () => {
      const msUntilMidnight = getMillisecondsUntilMidnight();
      const timeoutId = setTimeout(() => {
        // Reload page at midnight to reset activity
        window.location.href = '/activities';
      }, msUntilMidnight);
      return timeoutId;
    };

    const timeoutId = scheduleNextMidnightRefresh();
    return () => clearTimeout(timeoutId);
  }, []);

  // Timer effect
  useEffect(() => {
    startTimeRef.current = Date.now();
    
    timerIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      setTimeElapsed(elapsed);
      
      // Check if required time is completed
      if (elapsed >= REQUIRED_TIME_MS && !isCompleted) {
        handleActivityCompletion();
      }
    }, 1000);

    // Track activity
    if (currentUser) {
      activityTracker.logActivity('conversation_challenge_started');
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  const handleActivityCompletion = async () => {
    setIsCompleted(true);
    setShowCompletionDialog(true);
    
    // Save completion to Firebase
    if (currentUser) {
      try {
        const dateKey = getDateKey();
        const activityRef = doc(db, 'users', currentUser.uid, 'dailyActivities', `${dateKey}_daily-6`);
        
        await setDoc(activityRef, {
          activityId: 'daily-6',
          dateKey,
          completed: true,
          completedAt: serverTimestamp(),
          timeSpent: REQUIRED_TIME_MS,
          type: 'conversation'
        }, { merge: true });

        activityTracker.logActivity('conversation_challenge_completed', { timeSpent: REQUIRED_TIME_MS });
      } catch (error) {
        console.error('Error saving completion:', error);
      }
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;

    // Add user message
    const userMessage = { type: 'user', text: inputText };
    setMessages((prev) => [...prev, userMessage]);
    const messageText = inputText;
    setInputText('');
    setIsTyping(true);

    // Log activity
    if (currentUser) {
      activityTracker.logActivity('conversation_message', { messageLength: messageText.length });
    }

    try {
      // Get AI response from OpenAI service
      const result = await openAIService.getAIResponse(messageText, { mode: 'conversation' });
      
      setMessages((prev) => [...prev, { 
        type: 'ai', 
        text: result.response
      }]);

    } catch (error) {
      console.error('Error getting AI response:', error);
      // Fallback to Gemini on quota/429
      if (error?.status === 429 || error?.code === 'insufficient_quota') {
        try {
          const alt = await geminiService.getEnglishLearningResponse(messageText, 'conversation');
          setMessages((prev) => [...prev, { type: 'ai', text: alt.response }]);
        } catch (e2) {
          console.error('Fallback model also failed:', e2);
          setMessages((prev) => [...prev, { 
            type: 'ai', 
            text: "The AI is rate-limited right now. Please try again in a minute or check API billing." 
          }]);
        }
      } else {
        setMessages((prev) => [...prev, { 
          type: 'ai', 
          text: "I'm having trouble connecting right now. Please try again!" 
        }]);
      }
    } finally {
      setIsTyping(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        type: 'ai',
        text: "Chat cleared! Ready to start a new conversation. How can I help you today?",
      },
    ]);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleBackClick = () => {
    if (!isCompleted) {
      setShowExitWarning(true);
    } else {
      navigate('/activities');
    }
  };

  const handleConfirmExit = () => {
    navigate('/activities');
  };

  const handleCancelExit = () => {
    setShowExitWarning(false);
  };

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const requiredMinutes = Math.floor(REQUIRED_TIME_MS / 60000);
  const progress = Math.min((timeElapsed / REQUIRED_TIME_MS) * 100, 100);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="pt-8 pb-8 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Back Button and Timer Header */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={handleBackClick}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Back to Activities</span>
            </button>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100">
                <Clock className="w-5 h-5 text-gray-900" />
                <span className="text-xl font-bold text-gray-900">{formatTime(timeElapsed)}</span>
                <span className="text-gray-500">/ {requiredMinutes} min</span>
              </div>
              {isCompleted && (
                <div className="flex items-center space-x-2 bg-green-100 text-green-600 px-3 py-2 rounded-xl">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-semibold">Completed</span>
                </div>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="h-full bg-gray-900"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              {isCompleted 
                ? "Great job! You can continue chatting or go back to activities."
                : `Complete ${requiredMinutes} minutes to mark this activity as done.`}
            </p>
          </div>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">
              Conversation Challenge
            </h1>
            <p className="text-gray-500 text-sm">
              Practice natural English conversation with AI
            </p>
          </motion.div>

          {/* Main Chat Container */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden flex flex-col" style={{ height: '600px' }}>
            {/* Chat Header */}
            <div className="bg-gray-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Bot className="w-5 h-5" />
                <span className="font-medium">AI Conversation Partner</span>
              </div>
              <button
                onClick={handleClearChat}
                className="flex items-center space-x-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span className="text-sm">Clear</span>
              </button>
            </div>

            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
              <AnimatePresence>
                {messages.map((message, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                        message.type === 'user'
                          ? 'bg-gray-900 text-white'
                          : 'bg-white border border-gray-200 text-gray-800'
                      }`}
                    >
                      <p className="text-sm leading-relaxed">{message.text}</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isTyping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="px-4 py-3 rounded-2xl bg-white border border-gray-200">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-200 p-4 bg-white">
              <div className="flex items-center space-x-3">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  rows="2"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSend}
                  disabled={!inputText.trim() || isTyping}
                  className="w-12 h-12 bg-gray-900 text-white rounded-xl flex items-center justify-center hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  <Send className="w-5 h-5" />
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Exit Warning Dialog */}
      {showExitWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
          >
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-yellow-100 rounded-full">
              <AlertCircle className="w-8 h-8 text-yellow-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
              Activity Not Completed
            </h3>
            <p className="text-gray-600 text-center mb-6">
              You haven't completed the required {requiredMinutes} minutes yet. If you leave now, this activity will not be marked as completed and you'll need to start over.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={handleCancelExit}
                className="flex-1 px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors font-medium"
              >
                Continue Chat
              </button>
              <button
                onClick={handleConfirmExit}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-medium"
              >
                Exit Anyway
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Completion Dialog */}
      {showCompletionDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
          >
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
              Activity Completed! 🎉
            </h3>
            <p className="text-gray-600 text-center mb-6">
              Excellent work! You've completed the {requiredMinutes}-minute conversation challenge. You can continue chatting or return to activities.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowCompletionDialog(false)}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-medium"
              >
                Continue
              </button>
              <button
                onClick={() => navigate('/activities')}
                className="flex-1 px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors font-medium"
              >
                Back to Activities
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default ConversationChallengeActivity;

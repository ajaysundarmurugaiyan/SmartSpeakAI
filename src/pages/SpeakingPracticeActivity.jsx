import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2, VolumeX, AlertCircle, Clock, CheckCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import openAIService from '../services/openAIService';
import geminiService from '../services/geminiService';
import activityTracker from '../services/activityTracker';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase/config';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getDateKey, getMillisecondsUntilMidnight } from '../utils/dateUtils';

const REQUIRED_TIME_MS = 20 * 60 * 1000; // 20 minutes in milliseconds

const SpeakingPracticeActivity = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState('');
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const timerIntervalRef = useRef(null);
  const startTimeRef = useRef(Date.now());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  // Initialize Speech Recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onstart = () => {
        console.log('🎤 Speech recognition started');
        setError('');
      };

      recognitionRef.current.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        setCurrentTranscript(interimTranscript || finalTranscript);

        if (finalTranscript) {
          handleSpeechEnd(finalTranscript.trim());
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setError(`Error: ${event.error}`);
        setIsRecording(false);
      };

      recognitionRef.current.onend = () => {
        console.log('🎤 Speech recognition ended');
        setIsRecording(false);
      };
    } else {
      setError('Speech recognition not supported in this browser');
    }

    // Track activity
    if (currentUser) {
      activityTracker.logActivity('speaking_practice_started');
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, [currentUser]);

  const handleActivityCompletion = async () => {
    setIsCompleted(true);
    setShowCompletionDialog(true);
    
    // Save completion to Firebase
    if (currentUser) {
      try {
        const dateKey = getDateKey();
        const activityRef = doc(db, 'users', currentUser.uid, 'dailyActivities', `${dateKey}_daily-5`);
        
        await setDoc(activityRef, {
          activityId: 'daily-5',
          dateKey,
          completed: true,
          completedAt: serverTimestamp(),
          timeSpent: REQUIRED_TIME_MS,
          type: 'speaking'
        }, { merge: true });

        activityTracker.logActivity('speaking_practice_completed', { timeSpent: REQUIRED_TIME_MS });
      } catch (error) {
        console.error('Error saving completion:', error);
      }
    }
  };

  const handleMicClick = () => {
    if (!isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
  };

  const startRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
        setCurrentTranscript('');
      } catch (error) {
        console.error('Error starting recording:', error);
        setError('Failed to start recording');
      }
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const handleSpeechEnd = async (transcript) => {
    setCurrentTranscript('');
    const userMessage = { type: 'user', text: transcript };
    setMessages((prev) => [...prev, userMessage]);
    setIsProcessing(true);

    try {
      const result = await openAIService.getAIResponse(transcript, { mode: 'pronunciation' });
      const aiMessage = { type: 'ai', text: result.response };
      setMessages((prev) => [...prev, aiMessage]);
      
      // Speak the response
      speakText(result.response);
    } catch (error) {
      console.error('Error getting AI response:', error);
      try {
        const alt = await geminiService.getEnglishLearningResponse(transcript, 'pronunciation');
        const aiMessage = { type: 'ai', text: alt.response };
        setMessages((prev) => [...prev, aiMessage]);
        speakText(alt.response);
      } catch (e2) {
        console.error('Fallback model also failed:', e2);
        setMessages((prev) => [...prev, { 
          type: 'ai', 
          text: "I'm having trouble connecting right now. Please try again!" 
        }]);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const speakText = (text) => {
    if (synthRef.current) {
      synthRef.current.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      synthRef.current.speak(utterance);
    }
  };

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
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
                ? "Great job! You can continue practicing or go back to activities."
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
              Speaking Practice
            </h1>
            <p className="text-gray-500 text-sm">
              Practice your pronunciation and speaking skills with AI feedback
            </p>
            {error && (
              <div className="mt-3 flex items-center justify-center space-x-2 text-red-600 bg-red-50 px-4 py-2 rounded-lg">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">{error}</span>
              </div>
            )}
          </motion.div>

          {/* Main Content */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6 min-h-[500px] max-h-[600px] overflow-y-auto">

            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <p className="mb-2">🎤 AI is ready to start a conversation!</p>
                  <p className="text-sm">Click the microphone to begin...</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
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
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        <div className="flex items-start space-x-2">
                          {message.type === 'ai' && (
                            <Volume2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
                          )}
                          <p className="text-sm leading-relaxed">{message.text}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Current Transcript */}
            {currentTranscript && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 p-4 bg-emerald-50 rounded-lg border-2 border-emerald-200"
              >
                <p className="text-sm text-emerald-800 italic">
                  🎤 Listening: "{currentTranscript}"
                </p>
              </motion.div>
            )}

            {/* Processing Indicator */}
            {isProcessing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 flex justify-start"
              >
                <div className="px-4 py-3 rounded-2xl bg-gray-100">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </motion.div>
            )}

          </div>

          {/* Controls */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
            <div className="flex items-center justify-center space-x-4 mb-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleMicClick}
                disabled={isProcessing}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg ${
                  isRecording
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={isSpeaking ? stopSpeaking : null}
                disabled={!isSpeaking}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${
                  isSpeaking
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-200 text-gray-400'
                } disabled:cursor-not-allowed`}
              >
                {isSpeaking ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
              </motion.button>
            </div>

            <p className="text-center text-gray-500 text-sm">
              {isRecording ? '🎤 Listening... Speak now!' : 'Click the microphone to start speaking'}
            </p>
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
                Continue Practice
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
              Great job! You've completed the {requiredMinutes}-minute speaking practice. You can continue practicing or return to activities.
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

export default SpeakingPracticeActivity;

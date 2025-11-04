import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2, VolumeX, AlertCircle } from 'lucide-react';
import Navbar from '../components/Navbar';
import openAIService from '../services/openAIService';
import geminiService from '../services/geminiService';
import activityTracker from '../services/activityTracker';
import { useAuth } from '../contexts/AuthContext';

const Home = () => {
  const { currentUser } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // No auto-greeting. Wait for user's first speech to respond.
  }, []);

  useEffect(() => {
    // Initialize Speech Recognition
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
      activityTracker.logActivity('voice_practice_opened');
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

  const handleMicClick = () => {
    if (!isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
  };

  const startRecording = () => {
    if (!recognitionRef.current) {
      setError('Speech recognition not available');
      return;
    }

    try {
      setIsRecording(true);
      setCurrentTranscript('');
      setError('');
      recognitionRef.current.start();
      
      if (currentUser) {
        activityTracker.logActivity('voice_recording_started');
      }
    } catch (error) {
      console.error('Error starting recognition:', error);
      setError('Failed to start recording');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleSpeechEnd = async (transcript) => {
    if (!transcript || transcript.length < 2) return;

    console.log('📝 User said:', transcript);
    
    // Add user message
    setMessages(prev => [...prev, { type: 'user', text: transcript }]);
    setCurrentTranscript('');
    setIsProcessing(true);

    try {
      // Get AI response
      let result;
      try {
        result = await openAIService.getAIResponse(transcript, { mode: 'voice' });
      } catch (err) {
        // Fallback to Gemini on 429/quota
        if (err?.status === 429 || err?.code === 'insufficient_quota') {
          try {
            result = await geminiService.getEnglishLearningResponse(transcript, 'conversation');
            result = { response: result.response };
          } catch (e2) {
            throw err; // bubble up to outer catch
          }
        } else {
          throw err;
        }
      }

      // Add AI message
      setMessages(prev => [...prev, { type: 'ai', text: result.response }]);

      // Speak the response
      speakText(result.response);

      if (currentUser) {
        activityTracker.logActivity('voice_conversation', { userMessage: transcript });
      }
    } catch (error) {
      console.error('Error getting AI response:', error);
      const errorMessage = (error?.status === 429 || error?.code === 'insufficient_quota')
        ? 'The AI is rate-limited right now. Please try again in a minute.'
        : "I'm having trouble processing that. Please try again!";
      setMessages(prev => [...prev, { type: 'ai', text: errorMessage }]);
      speakText(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const speakText = (text) => {
    if (!synthRef.current) return;

    // Cancel any ongoing speech
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9; // Slightly slower for learning
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => {
      setIsSpeaking(true);
      console.log('🔊 AI speaking...');
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      console.log('🔊 AI finished speaking');
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      setIsSpeaking(false);
    };

    synthRef.current.speak(utterance);
  };

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="pt-24 pb-8 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">
              Voice Conversation Practice
            </h1>
            <p className="text-gray-500 text-sm">
              Have a natural conversation with AI - Answer questions and share your thoughts!
            </p>
            {error && (
              <div className="mt-3 flex items-center justify-center space-x-2 text-red-600 bg-red-50 px-4 py-2 rounded-lg">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">{error}</span>
              </div>
            )}
          </motion.div>

          {/* Chat Messages */}
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
                className="mt-4 p-4 bg-teal-50 rounded-lg border-2 border-teal-200"
              >
                <div className="flex items-center space-x-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-teal-600"></div>
                  <p className="text-sm text-teal-800">AI is thinking...</p>
                </div>
              </motion.div>
            )}

            {/* Speaking Indicator */}
            {isSpeaking && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 p-4 bg-green-50 rounded-lg border-2 border-green-200"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Volume2 className="w-5 h-5 text-green-600 animate-pulse" />
                    <p className="text-sm text-green-800">🔊 AI is speaking...</p>
                  </div>
                  <button
                    onClick={stopSpeaking}
                    className="px-3 py-1 bg-red-500 text-white rounded-lg text-xs hover:bg-red-600 transition-colors flex items-center space-x-1"
                  >
                    <VolumeX className="w-4 h-4" />
                    <span>Stop</span>
                  </button>
                </div>
              </motion.div>
            )}
          </div>

          {/* Microphone Button */}
          <div className="flex justify-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleMicClick}
              className={`relative w-16 h-16 rounded-full shadow-2xl transition-all duration-300 ${
                isRecording
                  ? 'bg-gradient-to-br from-red-500 to-pink-600'
                  : 'bg-gradient-to-br from-gray-900 to-gray-800'
              }`}
            >
              {isRecording ? (
                <MicOff className="w-8 h-8 text-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
              ) : (
                <Mic className="w-8 h-8 text-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
              )}

              {/* Pulse Animation */}
              {isRecording && (
                <>
                  <motion.div
                    animate={{
                      scale: [1, 1.5, 1],
                      opacity: [0.5, 0, 0.5],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                    className="absolute inset-0 rounded-full bg-red-400"
                  />
                  <motion.div
                    animate={{
                      scale: [1, 1.8, 1],
                      opacity: [0.3, 0, 0.3],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: 0.5,
                    }}
                    className="absolute inset-0 rounded-full bg-red-400"
                  />
                </>
              )}
            </motion.button>
          </div>

          <p className="text-center mt-4 text-gray-600 font-medium">
            {isRecording ? '🎤 Listening... Click to stop' : 
             isProcessing ? '⏳ Processing your speech...' :
             isSpeaking ? '🔊 AI is speaking...' :
             '🎙️ Click microphone to start speaking'}
          </p>
        </div>
      </div>
    </div>  
  );
};

export default Home;

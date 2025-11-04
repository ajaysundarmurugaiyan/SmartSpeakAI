import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Trash2, Bot, User } from 'lucide-react';
import Navbar from '../components/Navbar';
import openAIService from '../services/openAIService';
import geminiService from '../services/geminiService';
import activityTracker from '../services/activityTracker';
import { useAuth } from '../contexts/AuthContext';

const TextChat = () => {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState([
    {
      type: 'ai',
      text: "Hello! I'm your English learning assistant. Type a message and I'll help you improve your grammar and vocabulary. 😊",
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [grammarScore, setGrammarScore] = useState(0);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

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
      activityTracker.logActivity('text_message', { messageLength: messageText.length });
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="pt-24 pb-8 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-between items-center mb-6"
          >
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">
                Text Conversation
              </h1>
              <p className="text-gray-500 text-sm">Practice writing and get instant feedback</p>
            </div>
            <button
              onClick={handleClearChat}
              className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors shadow-sm text-sm font-medium"
            >
              <Trash2 className="w-5 h-5" />
              <span className="hidden sm:inline">Clear Chat</span>
            </button>
          </motion.div>

          {/* Chat Container */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            {/* Messages Area */}
            <div className="h-[600px] overflow-y-auto p-6 space-y-4">
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
                      className={`flex items-start space-x-3 max-w-[80%] ${
                        message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                      }`}
                    >
                      {/* Avatar */}
                      <div
                        className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                          message.type === 'user'
                            ? 'bg-gray-900'
                            : 'bg-gray-700'
                        }`}
                      >
                        {message.type === 'user' ? (
                          <User className="w-6 h-6 text-white" />
                        ) : (
                          <Bot className="w-6 h-6 text-white" />
                        )}
                      </div>

                      {/* Message Bubble */}
                      <div
                      className={`px-4 py-3 rounded-2xl ${
                        message.type === 'user'
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                      >
                        <p className="text-sm leading-relaxed">{message.text}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Typing Indicator */}
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-start space-x-3"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div className="bg-gray-100 px-4 py-3 rounded-2xl">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-100 p-4 bg-gray-50/50">
              <div className="flex items-end gap-3">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message here..."
                  className="flex-1 min-h-[44px] max-h-32 px-4 py-3 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none transition-all text-sm leading-relaxed bg-white"
                  rows="1"
                  style={{ lineHeight: '1.5' }}
                />
                <button
                  onClick={handleSend}
                  disabled={!inputText.trim()}
                  className="h-[44px] px-6 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shrink-0 shadow-md hover:shadow-lg font-medium"
                >
                  <Send className="w-5 h-5" />
                  <span className="hidden sm:inline text-sm">Send</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TextChat;

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, ArrowLeft, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import openAIService from '../services/openAIService';
import { db } from '../firebase/config';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getDateKey, getMillisecondsUntilMidnight } from '../utils/dateUtils';

const QuizPage = () => {
  const { activityId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [showResultPerQ, setShowResultPerQ] = useState({});
  const [completed, setCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [attemptCount, setAttemptCount] = useState(0);
  const [retestInProgress, setRetestInProgress] = useState(false);
  const [showCelebrate, setShowCelebrate] = useState(false);
  const [achievementTitle, setAchievementTitle] = useState('');
  const [showExitWarning, setShowExitWarning] = useState(false);

  const [dateKey, setDateKey] = useState(getDateKey());

  const activityTopic = useMemo(() => {
    // Support daily-1..4 IDs from dailyTasks
    if (!activityId) return 'General English';
    if (activityId === 'daily-1') return 'English Grammar';
    if (activityId === 'daily-2') return 'English Vocabulary';
    if (activityId === 'daily-3') return 'Reading Comprehension';
    if (activityId === 'daily-4') return 'English Idioms and Phrases';
    if (activityId === 'daily-5') return 'Speaking Practice (Listening & Pronunciation)';
    if (activityId === 'daily-6') return 'Daily Conversation Scenarios';
    // Also support descriptive ids
    if (activityId.includes('grammar')) return 'English Grammar';
    if (activityId.includes('vocab') || activityId.includes('vocabulary')) return 'English Vocabulary';
    if (activityId.includes('read')) return 'Reading Comprehension';
    if (activityId.includes('idiom') || activityId.includes('phrase')) return 'English Idioms and Phrases';
    if (activityId.includes('speaking')) return 'Speaking Practice (Listening & Pronunciation)';
    if (activityId.includes('conversation')) return 'Daily Conversation Scenarios';
    return 'General English';
  }, [activityId]);

  // Prevent browser back button until quiz is completed
  useEffect(() => {
    if (!completed) {
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
  }, [completed]);

  // Midnight refresh - reset activities at 12:00 AM
  useEffect(() => {
    const scheduleNextMidnightRefresh = () => {
      const msUntilMidnight = getMillisecondsUntilMidnight();
      const timeoutId = setTimeout(() => {
        // Update date key to new day
        setDateKey(getDateKey());
        // Reload the page to fetch new day's data
        window.location.reload();
      }, msUntilMidnight);
      return timeoutId;
    };

    const timeoutId = scheduleNextMidnightRefresh();
    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const loadOrCreateQuiz = async () => {
      setLoading(true);
      setError('');
      try {
        const quizRef = doc(db, 'users', currentUser.uid, 'dailyActivities', `${dateKey}_${activityId}`);
        const snap = await getDoc(quizRef);
        if (snap.exists()) {
          const data = snap.data();
          setQuestions(data.questions || []);
          let ac = data.attemptCount || 0;
          setCompleted(Boolean(data.completed));
          setRetestInProgress(Boolean(data.retestInProgress));
          // If no attempts yet for today, mark first attempt as started so UI shows 1/2
          if (ac === 0) {
            await setDoc(quizRef, { attemptCount: 1, attemptStartedAt: serverTimestamp() }, { merge: true });
            ac = 1;
          }
          // If a retest was locked from the activities page and not yet seeded, generate a new set now
          if (Boolean(data.retestInProgress) && !Boolean(data.retestSeeded)) {
            let generated;
            if (activityId === 'daily-1') {
              generated = await openAIService.generateGrammarQuiz();
            } else if (activityId === 'daily-2') {
              generated = await openAIService.generateVocabularyQuiz();
            } else if (activityId === 'daily-3') {
              generated = await openAIService.generateReadingComprehensionQuiz();
            } else if (activityId === 'daily-4') {
              generated = await openAIService.generateIdiomsQuiz();
            }
            
            await setDoc(quizRef, {
              questions: generated,
              retestSeeded: true,
              retestAt: serverTimestamp()
            }, { merge: true });
            setQuestions(generated);
            setSelectedAnswers({});
            setShowResultPerQ({});
            setCurrentIndex(0);
            setCompleted(false);
            setScore(0);
            setRetestInProgress(true);
          }
          setAttemptCount(ac);
          // If limit reached and not in an active retest, block entry
          if (ac >= 2 && !data.retestInProgress) {
            navigate('/activities');
            return;
          }
        } else {
          // Generate quiz based on activity type
          let generated;
          if (activityId === 'daily-1') {
            generated = await openAIService.generateGrammarQuiz();
          } else if (activityId === 'daily-2') {
            generated = await openAIService.generateVocabularyQuiz();
          } else if (activityId === 'daily-3') {
            generated = await openAIService.generateReadingComprehensionQuiz();
          } else if (activityId === 'daily-4') {
            generated = await openAIService.generateIdiomsQuiz();
          }
          
          await setDoc(quizRef, {
            activityId,
            dateKey,
            topic: activityTopic,
            questions: generated,
            attemptCount: 1, // immediately count first attempt
            attempts: [],
            completed: false,
            retestInProgress: false,
            createdAt: serverTimestamp()
          });
          setQuestions(generated);
          setAttemptCount(1);
          setRetestInProgress(false);
        }
      } catch (e) {
        console.error('Error loading quiz:', e);
        setError('Failed to load quiz. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    loadOrCreateQuiz();
  }, [currentUser, activityId, dateKey]);

  const handleSelect = (qIndex, optionIndex) => {
    // Allow select only once per question
    if (selectedAnswers[qIndex] !== undefined) return;
    const newSelected = { ...selectedAnswers, [qIndex]: optionIndex };
    setSelectedAnswers(newSelected);
    // Show immediate feedback
    const isCorrect = questions[qIndex]?.correctIndex === optionIndex;
    setShowResultPerQ(prev => ({ ...prev, [qIndex]: isCorrect ? 'correct' : 'wrong' }));
  };

  const handleNext = () => {
    setCurrentIndex(i => Math.min(i + 1, questions.length - 1));
  };

  const handlePrev = () => {
    setCurrentIndex(i => Math.max(i - 1, 0));
  };

  const handleBackClick = () => {
    if (!completed) {
      setShowExitWarning(true);
    } else {
      navigate('/activities');
    }
  };

  const handleConfirmExit = () => {
    setShowExitWarning(false);
    navigate('/activities');
  };

  const handleCancelExit = () => {
    setShowExitWarning(false);
  };

  const handleFinish = async () => {
    // Calculate score
    const total = questions.length;
    const correct = questions.reduce((acc, q, idx) => acc + (selectedAnswers[idx] === q.correctIndex ? 1 : 0), 0);
    const percent = Math.round((correct / total) * 100);
    setScore(percent);
    setCompleted(true);

    if (!currentUser) return;
    try {
      const quizRef = doc(db, 'users', currentUser.uid, 'dailyActivities', `${dateKey}_${activityId}`);
      const snap = await getDoc(quizRef);
      const data = snap.exists() ? snap.data() : {};
      // Keep attemptCount as-is for first finish (already 1 from entry)
      // If retest was in progress, finalize as 2 attempts total
      const newAttemptCount = data.retestInProgress ? 2 : Math.max(1, data.attemptCount || 1);
      const attempts = data.attempts || [];
      attempts.push({ score: percent, completedAt: serverTimestamp() });
      // Explicit fields for admin display
      const nextFields = {};
      if (data.retestInProgress) {
        nextFields.attempt2Score = percent;
      } else if (!Array.isArray(data.attempts) || data.attempts.length === 0) {
        nextFields.attempt1Score = percent;
      } else if ((data.attempts || []).length === 1) {
        nextFields.attempt2Score = percent; // fallback if second write without retest flag
      }

      await setDoc(quizRef, {
        ...data,
        attemptCount: newAttemptCount,
        attempts,
        // Mark completed only after second attempt
        completed: newAttemptCount >= 2,
        lastCompletedAt: serverTimestamp(),
        retestInProgress: false,
        ...nextFields
      }, { merge: true });
      setAttemptCount(newAttemptCount);
      setRetestInProgress(false);
      // When completed (after 2 attempts), open celebration overlay with claim option
      if (newAttemptCount >= 2) {
        const titleMap = {
          'daily-1': 'Grammar Mastery',
          'daily-2': 'Vocabulary Pro',
          'daily-3': 'Reading Champ',
          'daily-4': 'Idioms & Phrases Star'
        };
        const title = titleMap[activityId] || `${activityTopic} Completed`;
        setAchievementTitle(title);
        setShowCelebrate(true);
      }
      // If limit reached after finishing retest, navigate back to activities
      // Note: Delay navigation to allow claim experience
    } catch (e) {
      console.error('Error saving results:', e);
    }
  };

  // No badges/claim flow required per request

  const handleRetest = async () => {
    if (!currentUser) return;
    // Re-check server state to enforce limit strictly
    try {
      const quizRef = doc(db, 'users', currentUser.uid, 'dailyActivities', `${dateKey}_${activityId}`);
      const snap = await getDoc(quizRef);
      const data = snap.exists() ? snap.data() : {};
      const serverAttemptCount = data.attemptCount || 0;
      const serverRetestInProgress = Boolean(data.retestInProgress);
      if (serverAttemptCount >= 2 || serverRetestInProgress) {
        setAttemptCount(serverAttemptCount);
        setRetestInProgress(serverRetestInProgress);
        setError('You have reached the daily limit. Try again tomorrow.');
        return;
      }
      // Lock retest and increment to show 2/2 immediately
      await setDoc(quizRef, { retestInProgress: true, attemptCount: 2, completed: false, retestStartedAt: serverTimestamp() }, { merge: true });
      setRetestInProgress(true);
      setAttemptCount(2);
    } catch (e) {
      console.error('Error checking/locking retest:', e);
      setError('Could not start retest. Please try again.');
      setError('You have reached the daily limit. Try again tomorrow.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Generate new, non-repeating questions by prompting for different variations
      const usedQuestions = questions.map(q => q.question);
      const isReading = (activityTopic || '').toLowerCase().includes('reading');
      const generated = await geminiService.generateQuizQuestions(activityTopic, isReading ? 15 : 18, usedQuestions);
      const quizRef = doc(db, 'users', currentUser.uid, 'dailyActivities', `${dateKey}_${activityId}`);
      await setDoc(quizRef, {
        questions: generated,
        retestAt: serverTimestamp()
      }, { merge: true });
      setQuestions(generated);
      setSelectedAnswers({});
      setShowResultPerQ({});
      setCurrentIndex(0);
      setCompleted(false);
      setScore(0);
    } catch (e) {
      console.error('Error starting retest:', e);
      setError('Could not start retest. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <div className="text-gray-600">Loading quiz…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-6 text-center">
          <div className="text-red-600 mb-4">{error}</div>
          <button
            onClick={() => navigate('/activities')}
            className="px-6 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all font-medium"
          >
            Back to Activities
          </button>
        </div>
      </div>
    );
  }

  const q = questions[currentIndex];
  const selected = selectedAnswers[currentIndex];
  const feedback = showResultPerQ[currentIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Back Button */}
      <div className="fixed top-4 left-4 z-10">
        <button
          onClick={handleBackClick}
          className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-md hover:shadow-lg transition-all border border-gray-200 hover:bg-gray-50"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
          <span className="text-gray-700 font-medium">Back</span>
        </button>
      </div>

      <div className="pt-20 pb-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">{activityTopic} Quiz</h1>
              <p className="text-gray-500 text-sm">Question {currentIndex + 1} of {questions.length}</p>
            </div>
            <div className="text-sm text-gray-500">Attempts today: {attemptCount}/2</div>
          </div>

          {/* Passage (Reading Comprehension) */}
          {q.passage && (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Reading Passage</h3>
              <p className="text-gray-700 whitespace-pre-line leading-relaxed">{q.passage}</p>
            </div>
          )}

          {/* Question */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">{q.question}</h3>
            <div className="space-y-3">
              {q.options.map((opt, idx) => {
                const isSelected = selected === idx;
                const isCorrect = q.correctIndex === idx;
                const showState = isSelected && feedback;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSelect(currentIndex, idx)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? feedback === 'correct'
                          ? 'border-green-500 bg-green-50'
                          : 'border-red-500 bg-red-50'
                        : 'border-gray-200 hover:border-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-gray-900">{opt}</span>
                      {showState && (
                        <span className={`text-sm font-semibold ${feedback === 'correct' ? 'text-green-600' : 'text-red-600'}`}>
                          {feedback === 'correct' ? '✓ Correct' : '✗ Wrong'}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mb-6">
            <button onClick={handlePrev} disabled={currentIndex === 0} className="px-4 py-2 text-gray-700 disabled:opacity-50 hover:text-gray-900 transition-colors">Previous</button>
            <div className="flex items-center space-x-2 text-gray-500 text-sm">
              <span>{currentIndex + 1}</span>
              <span>/</span>
              <span>{questions.length}</span>
            </div>
            {currentIndex < questions.length - 1 ? (
              <button onClick={handleNext} className="px-6 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all shadow-md hover:shadow-lg font-medium">Next</button>
            ) : (
              <button onClick={handleFinish} className="px-6 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all shadow-md hover:shadow-lg font-medium">Finish</button>
            )}
          </div>

          {/* Results */}
          {completed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Your Score: {score}%</h3>
              <p className="text-gray-600 mb-4">{score >= 70 ? 'Great job! ✅' : 'Keep practicing! 💪'}</p>
              <div className="flex flex-wrap gap-3">
                <button onClick={() => navigate('/activities')} className="px-6 py-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors text-sm font-medium">Back to Activities</button>
                <button onClick={handleRetest} disabled={attemptCount >= 2 || retestInProgress} className="px-6 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all disabled:opacity-50 shadow-md hover:shadow-lg font-medium">
                  Retake Quiz (once/day)
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Simple Greeting Card */}
      {showCelebrate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <motion.div
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-gray-100 p-6"
          >
            <div className="mx-auto w-14 h-14 rounded-full bg-gray-900 text-white flex items-center justify-center shadow mb-3">
              <Trophy className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center">Congratulations!</h3>
            <p className="text-gray-600 text-center mt-1">You completed today’s task.</p>
            <div className="mt-2 text-center text-sm font-medium text-gray-800">{achievementTitle || 'Daily Achievement'}</div>

            <div className="mt-5 flex items-center justify-center gap-2">
              <button
                onClick={() => { setShowCelebrate(false); navigate('/activities'); }}
                className="px-5 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all text-sm font-medium"
              >
                Continue
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Exit Warning Modal */}
      <AnimatePresence>
        {showExitWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            >
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-yellow-100 rounded-full">
                <AlertCircle className="w-8 h-8 text-yellow-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Leave Quiz?</h3>
              <p className="text-gray-600 text-center mb-6">
                Your progress will not be saved. You'll need to restart the quiz from the beginning.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleCancelExit}
                  className="flex-1 px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all font-medium"
                >
                  Continue Quiz
                </button>
                <button
                  onClick={handleConfirmExit}
                  className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-all font-medium"
                >
                  Leave
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default QuizPage;



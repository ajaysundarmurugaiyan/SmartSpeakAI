import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, XCircle, RotateCcw, Trophy, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import activityTracker from '../services/activityTracker';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

const QuizModal = ({ quiz, onClose, onComplete }) => {
  const { currentUser } = useAuth();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const [quizStartTime] = useState(Date.now());
  const [previousAttempts, setPreviousAttempts] = useState([]);

  useEffect(() => {
    loadPreviousAttempts();
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleFinishQuiz();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const loadPreviousAttempts = async () => {
    if (!currentUser) return;

    try {
      const attemptRef = doc(db, 'users', currentUser.uid, 'quizAttempts', quiz.id);
      const attemptDoc = await getDoc(attemptRef);

      if (attemptDoc.exists()) {
        const data = attemptDoc.data();
        setPreviousAttempts(data.attempts || []);
      }
    } catch (error) {
      console.error('Error loading previous attempts:', error);
    }
  };

  const handleAnswerSelect = (answerIndex) => {
    setSelectedAnswer(answerIndex);
  };

  const handleNextQuestion = () => {
    const isCorrect = selectedAnswer === quiz.questions[currentQuestion].correctAnswer;
    
    setAnswers([...answers, {
      questionId: quiz.questions[currentQuestion].id,
      selectedAnswer,
      isCorrect,
      question: quiz.questions[currentQuestion].question
    }]);

    if (currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
    } else {
      handleFinishQuiz();
    }
  };

  const handleFinishQuiz = () => {
    const finalAnswers = [...answers];
    if (selectedAnswer !== null && currentQuestion < quiz.questions.length) {
      const isCorrect = selectedAnswer === quiz.questions[currentQuestion].correctAnswer;
      finalAnswers.push({
        questionId: quiz.questions[currentQuestion].id,
        selectedAnswer,
        isCorrect,
        question: quiz.questions[currentQuestion].question
      });
    }

    const correctCount = finalAnswers.filter(a => a.isCorrect).length;
    const totalQuestions = quiz.questions.length;
    const finalScore = Math.round((correctCount / totalQuestions) * 100);
    
    setScore(finalScore);
    setShowResult(true);
    saveQuizResult(finalScore, finalAnswers);
  };

  const saveQuizResult = async (finalScore, finalAnswers) => {
    if (!currentUser) return;

    try {
      const timeTaken = Math.floor((Date.now() - quizStartTime) / 1000);
      const attemptData = {
        score: finalScore,
        totalQuestions: quiz.questions.length,
        correctAnswers: finalAnswers.filter(a => a.isCorrect).length,
        timeTaken,
        completedAt: new Date().toISOString()
      };

      // Save to user's quiz attempts
      const attemptRef = doc(db, 'users', currentUser.uid, 'quizAttempts', quiz.id);
      const attemptDoc = await getDoc(attemptRef);

      const attempts = attemptDoc.exists() ? attemptDoc.data().attempts || [] : [];
      attempts.push(attemptData);

      await setDoc(attemptRef, {
        quizId: quiz.id,
        quizTitle: quiz.title,
        attempts,
        bestScore: Math.max(...attempts.map(a => a.score)),
        lastAttempt: serverTimestamp(),
        totalAttempts: attempts.length
      }, { merge: true });

      // Track activity
      await activityTracker.completLesson(currentUser.uid, quiz.id, finalScore);

      console.log('✅ Quiz result saved:', finalScore);
    } catch (error) {
      console.error('Error saving quiz result:', error);
    }
  };

  const handleRetake = () => {
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setAnswers([]);
    setShowResult(false);
    setScore(0);
    setTimeLeft(300);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreMessage = (score) => {
    if (score >= 90) return 'Excellent! Outstanding performance! 🎉';
    if (score >= 80) return 'Great job! You did very well! 👏';
    if (score >= 70) return 'Good work! Keep practicing! 💪';
    if (score >= 60) return 'Not bad! Room for improvement! 📚';
    return 'Keep trying! Practice makes perfect! 🌟';
  };

  if (showResult) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        >
          <div className="p-8">
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-3xl font-bold text-gray-800 mb-2">Quiz Complete!</h2>
                <p className="text-gray-600">{quiz.title}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Score Display */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-8 mb-6 text-center">
              <Trophy className={`w-20 h-20 mx-auto mb-4 ${getScoreColor(score)}`} />
              <h3 className="text-5xl font-bold mb-2">
                <span className={getScoreColor(score)}>{score}%</span>
              </h3>
              <p className="text-xl text-gray-700 mb-2">{getScoreMessage(score)}</p>
              <p className="text-gray-600">
                {answers.filter(a => a.isCorrect).length} out of {quiz.questions.length} correct
              </p>
            </div>

            {/* Previous Attempts */}
            {previousAttempts.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold text-gray-800 mb-3">Previous Attempts:</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {previousAttempts.slice(-4).map((attempt, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-blue-600">{attempt.score}%</p>
                      <p className="text-xs text-gray-500">
                        {new Date(attempt.completedAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Answer Review */}
            <div className="mb-6">
              <h4 className="font-semibold text-gray-800 mb-3">Review Your Answers:</h4>
              <div className="space-y-3">
                {answers.map((answer, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border-2 ${
                      answer.isCorrect
                        ? 'border-green-200 bg-green-50'
                        : 'border-red-200 bg-red-50'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      {answer.isCorrect ? (
                        <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                      ) : (
                        <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-gray-800 mb-1">
                          Q{index + 1}: {answer.question}
                        </p>
                        {!answer.isCorrect && (
                          <p className="text-sm text-gray-600">
                            {quiz.questions[index].explanation}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleRetake}
                className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-all"
              >
                <RotateCcw className="w-5 h-5" />
                <span>Retake Quiz</span>
              </button>
              <button
                onClick={() => {
                  onComplete(score);
                  onClose();
                }}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  const question = quiz.questions[currentQuestion];
  const progress = ((currentQuestion + 1) / quiz.questions.length) * 100;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full"
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">{quiz.title}</h2>
              <p className="text-sm text-gray-600">
                Question {currentQuestion + 1} of {quiz.questions.length}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-gray-600">
                <Clock className="w-5 h-5" />
                <span className="font-mono font-semibold">{formatTime(timeLeft)}</span>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Question */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-800 mb-6">{question.question}</h3>

            <div className="space-y-3">
              {question.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(index)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    selectedAnswer === index
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        selectedAnswer === index
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-gray-300'
                      }`}
                    >
                      {selectedAnswer === index && (
                        <div className="w-3 h-3 bg-white rounded-full" />
                      )}
                    </div>
                    <span className="text-gray-800">{option}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center">
            <button
              onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
              disabled={currentQuestion === 0}
              className="px-6 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={handleNextQuestion}
              disabled={selectedAnswer === null}
              className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {currentQuestion === quiz.questions.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default QuizModal;

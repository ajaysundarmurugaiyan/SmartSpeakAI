import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Check, X, RotateCcw, ArrowLeft } from 'lucide-react';
import Navbar from '../components/Navbar';
import { useAuth } from '../contexts/AuthContext';

const TOPICS = [
  'Tenses', 'Articles', 'Prepositions', 'Subject-Verb Agreement', 'Modals',
  'Conditionals', 'Active and Passive Voice', 'Reported Speech', 'Punctuation',
  'Vocabulary', 'Idioms and Phrases', 'Sentence Correction',
];
const QUIZ_SIZE = 10;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const PracticeExam = () => {
  const { isPremium } = useAuth();
  const navigate = useNavigate();
  const [topic, setTopic] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [finished, setFinished] = useState(false);

  const startTopic = async (t) => {
    setLoading(true);
    setError('');
    try {
      const file = '/questions/bank_' + t.replace(/ /g, '_') + '.json';
      const res = await fetch(file);
      if (!res.ok) throw new Error('No questions available for this topic yet.');
      const all = await res.json();
      const quiz = shuffle(all).slice(0, QUIZ_SIZE);
      setTopic(t);
      setQuestions(quiz);
      setIdx(0);
      setSelected(null);
      setScore(0);
      setFinished(false);
    } catch (e) {
      setError(e.message || 'Failed to load questions.');
    } finally {
      setLoading(false);
    }
  };

  const choose = (i) => {
    if (selected !== null) return;
    setSelected(i);
    if (i === questions[idx].correctIndex) setScore((s) => s + 1);
  };

  const next = () => {
    if (idx + 1 >= questions.length) {
      setFinished(true);
      return;
    }
    setIdx(idx + 1);
    setSelected(null);
  };

  const reset = () => {
    setTopic(null);
    setQuestions([]);
    setFinished(false);
    setError('');
  };

  // ---- Premium gate (hidden from free + trial users) ----
  if (!isPremium) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="pt-24 px-4">
          <div className="max-w-lg mx-auto text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-4">
              <Crown className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Practice Exam — Premium only</h1>
            <p className="text-gray-500 mb-6">
              Topic-wise practice exams with instant answers and explanations are a Premium feature.
            </p>
            <button onClick={() => navigate('/pricing')}
              className="px-6 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors">
              Go Premium
            </button>
          </div>
        </div>
      </div>
    );
  }

  const q = topic && !finished && questions.length > 0 ? questions[idx] : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="pt-24 pb-10 px-4">
        <div className="max-w-2xl mx-auto">

          {/* Topic picker */}
          {!topic && (
            <>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">Practice Exam</h1>
              <p className="text-gray-500 text-sm mb-6">
                Pick a topic — {QUIZ_SIZE} shuffled questions with answers &amp; explanations.
              </p>
              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-xl text-sm">{error}</div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {TOPICS.map((t) => (
                  <button key={t} onClick={() => startTopic(t)} disabled={loading}
                    className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md text-sm font-medium text-gray-800 text-left transition-all disabled:opacity-50">
                    {t}
                  </button>
                ))}
              </div>
              {loading && <div className="text-center text-gray-500 py-6">Loading questions…</div>}
            </>
          )}

          {/* Quiz */}
          {q && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <button onClick={reset} className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1">
                  <ArrowLeft className="w-4 h-4" /> Topics
                </button>
                <span className="text-sm font-medium text-gray-500">{topic} · {idx + 1}/{questions.length}</span>
              </div>
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                <p className="text-lg font-semibold text-gray-900 mb-5">{q.question}</p>
                <div className="space-y-2">
                  {q.options.map((opt, i) => {
                    let cls = 'border-gray-200 hover:bg-gray-50';
                    if (selected !== null) {
                      if (i === q.correctIndex) cls = 'border-green-400 bg-green-50';
                      else if (i === selected) cls = 'border-red-400 bg-red-50';
                      else cls = 'border-gray-200 opacity-60';
                    }
                    return (
                      <button key={i} onClick={() => choose(i)}
                        className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all flex items-center justify-between ${cls}`}>
                        <span className="text-sm text-gray-800">{opt}</span>
                        {selected !== null && i === q.correctIndex && <Check className="w-5 h-5 text-green-600 flex-shrink-0" />}
                        {selected !== null && i === selected && i !== q.correctIndex && <X className="w-5 h-5 text-red-600 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                {selected !== null && (
                  <div className="mt-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
                    <p className="text-sm text-gray-700"><b>Explanation:</b> {q.explanation}</p>
                  </div>
                )}
                {selected !== null && (
                  <button onClick={next}
                    className="w-full mt-4 bg-gray-900 text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition-colors">
                    {idx + 1 >= questions.length ? 'Finish' : 'Next question'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Result */}
          {finished && (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Your score</h2>
              <p className="text-5xl font-bold text-emerald-600 my-4">{score}/{questions.length}</p>
              <p className="text-gray-500 mb-6">{Math.round((score / questions.length) * 100)}% on {topic}</p>
              <div className="flex gap-3 justify-center flex-wrap">
                <button onClick={() => startTopic(topic)}
                  className="px-5 py-2.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" /> Retry
                </button>
                <button onClick={reset}
                  className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200">
                  Another topic
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default PracticeExam;

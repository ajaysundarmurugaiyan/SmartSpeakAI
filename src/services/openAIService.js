// Minimal OpenAI Chat adapter for frontend use.
// NOTE: For production, proxy this call through your backend to keep the API key private.

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini';

function buildSystemPrompt(mode = 'conversation') {
  return [
    'You are an expert English tutor and friendly AI conversation partner.',
    'Goals: hold natural conversation, correct grammar subtly, encourage.',
    'Style: concise, human-like, supportive; avoid long paragraphs; ask short follow-ups.',
    mode === 'voice' ? 'Optimize for being read aloud: short sentences, clear phrasing.' : '',
  ].filter(Boolean).join(' ');
}

async function getAIResponse(userText, { mode = 'conversation', contextMessages = [] } = {}) {
  if (!OPENAI_API_KEY) {
    throw new Error('Missing VITE_OPENAI_API_KEY');
  }

  const messages = [
    { role: 'system', content: buildSystemPrompt(mode) },
    ...contextMessages.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userText }
  ];

  const res = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    let err;
    try {
      err = await res.json();
    } catch (_) {
      err = null;
    }
    const apiMsg = err?.error?.message || '';
    const apiCode = err?.error?.code || '';
    const e = new Error(apiMsg || `OpenAI error ${res.status}`);
    e.status = res.status;
    e.code = apiCode;
    throw e;
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content?.trim() || "";
  return { response: content };
}

// Generate Grammar Quiz
async function generateGrammarQuiz() {
  if (!OPENAI_API_KEY) {
    throw new Error('Missing VITE_OPENAI_API_KEY');
  }

  const prompt = `Generate 5 English grammar multiple-choice questions. 
  
  Topics to cover: tenses, subject-verb agreement, articles, prepositions, conditionals.
  
  Return ONLY a valid JSON array with this exact structure:
  [
    {
      "question": "Question text here",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Brief explanation of the correct answer"
    }
  ]
  
  Make questions practical and relevant to everyday English usage.`;

  const res = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: 'You are an expert English grammar teacher. Generate clear, educational quiz questions.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
    }),
  });

  if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
  
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content?.trim() || "";
  
  // Extract JSON from response
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Invalid response format');
  
  return JSON.parse(jsonMatch[0]);
}

// Generate Vocabulary Quiz
async function generateVocabularyQuiz() {
  if (!OPENAI_API_KEY) {
    throw new Error('Missing VITE_OPENAI_API_KEY');
  }

  const prompt = `Generate 5 English vocabulary multiple-choice questions.
  
  Focus on: word meanings, synonyms, antonyms, word usage in context.
  Use intermediate to advanced vocabulary words.
  
  Return ONLY a valid JSON array with this exact structure:
  [
    {
      "question": "What does 'ubiquitous' mean?",
      "options": ["Rare", "Everywhere", "Hidden", "Ancient"],
      "correctIndex": 1,
      "explanation": "Ubiquitous means present everywhere or very common"
    }
  ]
  
  Make questions engaging and educational.`;

  const res = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: 'You are an expert English vocabulary teacher. Generate clear, educational quiz questions.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
    }),
  });

  if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
  
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content?.trim() || "";
  
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Invalid response format');
  
  return JSON.parse(jsonMatch[0]);
}

// Generate Reading Comprehension Quiz
async function generateReadingComprehensionQuiz() {
  if (!OPENAI_API_KEY) {
    throw new Error('Missing VITE_OPENAI_API_KEY');
  }

  const prompt = `Generate a reading comprehension exercise with 1 passage and 5 questions.
  
  Create an interesting passage (150-200 words) on a general topic (science, history, culture, technology, etc.).
  Then create 5 multiple-choice questions based on the passage.
  
  Return ONLY a valid JSON array with this exact structure:
  [
    {
      "passage": "Full passage text here...",
      "question": "Question about the passage",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Brief explanation"
    }
  ]
  
  All 5 questions should have the SAME passage text.
  Make questions test comprehension, inference, and vocabulary from the passage.`;

  const res = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: 'You are an expert English reading comprehension teacher. Generate engaging passages and thoughtful questions.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
    }),
  });

  if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
  
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content?.trim() || "";
  
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Invalid response format');
  
  return JSON.parse(jsonMatch[0]);
}

// Generate Idioms and Phrases Quiz
async function generateIdiomsQuiz() {
  if (!OPENAI_API_KEY) {
    throw new Error('Missing VITE_OPENAI_API_KEY');
  }

  const prompt = `Generate 5 English idioms and phrases multiple-choice questions.
  
  Focus on: common idioms, phrasal verbs, expressions, their meanings and usage.
  
  Return ONLY a valid JSON array with this exact structure:
  [
    {
      "question": "What does 'break the ice' mean?",
      "options": ["To start a conversation", "To break something", "To be cold", "To leave early"],
      "correctIndex": 0,
      "explanation": "Break the ice means to initiate conversation in a social setting"
    }
  ]
  
  Use commonly used idioms and phrases that are practical for learners.`;

  const res = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: 'You are an expert English idioms and phrases teacher. Generate clear, practical quiz questions.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
    }),
  });

  if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
  
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content?.trim() || "";
  
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Invalid response format');
  
  return JSON.parse(jsonMatch[0]);
}

export default { 
  getAIResponse,
  generateGrammarQuiz,
  generateVocabularyQuiz,
  generateReadingComprehensionQuiz,
  generateIdiomsQuiz
};



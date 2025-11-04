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

  const timestamp = Date.now();
  const prompt = `Generate 10 UNIQUE English grammar multiple-choice questions. 
  
  IMPORTANT: Create completely NEW and DIFFERENT questions each time. Avoid repeating common examples.
  Generation ID: ${timestamp}
  
  Topics to cover: tenses, subject-verb agreement, articles, prepositions, conditionals, modals, passive voice, reported speech.
  
  Return ONLY a valid JSON array with this exact structure:
  [
    {
      "question": "Question text here",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Brief explanation of the correct answer"
    }
  ]
  
  Make questions practical, varied, and relevant to everyday English usage. Use different sentence structures and contexts.`;

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
      temperature: 0.9,
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

  const timestamp = Date.now();
  const prompt = `Generate 10 UNIQUE English vocabulary multiple-choice questions.
  
  IMPORTANT: Create completely NEW and DIFFERENT vocabulary words each time. Avoid repeating common words.
  Generation ID: ${timestamp}
  
  Focus on: word meanings, synonyms, antonyms, word usage in context, collocations.
  Use intermediate to advanced vocabulary words from diverse topics (business, science, arts, daily life).
  
  Return ONLY a valid JSON array with this exact structure:
  [
    {
      "question": "What does 'ubiquitous' mean?",
      "options": ["Rare", "Everywhere", "Hidden", "Ancient"],
      "correctIndex": 1,
      "explanation": "Ubiquitous means present everywhere or very common"
    }
  ]
  
  Make questions engaging, varied, and educational. Use different question formats.`;

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
      temperature: 0.9,
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

  const timestamp = Date.now();
  const topics = ['science', 'history', 'culture', 'technology', 'environment', 'health', 'business', 'arts', 'sports', 'travel'];
  const randomTopic = topics[Math.floor(Math.random() * topics.length)];
  
  const prompt = `Generate a reading comprehension exercise with 1 UNIQUE passage and 10 questions.
  
  IMPORTANT: Create a completely NEW and DIFFERENT passage each time. Avoid repeating topics or content.
  Generation ID: ${timestamp}
  Suggested topic area: ${randomTopic}
  
  Create an interesting passage (200-300 words) on a fresh topic related to ${randomTopic} or similar areas.
  Then create 10 multiple-choice questions based on the passage.
  
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
  
  All 10 questions should have the SAME passage text.
  Make questions test comprehension, inference, vocabulary, and main ideas from the passage.`;

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
      temperature: 0.9,
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

  const timestamp = Date.now();
  const prompt = `Generate 10 UNIQUE English idioms and phrases multiple-choice questions.
  
  IMPORTANT: Create completely NEW and DIFFERENT idioms/phrases each time. Avoid repeating common examples like 'break the ice' or 'piece of cake'.
  Generation ID: ${timestamp}
  
  Focus on: common idioms, phrasal verbs, expressions, their meanings and usage.
  Include variety: business idioms, casual expressions, phrasal verbs, and colorful phrases.
  
  Return ONLY a valid JSON array with this exact structure:
  [
    {
      "question": "What does 'break the ice' mean?",
      "options": ["To start a conversation", "To break something", "To be cold", "To leave early"],
      "correctIndex": 0,
      "explanation": "Break the ice means to initiate conversation in a social setting"
    }
  ]
  
  Use commonly used but VARIED idioms and phrases that are practical for learners. Mix different types and contexts.`;

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
      temperature: 0.9,
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



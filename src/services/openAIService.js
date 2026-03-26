// Minimal OpenAI Chat adapter for frontend use.
// NOTE: For production, proxy this call through your backend to keep the API key private.

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const IS_GROQ_KEY = typeof OPENAI_API_KEY === 'string' && OPENAI_API_KEY.startsWith('gsk_');
const OPENAI_API_URL = import.meta.env.VITE_OPENAI_API_URL
  || (IS_GROQ_KEY
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions');
const DEFAULT_MODEL = import.meta.env.VITE_OPENAI_MODEL
  || (IS_GROQ_KEY ? 'llama-3.1-8b-instant' : 'gpt-4o-mini');

function getDifficultyInstruction(level = 'Beginner') {
  const normalized = String(level || 'Beginner').toLowerCase();
  if (normalized.includes('advanced')) {
    return 'Difficulty: Advanced. Use nuanced vocabulary and harder distractors.';
  }
  if (normalized.includes('intermediate')) {
    return 'Difficulty: Intermediate. Use common-to-mid vocabulary and moderate grammar complexity.';
  }
  return 'Difficulty: Beginner. Use simple words, short sentences, and very clear answer options.';
}

function buildSystemPrompt(mode = 'conversation') {
  return [
    'You are an expert English tutor and friendly AI conversation partner.',
    'Goals: hold natural conversation, correct grammar subtly, encourage.',
    'Style: concise, human-like, supportive; avoid long paragraphs; ask short follow-ups.',
    mode === 'voice' ? 'Optimize for being read aloud: short sentences, clear phrasing.' : '',
  ].filter(Boolean).join(' ');
}

function extractQuizArrayFromParsedJSON(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== 'object') return null;

  const directKeys = ['questions', 'quiz', 'quizzes', 'items', 'data', 'result'];
  for (const key of directKeys) {
    if (Array.isArray(parsed[key])) return parsed[key];
  }

  // Handle shape like { passage: "...", questions: [{...}] }
  if (parsed.passage && Array.isArray(parsed.questions)) {
    return parsed.questions.map((q) => ({ passage: parsed.passage, ...q }));
  }

  return null;
}

function extractBalancedJSONArrayCandidates(input) {
  const candidates = [];
  let inString = false;
  let quote = '';
  let escape = false;
  let depth = 0;
  let start = -1;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (inString) {
      if (ch === '\\') {
        escape = true;
      } else if (ch === quote) {
        inString = false;
        quote = '';
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      continue;
    }

    if (ch === '[') {
      if (depth === 0) start = i;
      depth += 1;
      continue;
    }

    if (ch === ']') {
      if (depth > 0) depth -= 1;
      if (depth === 0 && start >= 0) {
        candidates.push(input.slice(start, i + 1));
        start = -1;
      }
    }
  }

  return candidates;
}

function parseJSONArrayFromModelContent(content) {
  const cleaned = String(content || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  // First: try parsing entire payload as JSON.
  try {
    const parsed = JSON.parse(cleaned);
    const extracted = extractQuizArrayFromParsedJSON(parsed);
    if (Array.isArray(extracted)) return extracted;
  } catch (_) {
    // Fallback below.
  }

  // Fallback: find balanced JSON arrays in text and choose a likely quiz array.
  const candidates = extractBalancedJSONArrayCandidates(cleaned);
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (!Array.isArray(parsed)) continue;
      // Prefer arrays of objects (quiz questions), not arrays of strings (options).
      const hasObject = parsed.some((item) => item && typeof item === 'object' && !Array.isArray(item));
      if (hasObject) return parsed;
    } catch (_) {
      // Try next candidate.
    }
  }

  // Last fallback: return first parseable array candidate.
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {
      // Ignore and continue.
    }
  }

  throw new Error('Invalid quiz response format: JSON array not found');
}

async function parseApiError(res, prefix = 'OpenAI error') {
  let err;
  try {
    err = await res.json();
  } catch (_) {
    err = null;
  }
  const apiMsg = err?.error?.message || '';
  const apiCode = err?.error?.code || '';
  const e = new Error(apiMsg || `${prefix} ${res.status}`);
  e.status = res.status;
  e.code = apiCode;
  throw e;
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

  if (!res.ok) await parseApiError(res, 'OpenAI error');

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content?.trim() || "";
  return { response: content };
}

// Generate Grammar Quiz
async function generateGrammarQuiz(level = 'Beginner') {
  if (!OPENAI_API_KEY) {
    throw new Error('Missing VITE_OPENAI_API_KEY');
  }

  const timestamp = Date.now();
  const prompt = `Generate 10 UNIQUE English grammar multiple-choice questions.
  ${getDifficultyInstruction(level)}
  
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

  if (!res.ok) await parseApiError(res, 'OpenAI error');
  
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content?.trim() || "";
  
  return parseJSONArrayFromModelContent(content);
}

// Generate Vocabulary Quiz
async function generateVocabularyQuiz(level = 'Beginner') {
  if (!OPENAI_API_KEY) {
    throw new Error('Missing VITE_OPENAI_API_KEY');
  }

  const timestamp = Date.now();
  const prompt = `Generate 10 UNIQUE English vocabulary multiple-choice questions.
  ${getDifficultyInstruction(level)}
  
  IMPORTANT: Create completely NEW and DIFFERENT vocabulary words each time. Avoid repeating common words.
  Generation ID: ${timestamp}
  
  Focus on: word meanings, synonyms, antonyms, word usage in context, collocations.
  
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

  if (!res.ok) await parseApiError(res, 'OpenAI error');
  
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content?.trim() || "";
  
  return parseJSONArrayFromModelContent(content);
}

// Generate Reading Comprehension Quiz
async function generateReadingComprehensionQuiz(level = 'Beginner') {
  if (!OPENAI_API_KEY) {
    throw new Error('Missing VITE_OPENAI_API_KEY');
  }

  const timestamp = Date.now();
  const topics = ['science', 'history', 'culture', 'technology', 'environment', 'health', 'business', 'arts', 'sports', 'travel'];
  const randomTopic = topics[Math.floor(Math.random() * topics.length)];
  
  const prompt = `Generate a reading comprehension exercise with 1 UNIQUE passage and 10 questions.
  ${getDifficultyInstruction(level)}
  
  IMPORTANT: Create a completely NEW and DIFFERENT passage each time. Avoid repeating topics or content.
  Generation ID: ${timestamp}
  Suggested topic area: ${randomTopic}
  
  Create an interesting passage (${String(level).toLowerCase().includes('beginner') ? '120-170' : '200-300'} words) on a fresh topic related to ${randomTopic} or similar areas.
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

  if (!res.ok) await parseApiError(res, 'OpenAI error');
  
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content?.trim() || "";
  
  return parseJSONArrayFromModelContent(content);
}

// Generate Idioms and Phrases Quiz
async function generateIdiomsQuiz(level = 'Beginner') {
  if (!OPENAI_API_KEY) {
    throw new Error('Missing VITE_OPENAI_API_KEY');
  }

  const timestamp = Date.now();
  const prompt = `Generate 10 UNIQUE English idioms and phrases multiple-choice questions.
  ${getDifficultyInstruction(level)}
  
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

  if (!res.ok) await parseApiError(res, 'OpenAI error');
  
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content?.trim() || "";
  
  return parseJSONArrayFromModelContent(content);
}

export default { 
  getAIResponse,
  generateGrammarQuiz,
  generateVocabularyQuiz,
  generateReadingComprehensionQuiz,
  generateIdiomsQuiz
};



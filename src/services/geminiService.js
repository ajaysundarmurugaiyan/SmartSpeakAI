// Gemini AI Service for conversation
// Note: You'll need to add your Gemini API key

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || 'YOUR_API_KEY';
// Defaults tuned to widely available settings; can be overridden via .env
const DEFAULT_MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-1.5-flash';
const DEFAULT_API_VERSION = import.meta.env.VITE_GEMINI_API_VERSION || 'v1';

function buildEndpoint(model, apiVersion) {
  return `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${API_KEY}`;
}

class GeminiService {
  constructor() {
    this.conversationHistory = [];
  }

  async sendMessage(userMessage) {
    try {
      // If API key is not configured, fall back immediately
      if (!API_KEY || API_KEY === 'YOUR_API_KEY') {
        console.warn('Gemini API key missing; using mock response.');
        return this.getMockResponse(userMessage);
      }
      console.log('Sending message to Gemini:', userMessage);
      // Add user message to history
      this.conversationHistory.push({
        role: 'user',
        parts: [{ text: userMessage }]
      });
      // Log the current conversation history for debugging
      console.log('Current conversation history:', JSON.stringify(this.conversationHistory, null, 2));
      let model = DEFAULT_MODEL;
      let apiVersion = DEFAULT_API_VERSION;

      const doRequest = async () => fetch(buildEndpoint(model, apiVersion), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: this.conversationHistory,
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
          safetySettings: [
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_HATE_SPEECH',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            }
          ]
        })
      });

      let response = await doRequest();
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const apiStatus = errorData.error?.status;
        const errorMessage = errorData.error?.message || 'Unknown error';
        console.error('Gemini API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          model,
          apiVersion
        });
        // Auto-retry once with a safer fallback if 404 (model/version mismatch)
        if (response.status === 404) {
          try {
            model = 'gemini-1.5-flash';
            apiVersion = 'v1';
            console.warn('Retrying Gemini with model', model, 'and apiVersion', apiVersion);
            response = await doRequest();
          } catch (_) {}
        }
      }
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const apiStatus = errorData.error?.status;
        const errorMessage = errorData.error?.message || 'Unknown error';
        console.error('Gemini API Error Response (after retry):', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          model,
          apiVersion
        });
        // Provide more user-friendly error messages
        let userMessage = 'Sorry, there was an error processing your request.';
        if (response.status === 400) {
          userMessage = 'Invalid request. Please try rephrasing your message.';
        } else if (response.status === 401 || response.status === 403) {
          userMessage = 'Authentication error. Please check your API key.';
        } else if (response.status === 404) {
          userMessage = 'Model or endpoint not found. Verify model name and API is enabled.';
        } else if (response.status === 429) {
          userMessage = 'Too many requests. Please wait a moment and try again.';
        } else if (response.status >= 500) {
          userMessage = 'Server error. Please try again later.';
        }
        throw new Error(`Gemini API Error (${response.status}): ${userMessage}`);
      }
      const data = await response.json();
      console.log('Gemini API Response:', data);
      if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
        console.error('Invalid Gemini response structure:', data);
        throw new Error('Invalid response from Gemini AI');
      }
      const aiResponse = data.candidates[0].content.parts[0].text;
      // Add AI response to history
      this.conversationHistory.push({
        role: 'model',
        parts: [{ text: aiResponse }]
      });
      return {
        success: true,
        response: aiResponse,
        grammarScore: this.analyzeGrammar(userMessage),
        vocabularyLevel: this.analyzeVocabulary(userMessage)
      };
    } catch (error) {
      console.error('Gemini API Error:', error);
      // Fallback to mock response if API fails
      return this.getMockResponse(userMessage);
    }
  }

  async generateQuizQuestions(topic, numQuestions = 18, avoidQuestions = []) {
    try {
      if (!API_KEY || API_KEY === 'YOUR_API_KEY') {
        if ((topic || '').toLowerCase().includes('reading')) {
          return this.getMockReadingQuiz(15, avoidQuestions);
        }
        return this.getMockQuiz(topic, numQuestions, avoidQuestions);
      }
      let prompt;
      if ((topic || '').toLowerCase().includes('reading')) {
        // Reading comprehension: 3 passages x 5 questions = 15
        numQuestions = 15;
        prompt = `Create a Reading Comprehension quiz with 3 distinct short passages (100-140 words each). For each passage, write 5 multiple-choice questions.
Output a single JSON array of 15 items. Each item must be a JSON object with fields: {"passage":"<the passage text>","question":"...","options":["A","B","C","D"],"correctIndex":0,"explanation":"..."}.
Requirements:
- The same passage text must be repeated in the 5 items that belong to it.
- Vary question types: main idea, detail, inference, vocabulary-in-context, and tone/purpose.
- Do not repeat or closely paraphrase these questions: ${JSON.stringify(avoidQuestions)}.
Return ONLY the JSON array.`;
      } else {
        prompt = `Generate ${numQuestions} multiple-choice quiz questions for ${topic}.
Each question must be JSON: {"question":"...","options":["A","B","C","D"],"correctIndex":0,"explanation":"..."}.
Do not repeat or closely paraphrase these questions: ${JSON.stringify(avoidQuestions)}.
Return a JSON array only.`;
      }
      let model = DEFAULT_MODEL;
      let apiVersion = DEFAULT_API_VERSION;
      const doRequest = async () => fetch(buildEndpoint(model, apiVersion), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: prompt }] }
          ],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
        })
      });
      let resp = await doRequest();
      if (!resp.ok && resp.status === 404) {
        // Retry with safer defaults
        model = 'gemini-1.5-flash';
        apiVersion = 'v1';
        resp = await doRequest();
      }
      if (!resp.ok) {
        console.error('Quiz generation failed', await resp.text().catch(() => ''));
        return this.getMockQuiz(topic, numQuestions, avoidQuestions);
      }
      const data = await resp.json();
      let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
      // Strip markdown code fences if the model returns formatted JSON
      const fence = text.match(/```[a-zA-Z]*\n([\s\S]*?)```/);
      if (fence && fence[1]) {
        text = fence[1];
      }
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error('Invalid quiz format');
      // Ensure we return exactly the requested count
      return parsed.slice(0, numQuestions);
    } catch (e) {
      console.error('Error generating quiz via Gemini:', e);
      if ((topic || '').toLowerCase().includes('reading')) {
        return this.getMockReadingQuiz(15, avoidQuestions);
      }
      return this.getMockQuiz(topic, numQuestions, avoidQuestions);
    }
  }

  getMockQuiz(topic, numQuestions = 18, avoidQuestions = []) {
    // Build a larger randomized pool to avoid repetition
    const templates = [
      (i) => ({ question: `[${topic}] Grammar: She ___ to the office (#${i}).`, options: ['go', 'goes', 'going', 'gone'], correctIndex: 1, explanation: 'Third person singular uses goes.' }),
      (i) => ({ question: `[${topic}] Vocabulary: Synonym of "happy" (#${i})?`, options: ['sad', 'angry', 'joyful', 'tired'], correctIndex: 2, explanation: 'Joyful is a synonym.' }),
      (i) => ({ question: `[${topic}] Article: I saw ___ elephant (#${i}).`, options: ['a', 'an', 'the', 'no article'], correctIndex: 1, explanation: 'Use an before vowel sound.' }),
      (i) => ({ question: `[${topic}] Preposition: He is good ___ math (#${i}).`, options: ['at', 'in', 'on', 'for'], correctIndex: 0, explanation: 'We say good at.' }),
      (i) => ({ question: `[${topic}] Tense: They ___ dinner when I called (#${i}).`, options: ['have', 'had', 'were having', 'are having'], correctIndex: 2, explanation: 'Past continuous.' }),
      (i) => ({ question: `[${topic}] Collocation: I need to ___ my homework (#${i}).`, options: ['make', 'do', 'did', 'done'], correctIndex: 1, explanation: 'Do homework.' })
    ];
    const pool = [];
    for (let i = 1; i <= numQuestions * 3; i++) {
      const maker = templates[i % templates.length];
      pool.push(maker(i));
    }
    const avoidSet = new Set(avoidQuestions);
    const filtered = pool.filter(q => !avoidSet.has(q.question));
    // Shuffle
    for (let i = filtered.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
    }
    return filtered.slice(0, numQuestions);
  }

  getMockReadingQuiz(totalQuestions = 15, avoidQuestions = []) {
    // 3 passages, 5 questions each
    const passages = [
      'Passage A: Emma moved to a small coastal town where mornings began with the scent of salt and fresh bread. She worked at a library that overlooked the harbor, recommending stories to sailors and tourists. Over time, Emma learned the names of gulls by their calls and the rhythm of the tides by the shadows on the pier. Though she missed the city\'s noise, the town\'s quiet routine became her comfort—especially the afternoons when sunlight pooled like warm honey across the reading tables.',
      'Passage B: In a crowded market, Arun sold hand-carved wooden clocks, each designed with a hidden twist: a star that rotated at midnight, a sparrow that chirped on the hour, a moon that glowed softly. Customers would linger, entranced by the steady tick and the scent of cedar. He believed time should feel crafted, not consumed. When a traveler asked why the smallest clock cost the most, Arun smiled and said, "Because it reminds you to slow down."',
      'Passage C: The old bridge had outlived three floods and a dozen winters. Children biked across it in summers, counting boards by the thrum under their tires. Some said the bridge creaked with stories—of letters slipped between planks, of lanterns swinging on foggy nights, of promises made and kept. When the town proposed a steel replacement, the council room filled with voices, not angry but pleading, as if losing the bridge meant losing the way the town remembered itself.'
    ];
    const qTemplates = [
      (p, i) => ({ question: `What is the main idea of this passage? (#${i})`, options: ['Daily routine', 'Central theme', 'Historical event', 'Scientific discovery'], correctIndex: 1, explanation: 'Identifies the central theme.' }),
      (p, i) => ({ question: `Which detail is explicitly mentioned? (#${i})`, options: ['A festival', 'A specific smell', 'A broken clock', 'A storm'], correctIndex: 1, explanation: 'Direct detail from the passage.' }),
      (p, i) => ({ question: `What can be inferred from the passage? (#${i})`, options: ['The narrator dislikes the town', 'The setting is coastal', 'Time moves faster here', 'The bridge is new'], correctIndex: 1, explanation: 'Inference consistent with context.' }),
      (p, i) => ({ question: `What does the phrase imply in context? (#${i})`, options: ['Literal description', 'Metaphor or mood', 'Mathematical term', 'Random aside'], correctIndex: 1, explanation: 'Vocabulary-in-context.' }),
      (p, i) => ({ question: `What is the tone of the passage? (#${i})`, options: ['Ironic', 'Technical', 'Reflective', 'Hostile'], correctIndex: 2, explanation: 'Overall tone is reflective.' })
    ];
    const avoidSet = new Set(avoidQuestions);
    const items = [];
    let idx = 1;
    for (const passage of passages) {
      for (let t = 0; t < 5; t++) {
        const base = qTemplates[t](passage, idx);
        // Ensure uniqueness
        if (avoidSet.has(base.question)) {
          base.question = base.question + ' (alt)';
        }
        items.push({ passage, ...base });
        idx++;
      }
    }
    return items.slice(0, totalQuestions);
  }

  getMockResponse(userMessage) {
    // Contextual mock responses that ask follow-up questions
    const mockResponses = [
      {
        response: `That's interesting! I heard you say "${userMessage}". Tell me more about that - what made you think of it? What's your favorite part?`,
        grammarScore: 85,
        vocabularyLevel: 'Intermediate'
      },
      {
        response: `Great! You mentioned "${userMessage}". That's a good topic. How long have you been interested in this? What do you enjoy most about it?`,
        grammarScore: 78,
        vocabularyLevel: 'Beginner'
      },
      {
        response: `I see! You said "${userMessage}". That sounds fascinating. Can you tell me more details? What happened next?`,
        grammarScore: 92,
        vocabularyLevel: 'Advanced'
      },
      {
        response: `Nice! "${userMessage}" - I'd love to hear more about your experience with that. What was the most memorable part? How did it make you feel?`,
        grammarScore: 88,
        vocabularyLevel: 'Intermediate'
      },
      {
        response: `Wonderful! You're doing well. About "${userMessage}" - that's really interesting. Have you tried anything similar before? What would you do differently?`,
        grammarScore: 90,
        vocabularyLevel: 'Advanced'
      }
    ];
    return {
      success: true,
      ...mockResponses[Math.floor(Math.random() * mockResponses.length)]
    };
  }

  analyzeGrammar(text) {
    // Simple grammar scoring based on sentence structure
    let score = 70;
    if (text[0] === text[0].toUpperCase()) score += 5;
    if (text.match(/[.!?]$/)) score += 5;
    if (text.split(' ').length > 3) score += 10;
    if (text.match(/\b(the|a|an|is|are|was|were)\b/i)) score += 10;
    return Math.min(score, 100);
  }

  analyzeVocabulary(text) {
    const wordCount = text.split(' ').length;
    const uniqueWords = new Set(text.toLowerCase().split(' ')).size;
    const ratio = uniqueWords / wordCount;
    if (ratio > 0.8 && wordCount > 10) return 'Advanced';
    if (ratio > 0.6 || wordCount > 5) return 'Intermediate';
    return 'Beginner';
  }

  clearHistory() {
    this.conversationHistory = [];
  }

  // English learning specific prompts
  async getEnglishLearningResponse(userMessage) {
    // Add system context to the conversation if it's the first message
    if (this.conversationHistory.length === 0) {
      const systemPrompt = this.getSystemPrompt();
      this.conversationHistory.push({
        role: 'user',
        parts: [{ text: systemPrompt }]
      });
    }
    // Generate reply based solely on user's input
    return this.sendMessage(userMessage);
  }

  getSystemPrompt() {
    return `You are a friendly and engaging English conversation teacher. Your role is to:
1. Have natural, flowing conversations with the learner
2. Ask follow-up questions based on what they say
3. Gently correct grammar mistakes by rephrasing naturally
4. Keep responses concise (2-3 sentences max)
5. Always end with a question to keep the conversation going
6. Be encouraging and supportive
7. Adapt to their interests and topics they bring up

Important: Don't just give feedback - have a real conversation! Ask about their day, interests, goals, experiences, etc.`;
  }
}

export default new GeminiService();
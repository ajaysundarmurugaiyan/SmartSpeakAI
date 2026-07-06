// Quiz and Task Data

export const grammarQuizzes = [
  {
    id: 'grammar-1',
    title: 'Grammar Quiz - Present Tense',
    difficulty: 'Beginner',
    questions: [
      {
        id: 1,
        question: 'She ___ to school every day.',
        options: ['go', 'goes', 'going', 'gone'],
        correctAnswer: 1,
        explanation: 'Use "goes" for third person singular in present simple tense.'
      },
      {
        id: 2,
        question: 'They ___ playing football now.',
        options: ['is', 'am', 'are', 'be'],
        correctAnswer: 2,
        explanation: 'Use "are" with plural subjects in present continuous tense.'
      },
      {
        id: 3,
        question: 'I ___ breakfast every morning.',
        options: ['eat', 'eats', 'eating', 'eaten'],
        correctAnswer: 0,
        explanation: 'Use base form "eat" for first person in present simple tense.'
      },
      {
        id: 4,
        question: 'He ___ his homework right now.',
        options: ['do', 'does', 'is doing', 'doing'],
        correctAnswer: 2,
        explanation: 'Use present continuous "is doing" for actions happening now.'
      },
      {
        id: 5,
        question: 'We ___ English every day.',
        options: ['study', 'studies', 'studying', 'studied'],
        correctAnswer: 0,
        explanation: 'Use base form "study" for plural subjects in present simple.'
      }
    ]
  },
  {
    id: 'grammar-2',
    title: 'Grammar Quiz - Past Tense',
    difficulty: 'Intermediate',
    questions: [
      {
        id: 1,
        question: 'Yesterday, I ___ to the market.',
        options: ['go', 'goes', 'went', 'going'],
        correctAnswer: 2,
        explanation: 'Use "went" (past tense of go) for completed past actions.'
      },
      {
        id: 2,
        question: 'She ___ her keys last night.',
        options: ['lose', 'loses', 'lost', 'losing'],
        correctAnswer: 2,
        explanation: 'Use "lost" (past tense of lose) for past events.'
      },
      {
        id: 3,
        question: 'They ___ watching TV when I called.',
        options: ['was', 'were', 'is', 'are'],
        correctAnswer: 1,
        explanation: 'Use "were" with plural subjects in past continuous.'
      },
      {
        id: 4,
        question: 'He ___ finished his work by 5 PM.',
        options: ['has', 'have', 'had', 'having'],
        correctAnswer: 2,
        explanation: 'Use "had" for past perfect tense (action completed before another past action).'
      },
      {
        id: 5,
        question: 'We ___ to Paris last summer.',
        options: ['travel', 'travels', 'traveled', 'traveling'],
        correctAnswer: 2,
        explanation: 'Use past simple "traveled" for completed past actions.'
      }
    ]
  }
];

export const vocabularyQuizzes = [
  {
    id: 'vocab-1',
    title: 'Vocabulary - Common Words',
    difficulty: 'Beginner',
    questions: [
      {
        id: 1,
        question: 'What is the opposite of "hot"?',
        options: ['warm', 'cold', 'cool', 'freezing'],
        correctAnswer: 1,
        explanation: '"Cold" is the direct opposite of "hot".'
      },
      {
        id: 2,
        question: 'Which word means "very big"?',
        options: ['tiny', 'small', 'huge', 'little'],
        correctAnswer: 2,
        explanation: '"Huge" means very big or enormous.'
      },
      {
        id: 3,
        question: 'What does "happy" mean?',
        options: ['sad', 'angry', 'joyful', 'tired'],
        correctAnswer: 2,
        explanation: '"Joyful" is a synonym of "happy".'
      },
      {
        id: 4,
        question: 'Choose the correct word: "I am ___ tired."',
        options: ['very', 'much', 'many', 'lot'],
        correctAnswer: 0,
        explanation: 'Use "very" to intensify adjectives like "tired".'
      },
      {
        id: 5,
        question: 'What is a synonym for "beautiful"?',
        options: ['ugly', 'pretty', 'bad', 'poor'],
        correctAnswer: 1,
        explanation: '"Pretty" is a synonym of "beautiful".'
      }
    ]
  },
  {
    id: 'vocab-2',
    title: 'Vocabulary - Advanced Words',
    difficulty: 'Advanced',
    questions: [
      {
        id: 1,
        question: 'What does "eloquent" mean?',
        options: ['silent', 'fluent and persuasive', 'confused', 'angry'],
        correctAnswer: 1,
        explanation: '"Eloquent" means fluent or persuasive in speaking or writing.'
      },
      {
        id: 2,
        question: 'Choose the correct word: "The evidence was ___."',
        options: ['ambiguous', 'clear', 'obvious', 'simple'],
        correctAnswer: 0,
        explanation: '"Ambiguous" means open to more than one interpretation.'
      },
      {
        id: 3,
        question: 'What is the meaning of "meticulous"?',
        options: ['careless', 'very careful', 'fast', 'lazy'],
        correctAnswer: 1,
        explanation: '"Meticulous" means showing great attention to detail.'
      },
      {
        id: 4,
        question: 'What does "ubiquitous" mean?',
        options: ['rare', 'present everywhere', 'ancient', 'modern'],
        correctAnswer: 1,
        explanation: '"Ubiquitous" means present, appearing, or found everywhere.'
      },
      {
        id: 5,
        question: 'Choose the synonym for "ephemeral":',
        options: ['permanent', 'temporary', 'eternal', 'lasting'],
        correctAnswer: 1,
        explanation: '"Ephemeral" means lasting for a very short time.'
      }
    ]
  }
];

export const speakingTasks = [
  {
    id: 'speaking-1',
    title: 'Introduce Yourself',
    difficulty: 'Beginner',
    prompt: 'Introduce yourself in English. Talk about your name, age, where you live, and your hobbies.',
    minWords: 30,
    timeLimit: 60, // seconds
    scoringCriteria: {
      fluency: 30,
      grammar: 30,
      vocabulary: 20,
      pronunciation: 20
    }
  },
  {
    id: 'speaking-2',
    title: 'Describe Your Day',
    difficulty: 'Intermediate',
    prompt: 'Describe what you did today from morning to evening. Use past tense.',
    minWords: 50,
    timeLimit: 90,
    scoringCriteria: {
      fluency: 25,
      grammar: 35,
      vocabulary: 20,
      pronunciation: 20
    }
  },
  {
    id: 'speaking-3',
    title: 'Express Your Opinion',
    difficulty: 'Advanced',
    prompt: 'What do you think about learning English online? Give your opinion with reasons.',
    minWords: 70,
    timeLimit: 120,
    scoringCriteria: {
      fluency: 20,
      grammar: 30,
      vocabulary: 30,
      pronunciation: 20
    }
  }
];

export const dailyTasks = [
  {
    id: 'daily-1',
    title: 'Grammar Quiz',
    description: 'Test your knowledge of English grammar rules',
    type: 'quiz',
    icon: 'BookOpen',
    color: 'from-blue-400 to-blue-600',
    duration: '10 min',
    points: 100,
    data: grammarQuizzes[0]
  },
  {
    id: 'daily-2',
    title: 'Vocabulary Challenge',
    description: 'Learn 10 new words and their usage',
    type: 'quiz',
    icon: 'MessageCircle',
    color: 'from-purple-400 to-purple-600',
    duration: '15 min',
    points: 100,
    data: vocabularyQuizzes[0]
  },
  // Reading and Idioms moved up to 3 and 4
  {
    id: 'daily-3',
    title: 'Reading Comprehension',
    description: 'Understand short passages and answer questions',
    type: 'quiz',
    icon: 'BookOpen',
    color: 'from-indigo-400 to-indigo-600',
    duration: '12 min',
    points: 120,
    data: { topic: 'Reading Comprehension' }
  },
  {
    id: 'daily-4',
    title: 'Idioms & Phrases',
    description: 'Learn common English idioms and their meanings',
    type: 'quiz',
    icon: 'Star',
    color: 'from-amber-400 to-amber-600',
    duration: '12 min',
    points: 120,
    data: { topic: 'English Idioms and Phrases' }
  },
  // Speaking and Conversation moved down to 5 and 6
  {
    id: 'daily-5',
    title: 'Speaking Practice',
    description: 'Practice pronunciation with AI feedback',
    type: 'speaking',
    icon: 'Mic',
    color: 'from-pink-400 to-pink-600',
    duration: '20 min',
    points: 150,
    data: speakingTasks[0]
  },
  {
    id: 'daily-6',
    title: 'Conversation Challenge',
    description: 'Complete a full conversation scenario',
    type: 'conversation',
    icon: 'Trophy',
    color: 'from-green-400 to-green-600',
    duration: '25 min',
    points: 200,
    data: {
      scenario: 'At a Restaurant',
      prompts: [
        'Greet the waiter',
        'Order your food',
        'Ask about the menu',
        'Request the bill'
      ]
    }
  }
];

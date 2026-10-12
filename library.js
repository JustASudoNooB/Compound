/* Built-in skill plans for Compound.
   Each skill has a ladder of levels. Each level has milestones (what "done" looks like),
   practice types (what to do on a given day) and resources (shown as web searches,
   so a link never points at a page that moved). Practice "kind":
     new    = learning something new; finishing it schedules spaced reviews
     review = going back over old material
     skill  = applied practice (projects, workouts, mock interviews)            */
window.COMPOUND_LIBRARY = [
  {
    id: 'japanese', name: 'Japanese', icon: 'あ',
    summary: 'From zero to reading native material: kana, then JLPT N5, N4, N3 and beyond.',
    levels: [
      { name: 'Kana', goal: 'Read and write all hiragana and katakana from memory.', weeks: 3,
        milestones: ['Read all 46 hiragana', 'Write all 46 hiragana from memory with correct stroke order', 'Read all 46 katakana', 'Read 50 simple words in kana without help'],
        practices: [
          { type: 'handwriting', kind: 'new', minutes: 20, text: 'Handwrite 5 new kana 10 times each on grid paper, saying each sound aloud' },
          { type: 'srs', kind: 'review', minutes: 10, text: 'Kana flashcards in Anki or Tofugu Kana Quiz' },
          { type: 'reading', kind: 'skill', minutes: 10, text: 'Read 20 kana-only words aloud (children’s word lists)' },
          { type: 'listening', kind: 'skill', minutes: 10, text: 'Listen to a beginner podcast and write down 5 words you catch in kana' }
        ],
        resources: [
          { title: 'Tofugu Learn Hiragana guide', kind: 'free guide' },
          { title: 'Tofugu Learn Katakana guide', kind: 'free guide' },
          { title: 'Anki kana deck', kind: 'flashcards' },
          { title: 'genkouyoushi Japanese practice paper printable', kind: 'handwriting sheets' }
        ] },
      { name: 'N5 foundations', goal: 'Basic grammar, about 100 kanji and 800 words (JLPT N5).', weeks: 12,
        milestones: ['Finish Genki I', 'Know 100 kanji (read meaning and one reading)', 'Know 800 words', 'Pass an N5 practice test'],
        practices: [
          { type: 'grammar', kind: 'new', minutes: 30, text: 'One Genki I lesson section: read, then do its exercises' },
          { type: 'kanji', kind: 'new', minutes: 20, text: 'Learn 5 new kanji: handwrite each 10 times with stroke order' },
          { type: 'srs', kind: 'review', minutes: 15, text: 'Daily SRS reviews (WaniKani or Anki core deck)' },
          { type: 'listening', kind: 'skill', minutes: 15, text: 'Shadow 3 minutes of beginner audio (repeat right after the speaker)' },
          { type: 'speaking', kind: 'skill', minutes: 10, text: 'Say 10 sentences using today’s grammar out loud, record yourself once' }
        ],
        resources: [
          { title: 'Genki I textbook 3rd edition', kind: 'textbook' },
          { title: 'WaniKani kanji', kind: 'kanji SRS' },
          { title: 'Anki Kaishi 1.5k deck', kind: 'vocabulary deck' },
          { title: 'Tae Kim Guide to Japanese Grammar', kind: 'free grammar guide' },
          { title: 'Comprehensible Japanese YouTube beginner', kind: 'listening' },
          { title: 'JLPT N5 official sample questions', kind: 'practice test' }
        ] },
      { name: 'N4', goal: 'Everyday grammar, about 300 kanji and 1,500 words (JLPT N4).', weeks: 16,
        milestones: ['Finish Genki II', 'Know 300 kanji', 'Read a graded reader level 1 book', 'Pass an N4 practice test'],
        practices: [
          { type: 'grammar', kind: 'new', minutes: 30, text: 'One Genki II section, or 2 Bunpro grammar points' },
          { type: 'kanji', kind: 'new', minutes: 20, text: 'Learn 5 kanji with one example word each, handwritten' },
          { type: 'srs', kind: 'review', minutes: 20, text: 'Clear today’s SRS reviews' },
          { type: 'reading', kind: 'skill', minutes: 20, text: 'Read one graded reader story; look up at most 5 words' },
          { type: 'listening', kind: 'skill', minutes: 20, text: 'Watch a beginner Japanese video with Japanese subtitles' }
        ],
        resources: [
          { title: 'Genki II textbook 3rd edition', kind: 'textbook' },
          { title: 'Bunpro grammar', kind: 'grammar SRS' },
          { title: 'Japanese Graded Readers level 1', kind: 'reading' },
          { title: 'NHK Easy Japanese', kind: 'listening' },
          { title: 'JLPT N4 sample questions', kind: 'practice test' }
        ] },
      { name: 'N3', goal: 'Read simple news and follow slow conversations (JLPT N3).', weeks: 24,
        milestones: ['Know 650 kanji', 'Read NHK News Web Easy articles daily for 2 weeks', 'Hold a 15 minute conversation with a tutor', 'Pass an N3 practice test'],
        practices: [
          { type: 'reading', kind: 'skill', minutes: 30, text: 'Read one NHK News Web Easy article, then summarise it in 3 Japanese sentences' },
          { type: 'grammar', kind: 'new', minutes: 25, text: 'Two intermediate grammar points with 3 example sentences each' },
          { type: 'srs', kind: 'review', minutes: 20, text: 'Clear today’s SRS reviews' },
          { type: 'speaking', kind: 'skill', minutes: 30, text: 'Tutor session or 10 minutes of shadowing native speech' },
          { type: 'handwriting', kind: 'review', minutes: 15, text: 'Handwrite 10 kanji from memory that you got wrong this week' }
        ],
        resources: [
          { title: 'NHK News Web Easy', kind: 'reading' },
          { title: 'Satori Reader', kind: 'reading' },
          { title: 'Tobira Gateway to Advanced Japanese', kind: 'textbook' },
          { title: 'italki Japanese tutor', kind: 'speaking' },
          { title: 'JLPT N3 sample questions', kind: 'practice test' }
        ] },
      { name: 'N2 and native content', goal: 'Comfortable with native media, work-level reading.', weeks: 40,
        milestones: ['Read a novel or manga volume without a dictionary for most pages', 'Watch an episode without subtitles and follow the plot', 'Pass an N2 practice test'],
        practices: [
          { type: 'reading', kind: 'skill', minutes: 40, text: 'Read native material (manga, novel, news) for 40 minutes' },
          { type: 'listening', kind: 'skill', minutes: 40, text: 'One episode of a Japanese show or podcast without English subtitles' },
          { type: 'srs', kind: 'review', minutes: 20, text: 'Mine 10 new words from today’s reading into your deck' },
          { type: 'speaking', kind: 'skill', minutes: 30, text: 'Conversation practice on a topic you read about' }
        ],
        resources: [
          { title: 'JLPT N2 sample questions', kind: 'practice test' },
          { title: 'Japanese learner manga recommendations', kind: 'reading' },
          { title: 'Yomitan dictionary browser extension', kind: 'tool' }
        ] }
    ]
  },
  {
    id: 'ml', name: 'ML / Python', icon: '{ }',
    summary: 'Python, the data stack, classical ML, deep learning, then real projects.',
    levels: [
      { name: 'Python basics', goal: 'Write small programs with functions, lists, dicts, files and classes.', weeks: 4,
        milestones: ['Solve 30 easy exercises', 'Write a script that reads a CSV and prints a summary', 'Build one small project and put it on GitHub'],
        practices: [
          { type: 'lesson', kind: 'new', minutes: 30, text: 'One chapter of Python Crash Course or Automate the Boring Stuff, typing every example' },
          { type: 'exercises', kind: 'skill', minutes: 30, text: 'Solve 3 easy problems on Exercism or HackerRank Python' },
          { type: 'recall', kind: 'review', minutes: 10, text: 'From memory, write the syntax you learned yesterday, then check it' },
          { type: 'project', kind: 'skill', minutes: 45, text: 'Add one feature to your small project and commit it' }
        ],
        resources: [
          { title: 'Automate the Boring Stuff with Python', kind: 'free book' },
          { title: 'Python Crash Course Eric Matthes', kind: 'book' },
          { title: 'Exercism Python track', kind: 'exercises' }
        ] },
      { name: 'Data stack', goal: 'Clean, explore and plot data with NumPy, pandas and matplotlib.', weeks: 4,
        milestones: ['Finish Kaggle Learn Pandas and Data Visualization', 'Do an exploratory analysis notebook on a real dataset', 'Explain vectorisation vs loops'],
        practices: [
          { type: 'lesson', kind: 'new', minutes: 30, text: 'One Kaggle Learn lesson (Pandas or Data Visualization) with its exercise' },
          { type: 'project', kind: 'skill', minutes: 45, text: 'Explore one question in a real dataset and write 3 findings' },
          { type: 'recall', kind: 'review', minutes: 10, text: 'Rewrite yesterday’s pandas operations from memory' }
        ],
        resources: [
          { title: 'Kaggle Learn Pandas', kind: 'free course' },
          { title: 'Python for Data Analysis Wes McKinney', kind: 'book' },
          { title: 'NumPy user guide absolute beginners', kind: 'docs' }
        ] },
      { name: 'Classical ML', goal: 'Understand and apply regression, trees, ensembles, validation and metrics.', weeks: 10,
        milestones: ['Finish ISLP chapters 2 to 8', 'Implement linear and logistic regression from scratch', 'Complete one Kaggle competition with a validated model', 'Explain bias-variance, regularisation and cross-validation out loud'],
        practices: [
          { type: 'theory', kind: 'new', minutes: 40, text: 'One ISLP section or one Andrew Ng ML Specialization video set, with notes' },
          { type: 'from-scratch', kind: 'skill', minutes: 45, text: 'Implement the algorithm you studied in NumPy and compare with scikit-learn' },
          { type: 'recall', kind: 'review', minutes: 15, text: 'Explain yesterday’s concept in writing without notes (Feynman check)' },
          { type: 'project', kind: 'skill', minutes: 60, text: 'One experiment on your Kaggle project: feature, model or validation change' }
        ],
        resources: [
          { title: 'An Introduction to Statistical Learning with Python ISLP', kind: 'free book' },
          { title: 'Andrew Ng Machine Learning Specialization Coursera', kind: 'course' },
          { title: 'Hands-On Machine Learning Geron', kind: 'book' },
          { title: 'StatQuest Josh Starmer', kind: 'videos' }
        ] },
      { name: 'Deep learning', goal: 'Train and debug neural networks in PyTorch.', weeks: 12,
        milestones: ['Finish fast.ai Practical Deep Learning part 1', 'Build micrograd and makemore following Karpathy', 'Train a model on your own data and write up results'],
        practices: [
          { type: 'lesson', kind: 'new', minutes: 60, text: 'One fast.ai lesson or one Karpathy Zero to Hero video, coding along' },
          { type: 'from-scratch', kind: 'skill', minutes: 45, text: 'Re-implement a piece (backprop, attention, a training loop) without looking' },
          { type: 'recall', kind: 'review', minutes: 15, text: 'Write down 5 things that can make training diverge and how to check each' },
          { type: 'project', kind: 'skill', minutes: 60, text: 'One training run on your project with a written hypothesis and result' }
        ],
        resources: [
          { title: 'fast.ai Practical Deep Learning for Coders', kind: 'free course' },
          { title: 'Andrej Karpathy Neural Networks Zero to Hero', kind: 'free videos' },
          { title: 'Dive into Deep Learning d2l.ai', kind: 'free book' },
          { title: 'PyTorch tutorials', kind: 'docs' }
        ] },
      { name: 'Projects and research', goal: 'Ship portfolio projects and read papers.', weeks: 16,
        milestones: ['Ship 2 end-to-end projects with a README and demo', 'Reproduce one result from a paper', 'Write a blog post explaining a project'],
        practices: [
          { type: 'paper', kind: 'new', minutes: 45, text: 'Read one paper section and write a 5-line summary' },
          { type: 'project', kind: 'skill', minutes: 90, text: 'Deep work block on your current project' },
          { type: 'recall', kind: 'review', minutes: 15, text: 'Explain a past project end to end as if in an interview' }
        ],
        resources: [
          { title: 'Papers with Code', kind: 'papers' },
          { title: 'Kaggle competitions', kind: 'projects' },
          { title: 'Full Stack Deep Learning', kind: 'course' }
        ] }
    ]
  },
  {
    id: 'quant', name: 'Quant finance', icon: '∫',
    summary: 'Probability, statistics, derivatives and stochastic calculus, aimed at quant and markets interviews.',
    levels: [
      { name: 'Probability and mental math', goal: 'Fast arithmetic and solid discrete probability.', weeks: 6,
        milestones: ['Score 40+ on Zetamac default settings', 'Finish Blitzstein and Hwang chapters 1 to 5', 'Solve 30 probability puzzles'],
        practices: [
          { type: 'mental-math', kind: 'skill', minutes: 10, text: 'Three 2-minute Zetamac rounds, log your best score' },
          { type: 'theory', kind: 'new', minutes: 40, text: 'One section of Blitzstein and Hwang or one Stat 110 lecture' },
          { type: 'puzzles', kind: 'skill', minutes: 30, text: 'Solve 3 probability puzzles on paper, then check solutions' },
          { type: 'recall', kind: 'review', minutes: 15, text: 'Redo 2 puzzles you got wrong last week without notes' }
        ],
        resources: [
          { title: 'Zetamac arithmetic game', kind: 'mental math' },
          { title: 'Harvard Stat 110 Blitzstein', kind: 'free course' },
          { title: 'Fifty Challenging Problems in Probability Mosteller', kind: 'book' },
          { title: 'Brainstellar puzzles', kind: 'puzzles' }
        ] },
      { name: 'Statistics and linear algebra', goal: 'Estimation, regression, hypothesis tests and matrix tools.', weeks: 8,
        milestones: ['Derive OLS and its variance', 'Explain eigen-decomposition and PCA', 'Run and interpret a time-series regression on market data'],
        practices: [
          { type: 'theory', kind: 'new', minutes: 40, text: 'One topic: estimation, testing, regression or a linear algebra chapter' },
          { type: 'coding', kind: 'skill', minutes: 40, text: 'Apply today’s topic in Python on real price data' },
          { type: 'recall', kind: 'review', minutes: 15, text: 'Derive one result from last week on a blank page' }
        ],
        resources: [
          { title: 'Gilbert Strang MIT 18.06 Linear Algebra', kind: 'free course' },
          { title: 'All of Statistics Wasserman', kind: 'book' },
          { title: 'Introductory Econometrics Wooldridge', kind: 'book' }
        ] },
      { name: 'Derivatives and options', goal: 'Price and hedge options; understand the Greeks and volatility.', weeks: 10,
        milestones: ['Price European options with a binomial tree and Black-Scholes', 'Explain each Greek and how to hedge it', 'Build a volatility smile from real option prices'],
        practices: [
          { type: 'theory', kind: 'new', minutes: 45, text: 'One Hull chapter section with its end-of-chapter problems' },
          { type: 'coding', kind: 'skill', minutes: 45, text: 'Implement today’s pricing or hedging idea in Python' },
          { type: 'recall', kind: 'review', minutes: 15, text: 'Explain put-call parity and one Greek from memory' }
        ],
        resources: [
          { title: 'Options Futures and Other Derivatives Hull', kind: 'book' },
          { title: 'Option Volatility and Pricing Natenberg', kind: 'book' },
          { title: 'NISM Series VIII equity derivatives', kind: 'certification' }
        ] },
      { name: 'Stochastic calculus', goal: 'Brownian motion, Ito calculus, risk-neutral pricing.', weeks: 12,
        milestones: ['Finish Shreve volume I', 'Derive Black-Scholes via Ito and via risk-neutral expectation', 'Simulate GBM paths and price an option by Monte Carlo'],
        practices: [
          { type: 'theory', kind: 'new', minutes: 50, text: 'One Shreve section and two of its exercises' },
          { type: 'coding', kind: 'skill', minutes: 40, text: 'Monte Carlo or PDE experiment for today’s topic' },
          { type: 'recall', kind: 'review', minutes: 15, text: 'Rederive Ito’s lemma for a new function' }
        ],
        resources: [
          { title: 'Stochastic Calculus for Finance Shreve volume I', kind: 'book' },
          { title: 'Stochastic Calculus for Finance Shreve volume II', kind: 'book' },
          { title: 'The Concepts and Practice of Mathematical Finance Joshi', kind: 'book' }
        ] },
      { name: 'Interview ready', goal: 'Answer quant, risk and markets interview questions under time pressure.', weeks: 8,
        milestones: ['Finish the green book (Zhou)', 'Do 5 timed mock interviews', 'Prepare 3 stories about your projects and internship'],
        practices: [
          { type: 'puzzles', kind: 'skill', minutes: 45, text: '5 green book questions timed, out loud as if in an interview' },
          { type: 'mock', kind: 'skill', minutes: 45, text: 'Mock interview with a friend or record yourself answering 3 questions' },
          { type: 'recall', kind: 'review', minutes: 20, text: 'Redo every question you missed this week' },
          { type: 'markets', kind: 'skill', minutes: 15, text: 'Read the day’s market news and write one trade idea with its risk' }
        ],
        resources: [
          { title: 'A Practical Guide to Quantitative Finance Interviews Xinfeng Zhou', kind: 'book' },
          { title: 'Heard on the Street Timothy Crack', kind: 'book' },
          { title: 'Quant Job Interview Questions and Answers Joshi', kind: 'book' },
          { title: 'QuantNet forums interview', kind: 'community' }
        ] }
    ]
  },
  {
    id: 'fitness', name: 'Fitness', icon: '▲',
    summary: 'Build the habit, then strength and running, then progress steadily.',
    levels: [
      { name: 'Habit', goal: 'Move on most days and sleep consistently.', weeks: 4,
        milestones: ['Exercise 3 times a week for 3 weeks', 'Walk 30 minutes on 5 days in a week', 'Keep the same bedtime for 2 weeks'],
        practices: [
          { type: 'walk', kind: 'skill', minutes: 30, text: 'Brisk 30 minute walk' },
          { type: 'bodyweight', kind: 'skill', minutes: 20, text: 'Bodyweight circuit: squats, push-ups, rows, plank, 3 rounds' },
          { type: 'mobility', kind: 'skill', minutes: 10, text: '10 minutes of stretching or mobility' }
        ],
        resources: [
          { title: 'NHS Couch to 5K', kind: 'free plan' },
          { title: 'r/bodyweightfitness recommended routine', kind: 'free plan' }
        ] },
      { name: 'Beginner strength and running', goal: 'Full-body strength 3 times a week and run 5K.', weeks: 12,
        milestones: ['Run 5K without stopping', 'Add weight to main lifts every week for 8 weeks', 'Log every workout for a month'],
        practices: [
          { type: 'strength', kind: 'skill', minutes: 50, text: 'Full-body session: squat, press, deadlift or row, add a little weight' },
          { type: 'run', kind: 'skill', minutes: 30, text: 'Couch to 5K session' },
          { type: 'mobility', kind: 'skill', minutes: 10, text: 'Mobility work after training' }
        ],
        resources: [
          { title: 'StrongLifts 5x5', kind: 'program' },
          { title: 'Starting Strength Rippetoe', kind: 'book' },
          { title: 'NHS Couch to 5K', kind: 'free plan' }
        ] },
      { name: 'Intermediate', goal: 'Structured split and 10K running.', weeks: 16,
        milestones: ['Run 10K', 'Follow a 4-day split for 12 weeks', 'Hit a personal best on 3 lifts'],
        practices: [
          { type: 'strength', kind: 'skill', minutes: 60, text: 'Split session following your program' },
          { type: 'run', kind: 'skill', minutes: 40, text: 'Easy run, or intervals once a week' },
          { type: 'recovery', kind: 'skill', minutes: 15, text: 'Mobility and recovery' }
        ],
        resources: [
          { title: 'GZCLP program', kind: 'program' },
          { title: 'Hal Higdon 10K training', kind: 'running plan' }
        ] }
    ]
  }
];

/* ==========================================================================
   NPTEL Psychology of Learning - Interactive MCQ Platform Logic
   ========================================================================== */

(function () {
  'use strict';

  // State
  const state = {
    allQuestions: typeof ALL_QUESTIONS !== 'undefined' ? ALL_QUESTIONS : [],
    filteredPool: [],
    quizQuestions: [],
    currentIndex: 0,
    mode: 'study', // 'study' | 'exam'
    selectedYears: new Set(['2026', '2025', '2024', '2023']),
    selectedWeek: 'all',
    randomizeOrder: true,
    shuffleOptions: false,
    questionLimit: 'all', // 'all' or number
    userAnswers: {}, // { [index]: optionIndex }
    flagged: new Set(),
    startTime: null,
    timerSeconds: 0,
    timerInterval: null,
    soundEnabled: true,
    reviewFilter: 'all'
  };

  // Sound Synthesizer via Web Audio API (Zero external assets needed)
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playSound(type) {
    if (!state.soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === 'click') {
        osc.frequency.setValueAtTime(480, now);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === 'correct') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12); // E5
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'incorrect') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.setValueAtTime(180, now + 0.08);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'submit') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.25);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      }
    } catch (e) {
      // Audio not supported or blocked, graceful ignore
    }
  }

  // DOM Elements
  const DOM = {
    // Views
    setupView: document.getElementById('setupView'),
    quizView: document.getElementById('quizView'),
    resultsView: document.getElementById('resultsView'),
    modalOverlay: document.getElementById('modalOverlay'),

    // Setup elements
    modeStudyCard: document.getElementById('modeStudyCard'),
    modeExamCard: document.getElementById('modeExamCard'),
    yearCheckboxes: document.querySelectorAll('.year-checkbox'),
    yearLabels: document.querySelectorAll('.year-checkbox-label'),
    selectAllYearsBtn: document.getElementById('selectAllYearsBtn'),
    deselectAllYearsBtn: document.getElementById('deselectAllYearsBtn'),
    randomizeToggle: document.getElementById('randomizeToggle'),
    shuffleOptionsToggle: document.getElementById('shuffleOptionsToggle'),
    weekFilterSelect: document.getElementById('weekFilterSelect'),
    limitPills: document.querySelectorAll('.limit-pill'),
    availableCountText: document.getElementById('availableCountText'),
    btnStartQuiz: document.getElementById('btnStartQuiz'),

    // Quiz elements
    quizModePill: document.getElementById('quizModePill'),
    timerDisplay: document.getElementById('timerDisplay'),
    timerBox: document.getElementById('timerBox'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    qNumberText: document.getElementById('qNumberText'),
    qYearBadge: document.getElementById('qYearBadge'),
    qWeekBadge: document.getElementById('qWeekBadge'),
    btnFlag: document.getElementById('btnFlag'),
    questionText: document.getElementById('questionText'),
    optionsList: document.getElementById('optionsList'),
    explanationBox: document.getElementById('explanationBox'),
    explanationSolutionText: document.getElementById('explanationSolutionText'),
    studyScoreTracker: document.getElementById('studyScoreTracker'),
    btnPrev: document.getElementById('btnPrev'),
    btnNext: document.getElementById('btnNext'),
    btnFinishQuiz: document.getElementById('btnFinishQuiz'),
    paletteGrid: document.getElementById('paletteGrid'),
    btnHomeQuiz: document.getElementById('btnHomeQuiz'),

    // Results elements
    resultScoreText: document.getElementById('resultScoreText'),
    resultMaxText: document.getElementById('resultMaxText'),
    resultHeadline: document.getElementById('resultHeadline'),
    resultDesc: document.getElementById('resultDesc'),
    statTotal: document.getElementById('statTotal'),
    statCorrect: document.getElementById('statCorrect'),
    statIncorrect: document.getElementById('statIncorrect'),
    statUnanswered: document.getElementById('statUnanswered'),
    statAccuracy: document.getElementById('statAccuracy'),
    statTime: document.getElementById('statTime'),
    reviewFilterPills: document.querySelectorAll('.filter-pill'),
    reviewList: document.getElementById('reviewList'),
    btnRetake: document.getElementById('btnRetake'),
    btnReviewInStudy: document.getElementById('btnReviewInStudy'),
    btnNewQuiz: document.getElementById('btnNewQuiz'),

    // Global
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    soundToggleBtn: document.getElementById('soundToggleBtn'),
    modalTitle: document.getElementById('modalTitle'),
    modalMsg: document.getElementById('modalMsg'),
    modalConfirmBtn: document.getElementById('modalConfirmBtn'),
    modalCancelBtn: document.getElementById('modalCancelBtn')
  };

  // Initialize
  function init() {
    setupTheme();
    setupYearCounts();
    populateWeeksDropdown();
    attachEventListeners();
    updateAvailableCount();
  }

  // Theme Management
  function setupTheme() {
    const saved = localStorage.getItem('theme_preference') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme_preference', next);
    updateThemeIcon(next);
  }

  function updateThemeIcon(theme) {
    if (!DOM.themeToggleBtn) return;
    DOM.themeToggleBtn.innerHTML = theme === 'dark'
      ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
      : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  }

  // Populate Week Dropdown
  function populateWeeksDropdown() {
    const weeks = new Set();
    state.allQuestions.forEach(q => {
      if (q.week) weeks.add(q.week);
    });

    const sortedWeeks = Array.from(weeks).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, '') || 0);
      const numB = parseInt(b.replace(/\D/g, '') || 0);
      return numA - numB;
    });

    DOM.weekFilterSelect.innerHTML = '<option value="all">All Weeks (0 to 12)</option>';
    sortedWeeks.forEach(w => {
      const opt = document.createElement('option');
      opt.value = w;
      opt.textContent = w;
      DOM.weekFilterSelect.appendChild(opt);
    });
  }

  // Calculate year counts
  function setupYearCounts() {
    const counts = {};
    state.allQuestions.forEach(q => {
      counts[q.year] = (counts[q.year] || 0) + 1;
    });

    DOM.yearLabels.forEach(label => {
      const input = label.querySelector('.year-checkbox');
      const countEl = label.querySelector('.year-count');
      if (input && countEl) {
        const cnt = counts[input.value] || 0;
        countEl.textContent = `${cnt} Questions`;
      }
    });
  }

  // Update Available Questions Count on Setup Screen
  function updateAvailableCount() {
    const filtered = state.allQuestions.filter(q => {
      const yearMatch = state.selectedYears.has(q.year);
      const weekMatch = state.selectedWeek === 'all' || q.week === state.selectedWeek;
      return yearMatch && weekMatch;
    });

    state.filteredPool = filtered;
    const totalAvail = filtered.length;

    let effectiveCount = totalAvail;
    if (state.questionLimit !== 'all') {
      effectiveCount = Math.min(totalAvail, parseInt(state.questionLimit));
    }

    DOM.availableCountText.textContent = `${effectiveCount} of ${totalAvail} Questions Selected`;
    DOM.btnStartQuiz.disabled = totalAvail === 0;

    if (totalAvail === 0) {
      DOM.btnStartQuiz.innerHTML = `No Questions Match Filter`;
    } else {
      const modeLabel = state.mode === 'study' ? 'Start Study Mode' : 'Start Exam Mode';
      DOM.btnStartQuiz.innerHTML = `
        <span>${modeLabel} (${effectiveCount} Qs)</span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
      `;
    }
  }

  // Event Listeners
  function attachEventListeners() {
    // Theme toggle
    DOM.themeToggleBtn.addEventListener('click', toggleTheme);

    // Sound toggle
    DOM.soundToggleBtn.addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      DOM.soundToggleBtn.style.opacity = state.soundEnabled ? '1' : '0.4';
      if (state.soundEnabled) playSound('click');
    });

    // Mode cards
    DOM.modeStudyCard.addEventListener('click', () => {
      state.mode = 'study';
      DOM.modeStudyCard.classList.add('active');
      DOM.modeExamCard.classList.remove('active');
      playSound('click');
      updateAvailableCount();
    });

    DOM.modeExamCard.addEventListener('click', () => {
      state.mode = 'exam';
      DOM.modeExamCard.classList.add('active');
      DOM.modeStudyCard.classList.remove('active');
      playSound('click');
      updateAvailableCount();
    });

    // Year checkboxes
    DOM.yearCheckboxes.forEach(cb => {
      cb.addEventListener('change', (e) => {
        const year = e.target.value;
        const parent = e.target.closest('.year-checkbox-label');
        if (e.target.checked) {
          state.selectedYears.add(year);
          parent.classList.add('checked');
        } else {
          state.selectedYears.delete(year);
          parent.classList.remove('checked');
        }
        playSound('click');
        updateAvailableCount();
      });
    });

    // Select/Deselect All Years
    DOM.selectAllYearsBtn.addEventListener('click', () => {
      DOM.yearCheckboxes.forEach(cb => {
        cb.checked = true;
        state.selectedYears.add(cb.value);
        cb.closest('.year-checkbox-label').classList.add('checked');
      });
      playSound('click');
      updateAvailableCount();
    });

    DOM.deselectAllYearsBtn.addEventListener('click', () => {
      DOM.yearCheckboxes.forEach(cb => {
        cb.checked = false;
        state.selectedYears.delete(cb.value);
        cb.closest('.year-checkbox-label').classList.remove('checked');
      });
      playSound('click');
      updateAvailableCount();
    });

    // Week Filter Select
    DOM.weekFilterSelect.addEventListener('change', (e) => {
      state.selectedWeek = e.target.value;
      playSound('click');
      updateAvailableCount();
    });

    // Randomize toggle
    DOM.randomizeToggle.addEventListener('change', (e) => {
      state.randomizeOrder = e.target.checked;
      playSound('click');
    });

    // Shuffle options toggle
    DOM.shuffleOptionsToggle.addEventListener('change', (e) => {
      state.shuffleOptions = e.target.checked;
      playSound('click');
    });

    // Limit pills
    DOM.limitPills.forEach(pill => {
      pill.addEventListener('click', () => {
        DOM.limitPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.questionLimit = pill.getAttribute('data-limit');
        playSound('click');
        updateAvailableCount();
      });
    });

    // Start Quiz
    DOM.btnStartQuiz.addEventListener('click', startQuiz);

    // Quiz Navigation
    DOM.btnPrev.addEventListener('click', () => {
      if (state.currentIndex > 0) {
        state.currentIndex--;
        renderCurrentQuestion();
        playSound('click');
      }
    });

    DOM.btnNext.addEventListener('click', () => {
      if (state.currentIndex < state.quizQuestions.length - 1) {
        state.currentIndex++;
        renderCurrentQuestion();
        playSound('click');
      }
    });

    // Flag Question
    DOM.btnFlag.addEventListener('click', () => {
      if (state.flagged.has(state.currentIndex)) {
        state.flagged.delete(state.currentIndex);
        DOM.btnFlag.classList.remove('flagged');
      } else {
        state.flagged.add(state.currentIndex);
        DOM.btnFlag.classList.add('flagged');
      }
      playSound('click');
      updatePaletteGrid();
    });

    // Finish / Submit Quiz
    DOM.btnFinishQuiz.addEventListener('click', handleFinishExamRequest);

    // Home / Exit Quiz
    DOM.btnHomeQuiz.addEventListener('click', () => {
      showModal(
        'Exit to Menu?',
        'Are you sure you want to exit the current session? Your current progress will be lost.',
        () => {
          stopTimer();
          showView('setup');
        }
      );
    });

    // Results Actions
    DOM.btnRetake.addEventListener('click', () => {
      startQuiz();
    });

    DOM.btnReviewInStudy.addEventListener('click', () => {
      state.mode = 'study';
      // keep current answers and open study mode
      showView('quiz');
      state.currentIndex = 0;
      renderCurrentQuestion();
      updatePaletteGrid();
    });

    DOM.btnNewQuiz.addEventListener('click', () => {
      showView('setup');
    });

    // Review filters
    DOM.reviewFilterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        DOM.reviewFilterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.reviewFilter = pill.getAttribute('data-filter');
        playSound('click');
        renderReviewList();
      });
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', handleKeyboardShortcuts);
  }

  // Keyboard Navigation Handler
  function handleKeyboardShortcuts(e) {
    if (DOM.quizView.style.display === 'none') return;
    if (DOM.modalOverlay.classList.contains('open')) return;

    // 1-5 or A-E to select options
    const q = state.quizQuestions[state.currentIndex];
    if (!q) return;

    const key = e.key.toUpperCase();
    let optionIdx = -1;

    if (['1', '2', '3', '4', '5'].includes(key)) {
      optionIdx = parseInt(key) - 1;
    } else if (['A', 'B', 'C', 'D', 'E'].includes(key)) {
      optionIdx = key.charCodeAt(0) - 65;
    }

    if (optionIdx >= 0 && optionIdx < q.options.length) {
      if (state.mode === 'exam' || state.userAnswers[state.currentIndex] === undefined) {
        selectOption(optionIdx);
      }
    } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
      if (state.currentIndex < state.quizQuestions.length - 1) {
        state.currentIndex++;
        renderCurrentQuestion();
        playSound('click');
      }
    } else if (e.key === 'ArrowLeft') {
      if (state.currentIndex > 0) {
        state.currentIndex--;
        renderCurrentQuestion();
        playSound('click');
      }
    } else if (key === 'M') {
      DOM.btnFlag.click();
    }
  }

  // Show Specific Screen View
  function showView(viewName) {
    DOM.setupView.style.display = viewName === 'setup' ? 'block' : 'none';
    DOM.quizView.style.display = viewName === 'quiz' ? 'block' : 'none';
    DOM.resultsView.style.display = viewName === 'results' ? 'block' : 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Start Quiz Session
  function startQuiz() {
    let pool = [...state.filteredPool];
    if (pool.length === 0) return;

    // Randomize Question Order if selected
    if (state.randomizeOrder) {
      pool = shuffleArray(pool);
    }

    // Limit count
    if (state.questionLimit !== 'all') {
      const limit = parseInt(state.questionLimit);
      pool = pool.slice(0, limit);
    }

    // Prepare questions (with option shuffling if enabled)
    state.quizQuestions = pool.map((q, idx) => {
      let options = [...q.options];
      let correctIdx = q.answer;

      if (state.shuffleOptions) {
        // Map original option objects with isCorrect
        const mapped = options.map((opt, i) => ({ text: opt, isCorrect: i === correctIdx }));
        const shuffled = shuffleArray(mapped);
        options = shuffled.map(o => o.text);
        correctIdx = shuffled.findIndex(o => o.isCorrect);
      }

      return {
        ...q,
        quizIndex: idx,
        displayOptions: options,
        displayAnswer: correctIdx
      };
    });

    state.currentIndex = 0;
    state.userAnswers = {};
    state.flagged.clear();
    state.timerSeconds = 0;

    // Update Header Pill
    DOM.quizModePill.className = `quiz-mode-pill ${state.mode === 'study' ? 'mode-study-pill' : 'mode-exam-pill'}`;
    DOM.quizModePill.innerHTML = state.mode === 'study'
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg> Study Mode`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg> Exam Mode`;

    DOM.btnFinishQuiz.textContent = state.mode === 'study' ? 'End Session' : 'Submit Exam';

    startTimer();
    showView('quiz');
    renderCurrentQuestion();
    updatePaletteGrid();
    playSound('click');
  }

  // Timer
  function startTimer() {
    stopTimer();
    state.startTime = Date.now();
    updateTimerText();
    state.timerInterval = setInterval(() => {
      state.timerSeconds++;
      updateTimerText();
    }, 1000);
  }

  function stopTimer() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
  }

  function updateTimerText() {
    const mins = Math.floor(state.timerSeconds / 60);
    const secs = state.timerSeconds % 60;
    DOM.timerDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  // Render Current Question
  function renderCurrentQuestion() {
    const q = state.quizQuestions[state.currentIndex];
    if (!q) return;

    const total = state.quizQuestions.length;
    const currentNum = state.currentIndex + 1;

    // Progress bar & text
    const pct = Math.round((currentNum / total) * 100);
    DOM.progressFill.style.width = `${pct}%`;
    DOM.progressText.textContent = `Question ${currentNum} of ${total}`;
    DOM.qNumberText.textContent = `Question ${currentNum}`;

    // Badges
    DOM.qYearBadge.textContent = `Year ${q.year}`;
    DOM.qWeekBadge.textContent = q.week || 'Assignment';

    // Flag button state
    if (state.flagged.has(state.currentIndex)) {
      DOM.btnFlag.classList.add('flagged');
    } else {
      DOM.btnFlag.classList.remove('flagged');
    }

    // Question Text
    DOM.questionText.textContent = q.question;

    // Options List
    DOM.optionsList.innerHTML = '';
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const currentAnswer = state.userAnswers[state.currentIndex];
    const isAnswered = currentAnswer !== undefined;

    q.displayOptions.forEach((optText, optIdx) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.type = 'button';

      const prefix = document.createElement('div');
      prefix.className = 'opt-prefix';
      prefix.textContent = letters[optIdx] || String(optIdx + 1);

      const spanText = document.createElement('span');
      spanText.className = 'opt-text';
      spanText.textContent = optText;

      btn.appendChild(prefix);
      btn.appendChild(spanText);

      // Mode-specific styling
      if (state.mode === 'study') {
        if (isAnswered) {
          btn.disabled = true;
          if (optIdx === q.displayAnswer) {
            btn.classList.add('correct');
          } else if (optIdx === currentAnswer) {
            btn.classList.add('incorrect');
          }
        }
      } else {
        // Exam mode
        if (currentAnswer === optIdx) {
          btn.classList.add('selected');
        }
      }

      btn.addEventListener('click', () => {
        selectOption(optIdx);
      });

      DOM.optionsList.appendChild(btn);
    });

    // Study Mode Explanation
    if (state.mode === 'study') {
      DOM.studyScoreTracker.style.display = 'block';
      updateStudyScoreTracker();

      if (isAnswered) {
        DOM.explanationBox.classList.add('show');
        const isRight = currentAnswer === q.displayAnswer;
        const letterAns = letters[q.displayAnswer];
        let expHtml = `<strong>Correct Answer: Option ${letterAns} (${q.displayOptions[q.displayAnswer]})</strong>`;
        if (q.explanation) {
          expHtml += `<br><span style="margin-top: 6px; display: inline-block;">${q.explanation}</span>`;
        }
        DOM.explanationSolutionText.innerHTML = expHtml;
      } else {
        DOM.explanationBox.classList.remove('show');
      }
    } else {
      DOM.studyScoreTracker.style.display = 'none';
      DOM.explanationBox.classList.remove('show');
    }

    // Navigation buttons state
    DOM.btnPrev.disabled = state.currentIndex === 0;
    DOM.btnNext.style.display = state.currentIndex === total - 1 ? 'none' : 'inline-flex';

    updatePaletteGrid();
  }

  // Handle Option Selection
  function selectOption(optIdx) {
    const q = state.quizQuestions[state.currentIndex];
    if (!q) return;

    if (state.mode === 'study' && state.userAnswers[state.currentIndex] !== undefined) {
      return; // Already answered in study mode
    }

    state.userAnswers[state.currentIndex] = optIdx;

    if (state.mode === 'study') {
      const isCorrect = optIdx === q.displayAnswer;
      playSound(isCorrect ? 'correct' : 'incorrect');
      renderCurrentQuestion();
    } else {
      playSound('click');
      renderCurrentQuestion();
    }

    updatePaletteGrid();
  }

  // Study Mode Score Tracker
  function updateStudyScoreTracker() {
    const answeredCount = Object.keys(state.userAnswers).length;
    let correctCount = 0;

    Object.entries(state.userAnswers).forEach(([idx, ansIdx]) => {
      const q = state.quizQuestions[parseInt(idx)];
      if (q && ansIdx === q.displayAnswer) {
        correctCount++;
      }
    });

    const accuracy = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;
    DOM.studyScoreTracker.innerHTML = `
      <span>Attempted: <strong>${answeredCount}/${state.quizQuestions.length}</strong></span>
      <span style="margin: 0 8px;">•</span>
      <span>Correct: <strong style="color: var(--success-text);">${correctCount}</strong></span>
      <span style="margin: 0 8px;">•</span>
      <span>Accuracy: <strong>${accuracy}%</strong></span>
    `;
  }

  // Update Palette Grid
  function updatePaletteGrid() {
    DOM.paletteGrid.innerHTML = '';
    const total = state.quizQuestions.length;

    for (let i = 0; i < total; i++) {
      const btn = document.createElement('button');
      btn.className = 'palette-btn';
      btn.textContent = i + 1;
      btn.type = 'button';

      if (i === state.currentIndex) {
        btn.classList.add('current');
      }

      const hasAnswer = state.userAnswers[i] !== undefined;
      const isFlagged = state.flagged.has(i);

      if (isFlagged) {
        btn.classList.add('flagged');
      }

      if (state.mode === 'study') {
        if (hasAnswer) {
          const q = state.quizQuestions[i];
          if (state.userAnswers[i] === q.displayAnswer) {
            btn.classList.add('p-correct');
          } else {
            btn.classList.add('p-incorrect');
          }
        }
      } else {
        if (hasAnswer) {
          btn.classList.add('answered');
        }
      }

      btn.addEventListener('click', () => {
        state.currentIndex = i;
        renderCurrentQuestion();
        playSound('click');
      });

      DOM.paletteGrid.appendChild(btn);
    }
  }

  // Finish / Submit Exam Request
  function handleFinishExamRequest() {
    const total = state.quizQuestions.length;
    const answered = Object.keys(state.userAnswers).length;
    const unanswered = total - answered;

    if (state.mode === 'exam' && unanswered > 0) {
      showModal(
        'Submit Exam?',
        `You have <strong>${unanswered} unanswered</strong> question${unanswered > 1 ? 's' : ''}. Are you sure you want to finish and view your final score?`,
        () => {
          submitExam();
        }
      );
    } else {
      showModal(
        state.mode === 'exam' ? 'Submit Exam?' : 'Finish Session?',
        `Are you ready to see your comprehensive performance report?`,
        () => {
          submitExam();
        }
      );
    }
  }

  // Submit and Calculate Results
  function submitExam() {
    stopTimer();
    playSound('submit');

    const total = state.quizQuestions.length;
    let correct = 0;
    let incorrect = 0;
    let unanswered = 0;

    state.quizQuestions.forEach((q, idx) => {
      const ans = state.userAnswers[idx];
      if (ans === undefined) {
        unanswered++;
      } else if (ans === q.displayAnswer) {
        correct++;
      } else {
        incorrect++;
      }
    });

    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    // Display summary
    DOM.resultScoreText.textContent = correct;
    DOM.resultMaxText.textContent = `/ ${total}`;

    if (accuracy >= 80) {
      DOM.resultHeadline.textContent = 'Outstanding Performance! 🌟';
      DOM.resultDesc.textContent = 'You have mastered these psychology concepts with exceptional precision.';
    } else if (accuracy >= 60) {
      DOM.resultHeadline.textContent = 'Great Job! Keep it up! 👏';
      DOM.resultDesc.textContent = 'Solid grasp of the core materials. Review the missed questions below to solidify your knowledge.';
    } else {
      DOM.resultHeadline.textContent = 'Good Effort! Practice Makes Perfect 💪';
      DOM.resultDesc.textContent = 'Use the detailed question review below or study mode to revisit these topics.';
    }

    DOM.statTotal.textContent = total;
    DOM.statCorrect.textContent = correct;
    DOM.statIncorrect.textContent = incorrect;
    DOM.statUnanswered.textContent = unanswered;
    DOM.statAccuracy.textContent = `${accuracy}%`;

    const mins = Math.floor(state.timerSeconds / 60);
    const secs = state.timerSeconds % 60;
    DOM.statTime.textContent = `${mins}m ${secs}s`;

    state.reviewFilter = 'all';
    DOM.reviewFilterPills.forEach(p => {
      p.classList.toggle('active', p.getAttribute('data-filter') === 'all');
    });

    renderReviewList();
    showView('results');
  }

  // Render Detailed Question Review List
  function renderReviewList() {
    DOM.reviewList.innerHTML = '';
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

    state.quizQuestions.forEach((q, idx) => {
      const userAns = state.userAnswers[idx];
      const isCorrect = userAns === q.displayAnswer;
      const isUnanswered = userAns === undefined;

      // Filter check
      if (state.reviewFilter === 'correct' && !isCorrect) return;
      if (state.reviewFilter === 'incorrect' && (isCorrect || isUnanswered)) return;
      if (state.reviewFilter === 'unanswered' && !isUnanswered) return;

      const item = document.createElement('div');
      item.className = `review-item ${isUnanswered ? 'status-unanswered' : isCorrect ? 'status-correct' : 'status-incorrect'}`;

      let statusBadge = '';
      if (isUnanswered) {
        statusBadge = `<span style="color: var(--warning-text); font-weight: 700;">Skipped / Unanswered</span>`;
      } else if (isCorrect) {
        statusBadge = `<span style="color: var(--success-text); font-weight: 700;">✓ Correct</span>`;
      } else {
        statusBadge = `<span style="color: var(--error-text); font-weight: 700;">✗ Incorrect</span>`;
      }

      const meta = `
        <div class="review-meta">
          <div>Question ${idx + 1} • Year ${q.year} (${q.week || ''})</div>
          <div>${statusBadge}</div>
        </div>
      `;

      const title = `<div class="review-q-title">${q.question}</div>`;

      let optionsHtml = '<div class="review-options">';
      q.displayOptions.forEach((optText, oIdx) => {
        let optClass = 'review-opt';
        let badgeNote = '';

        if (oIdx === q.displayAnswer) {
          optClass += ' correct-answer';
          badgeNote = '<span style="font-size: 0.75rem; color: var(--success-text); font-weight: 700;">Correct Answer</span>';
        }
        if (!isCorrect && oIdx === userAns) {
          optClass += ' user-picked-wrong';
          badgeNote = '<span style="font-size: 0.75rem; color: var(--error-text); font-weight: 700;">Your Choice</span>';
        }

        optionsHtml += `
          <div class="${optClass}">
            <span><strong>${letters[oIdx]}.</strong> ${optText}</span>
            ${badgeNote}
          </div>
        `;
      });
      optionsHtml += '</div>';

      let explanationHtml = '';
      if (q.explanation) {
        explanationHtml = `
          <div class="review-solution">
            <strong>Notes / Solution:</strong> ${q.explanation}
          </div>
        `;
      }

      item.innerHTML = meta + title + optionsHtml + explanationHtml;
      DOM.reviewList.appendChild(item);
    });

    if (DOM.reviewList.children.length === 0) {
      DOM.reviewList.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 30px;">No questions match the "${state.reviewFilter}" filter.</div>`;
    }
  }

  // Simple Modal Helper
  let pendingModalConfirm = null;
  function showModal(title, msg, onConfirm) {
    DOM.modalTitle.textContent = title;
    DOM.modalMsg.innerHTML = msg;
    pendingModalConfirm = onConfirm;
    DOM.modalOverlay.classList.add('open');
  }

  function closeModal() {
    DOM.modalOverlay.classList.remove('open');
    pendingModalConfirm = null;
  }

  DOM.modalConfirmBtn.addEventListener('click', () => {
    if (pendingModalConfirm) pendingModalConfirm();
    closeModal();
  });

  DOM.modalCancelBtn.addEventListener('click', closeModal);
  DOM.modalOverlay.addEventListener('click', (e) => {
    if (e.target === DOM.modalOverlay) closeModal();
  });

  // Fisher-Yates Shuffle
  function shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // Run on load
  document.addEventListener('DOMContentLoaded', init);
})();

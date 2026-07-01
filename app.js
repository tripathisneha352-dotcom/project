/**
 * StudySync – Dashboard UI
 * Sidebar, animations, AI chat UI, quick actions, charts
 */

(function () {
  'use strict';

  // ── Quotes ──
  const QUOTES = [
    { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
    { text: 'Success is the sum of small efforts repeated day in and day out.', author: 'Robert Collier' },
    { text: 'Don\'t watch the clock; do what it does. Keep going.', author: 'Sam Levenson' },
    { text: 'The expert in anything was once a beginner.', author: 'Helen Hayes' },
    { text: 'It always seems impossible until it\'s done.', author: 'Nelson Mandela' },
  ];

  // ── Greeting ──
  function setGreeting() {
    const h = new Date().getHours();
    let greet = 'Good Evening';
    if (h < 12) greet = 'Good Morning';
    else if (h < 17) greet = 'Good Afternoon';
    const el = document.getElementById('welcome-title');
    if (el) el.textContent = `${greet}, Welcome Back!`;
  }

  // ── Date in topbar ──
  function setTopbarDate() {
    const el = document.getElementById('topbar-date');
    if (!el) return;
    const d = new Date();
    el.textContent = d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  // ── Daily quote (consistent per day) ──
  function setDailyQuote() {
    const day = Math.floor(Date.now() / 86400000);
    const q = QUOTES[day % QUOTES.length];
    const quoteEl = document.getElementById('daily-quote');
    const authorEl = document.getElementById('quote-author');
    if (quoteEl) quoteEl.textContent = `"${q.text}"`;
    if (authorEl) authorEl.textContent = `— ${q.author}`;
  }

  // ── Animate stat counters from real values ──
  function animateStatCounters() {
    document.querySelectorAll('.stat-value[data-count]').forEach(el => {
      const target = parseFloat(el.dataset.count) || 0;
      const isFloat = target % 1 !== 0;
      const duration = 800;
      const start = performance.now();
      function tick(now) {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        const val = target * eased;
        el.textContent = isFloat ? val.toFixed(1) : Math.round(val);
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  window.addEventListener('studysync-data-changed', () => {
    setTimeout(animateStatCounters, 50);
  });

  // ── Sidebar ──
  function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebar-toggle');
    const mobileBtn = document.getElementById('mobile-menu-btn');

    toggle?.addEventListener('click', () => sidebar?.classList.toggle('collapsed'));
    mobileBtn?.addEventListener('click', () => sidebar?.classList.toggle('open'));

    // Active nav on scroll
    const sections = document.querySelectorAll('.content-section, #planner-section');
    const navItems = document.querySelectorAll('.nav-item');

    function setActiveNav() {
      let current = '';
      sections.forEach(sec => {
        const top = sec.offsetTop - 120;
        if (window.scrollY >= top) current = sec.id;
      });
      navItems.forEach(item => {
        item.classList.toggle('active', item.dataset.section === current);
      });
    }

    window.addEventListener('scroll', setActiveNav, { passive: true });
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        if (window.innerWidth <= 1024) sidebar?.classList.remove('open');
      });
    });
  }

  // ── Theme toggle (light default · night optional) ──
  function initThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    const settingNight = document.getElementById('setting-night-theme');
    const saved = localStorage.getItem('studysync_theme');

    function applyNight(on) {
      document.body.classList.toggle('night-theme', on);
      if (btn) btn.textContent = on ? '☀️' : '🌙';
      if (settingNight) settingNight.checked = on;
      localStorage.setItem('studysync_theme', on ? 'night' : 'light');
    }

    applyNight(saved === 'night');

    btn?.addEventListener('click', () => applyNight(!document.body.classList.contains('night-theme')));
    settingNight?.addEventListener('change', e => applyNight(e.target.checked));
  }

  // ── Ripple on buttons ──
  function addRipple(e) {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'ripple-effect';
    const size = Math.max(rect.width, rect.height);
    ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px`;
    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  }

  document.querySelectorAll('.glass-btn, .quick-fab, .send-btn').forEach(btn => {
    btn.style.position = 'relative';
    btn.style.overflow = 'hidden';
    btn.addEventListener('click', addRipple);
  });

  // ── AI Chat UI ──
  function initAIChat() {
    const input = document.getElementById('ai-input');
    const sendBtn = document.getElementById('ai-send-btn');
    const chatArea = document.getElementById('ai-chat-area');
    let hasShownWelcome = false;

    function showWelcomeIfEmpty() {
      if (hasShownWelcome || !chatArea || chatArea.children.length) return;
      hasShownWelcome = true;
      const div = document.createElement('div');
      div.className = 'ai-message bot';
      div.innerHTML = '<p>Ask a question or upload a file to get started. No messages until you interact.</p>';
      chatArea.appendChild(div);
    }

    function typeMessage(container, text, isBot = true) {
      const div = document.createElement('div');
      div.className = `ai-message ${isBot ? 'bot' : 'user'}`;
      const p = document.createElement('p');
      div.appendChild(p);
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;

      if (!isBot) { p.textContent = text; return; }

      let i = 0;
      const speed = 18;
      function type() {
        if (i < text.length) {
          p.textContent += text[i++];
          container.scrollTop = container.scrollHeight;
          setTimeout(type, speed);
        }
      }
      type();
    }

    function sendMessage(text) {
      if (!text.trim() || !chatArea) return;
      typeMessage(chatArea, text, false);
      input.value = '';

      setTimeout(() => {
        const replies = {
          'summarize my notes': 'I\'d be happy to summarize your notes! Upload a PDF or .txt file using the 📎 button, then click "Generate Summary".',
          'explain this topic': 'Tell me which topic you\'d like explained, or upload your study material and I\'ll break it down for you.',
          'generate mcqs': 'Upload your study material and click "Generate Quiz" — I\'ll create multiple-choice questions for you.',
          'create flashcards': 'Head to the Flashcards section — upload your PDF and click "Generate Flashcards" for pastel study cards!',
          'make a study plan': 'Based on your calendar, I suggest focusing on high-priority tasks in the morning. Check the Calendar Planner for today\'s schedule!',
        };
        const key = text.toLowerCase();
        const reply = replies[key] || `I received your message: "${text}". Upload a file or use the suggested actions below to get started!`;
        typeMessage(chatArea, reply, true);
      }, 600);
    }

    sendBtn?.addEventListener('click', () => {
      showWelcomeIfEmpty();
      sendMessage(input?.value || '');
    });
    input?.addEventListener('focus', showWelcomeIfEmpty);
    input?.addEventListener('keydown', e => {
      if (e.key === 'Enter') { showWelcomeIfEmpty(); sendMessage(input.value); }
    });

    document.querySelectorAll('.prompt-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        showWelcomeIfEmpty();
        const prompt = chip.dataset.prompt || chip.textContent;
        if (input) input.value = prompt;
        sendMessage(prompt);
      });
    });

    document.getElementById('mic-btn')?.addEventListener('click', () => {
      showWelcomeIfEmpty();
      typeMessage(chatArea, 'Voice input coming soon! Type your question for now.', true);
    });
  }

  // ── Quick Actions FAB ──
  function initQuickActions() {
    const fab = document.getElementById('quick-fab');
    const menu = document.getElementById('quick-actions-menu');

    fab?.addEventListener('click', () => {
      menu?.classList.toggle('hidden');
      fab.classList.toggle('open');
    });

    document.querySelectorAll('.quick-action-item').forEach(item => {
      item.addEventListener('click', () => {
        menu?.classList.add('hidden');
        fab?.classList.remove('open');
        const action = item.dataset.action;
        const targets = {
          note: '#recent-notes',
          pdf: '#pdf-section',
          ai: '#ai-assistant',
          flashcard: '#flashcards',
          quiz: '#ai-assistant',
          task: '#planner-section',
        };
        const sel = targets[action];
        if (sel) document.querySelector(sel)?.scrollIntoView({ behavior: 'smooth' });
        if (action === 'pdf') document.getElementById('pdf-file-input')?.click();
        if (action === 'task') document.getElementById('fab-add-task')?.click();
      });
    });

    document.addEventListener('click', e => {
      if (!e.target.closest('.quick-fab-wrap')) {
        menu?.classList.add('hidden');
        fab?.classList.remove('open');
      }
    });
  }

  // ── Timer ring sync (called from script.js) ──
  const TIMER_CIRCUMFERENCE = 2 * Math.PI * 90;

  window.updateTimerRing = function (remainingSeconds, totalSeconds) {
    const ring = document.getElementById('timer-ring-progress');
    const label = document.getElementById('timer-session-label');
    if (!ring) return;
    const pct = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;
    ring.style.strokeDasharray = TIMER_CIRCUMFERENCE;
    ring.style.strokeDashoffset = TIMER_CIRCUMFERENCE * (1 - pct);
    if (label) label.textContent = window._isStudySession !== false ? 'Focus Session' : 'Break Time';
  };

  // ── Global search ──
  function initSearch() {
    const search = document.getElementById('global-search');
    search?.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const q = search.value.toLowerCase();
      const map = {
        timer: '#focus-timer', focus: '#focus-timer', pomodoro: '#focus-timer',
        calendar: '#planner-section', planner: '#planner-section', task: '#planner-section',
        note: '#recent-notes', ai: '#ai-assistant', quiz: '#ai-assistant', pdf: '#pdf-section',
        progress: '#analytics', subject: '#study-progress', goal: '#goals',
        buddy: '#studybuddy', studybuddy: '#studybuddy', wellness: '#mental-burnout', burnout: '#mental-burnout',
        sound: 'sound.html', settings: '#settings', profile: '#profile', flashcard: '#flashcards',
      };
      for (const [key, target] of Object.entries(map)) {
        if (q.includes(key)) {
          if (target.startsWith('#')) document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' });
          else window.location.href = target;
          return;
        }
      }
    });
  }

  // ── Open note cards handled by userdata.js ──

  // ── Init ──
  document.addEventListener('DOMContentLoaded', () => {
    setGreeting();
    setTopbarDate();
    setDailyQuote();
    initSidebar();
    initThemeToggle();
    initAIChat();
    initQuickActions();
    initSearch();

    document.getElementById('profile-btn')?.addEventListener('click', () => {
      document.querySelector('#profile')?.scrollIntoView({ behavior: 'smooth' });
    });
  });
})();

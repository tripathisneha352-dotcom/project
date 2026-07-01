/**
 * StudySync – AI Flashcards from PDF
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'studysync_flashcards_v1';
  const COLORS = ['lavender', 'blush', 'blue', 'mint', 'cream'];

  let deck = { name: '', cards: [], unclearSections: [], sourceNote: '' };
  let currentIndex = 0;
  let isFlipped = false;

  function loadDeck() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) deck = JSON.parse(raw);
    } catch { /* keep default */ }
  }

  function saveDeck() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deck));
  }

  function renderMarkdownLite(text) {
    if (!text) return '';
    const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
    return parts.map(p => {
      if (p.startsWith('**') && p.endsWith('**')) {
        return '<strong>' + escapeHtml(p.slice(2, -2)) + '</strong>';
      }
      return escapeHtml(p).replace(/\n/g, '<br>');
    }).join('');
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function normalizeColor(c) {
    return COLORS.includes(c) ? c : COLORS[0];
  }

  function setLoading(on, msg) {
    const el = document.getElementById('flashcards-loader');
    const txt = document.getElementById('flashcards-loader-text');
    if (!el) return;
    el.classList.toggle('hidden', !on);
    if (txt) txt.textContent = msg || 'Generating flashcards from your PDF...';
  }

  function setStatus(msg, isError) {
    const el = document.getElementById('flashcards-status');
    if (!el) return;
    el.textContent = msg || '';
    el.style.color = isError ? 'var(--error)' : 'var(--success)';
    el.classList.toggle('hidden', !msg);
  }

  function render() {
    const empty = document.getElementById('flashcards-empty');
    const viewer = document.getElementById('flashcards-viewer');
    const controls = document.getElementById('flashcards-controls');
    const header = document.getElementById('flashcards-deck-header');
    const preview = document.getElementById('flashcards-grid-preview');
    const notes = document.getElementById('flashcards-notes');

    if (!deck.cards.length) {
      empty?.classList.remove('hidden');
      viewer?.classList.add('hidden');
      controls?.classList.add('hidden');
      header?.classList.add('hidden');
      preview?.classList.add('hidden');
      notes?.classList.add('hidden');
      document.getElementById('flashcards-progress-wrap')?.classList.add('hidden');
      return;
    }

    empty?.classList.add('hidden');
    viewer?.classList.remove('hidden');
    controls?.classList.remove('hidden');
    header?.classList.remove('hidden');
    preview?.classList.remove('hidden');
    document.getElementById('flashcards-progress-wrap')?.classList.remove('hidden');

    const card = deck.cards[currentIndex];
    const color = normalizeColor(card.color);
    const emoji = card.emoji || '🌸';
    const num = card.number || currentIndex + 1;

    document.getElementById('flashcards-deck-title').textContent = deck.name || 'Study Deck';
    document.getElementById('flashcards-deck-meta').textContent =
      `${deck.cards.length} cards · Tap card to flip`;

    const pct = ((currentIndex + 1) / deck.cards.length) * 100;
    const fill = document.getElementById('flashcards-progress-fill');
    if (fill) fill.style.width = pct + '%';

    const flip = document.getElementById('flashcard-3d');
    if (flip) {
      flip.classList.toggle('flipped', isFlipped);
      flip.innerHTML = `
        <div class="flashcard-face ${color} front">
          <div class="flashcard-number">${emoji} Flashcard #${num}</div>
          <div class="flashcard-label">Front</div>
          <div class="flashcard-content">${renderMarkdownLite(card.front)}</div>
        </div>
        <div class="flashcard-face ${color} back">
          <div class="flashcard-number">${emoji} Flashcard #${num}</div>
          <div class="flashcard-label">Back</div>
          <div class="flashcard-content">${renderMarkdownLite(card.back)}</div>
          ${card.memoryTip ? `<div class="flashcard-tip">💡 ${escapeHtml(card.memoryTip)}</div>` : ''}
        </div>`;
    }

    document.getElementById('flashcards-counter').textContent =
      `${currentIndex + 1} / ${deck.cards.length}`;

    if (notes) {
      const parts = [];
      if (deck.sourceNote) parts.push(deck.sourceNote);
      if (deck.unclearSections?.length) {
        parts.push('Unclear sections: ' + deck.unclearSections.join('; '));
      }
      if (parts.length) {
        notes.textContent = parts.join(' · ');
        notes.classList.remove('hidden');
      } else {
        notes.classList.add('hidden');
      }
    }

    if (preview) {
      preview.innerHTML = deck.cards.map((c, i) => `
        <div class="flashcard-mini ${normalizeColor(c.color)}${i === currentIndex ? ' active' : ''}" data-idx="${i}">
          ${c.emoji || '✨'} #${c.number || i + 1}
        </div>`).join('');
      preview.querySelectorAll('.flashcard-mini').forEach(el => {
        el.addEventListener('click', () => {
          currentIndex = parseInt(el.dataset.idx, 10);
          isFlipped = false;
          render();
        });
      });
    }
  }

  function goTo(delta) {
    if (!deck.cards.length) return;
    isFlipped = false;
    currentIndex = (currentIndex + delta + deck.cards.length) % deck.cards.length;
    render();
  }

  function shuffleDeck() {
    for (let i = deck.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck.cards[i], deck.cards[j]] = [deck.cards[j], deck.cards[i]];
    }
    currentIndex = 0;
    isFlipped = false;
    saveDeck();
    render();
  }

  function clearDeck() {
    if (!deck.cards.length || !confirm('Clear all saved flashcards?')) return;
    deck = { name: '', cards: [], unclearSections: [], sourceNote: '' };
    currentIndex = 0;
    isFlipped = false;
    localStorage.removeItem(STORAGE_KEY);
    render();
    setStatus('');
  }

  async function generateFlashcards() {
    if (window.location.protocol === 'file:') {
      alert('Open StudySync via http://localhost:3000 (run "npm start" in the backend folder).');
      return;
    }

    const buildBody = window.buildRequestBody;
    const body = buildBody ? buildBody('flashcards') : null;
    if (!body) {
      alert('Upload a PDF or text file first (here or in the PDF section).');
      document.getElementById('flashcard-file-input')?.click();
      return;
    }

    const apiBase = typeof window.API_BASE_URL !== 'undefined'
      ? window.API_BASE_URL
      : (window.location.port === '3000' ? '' : 'http://localhost:3000');

    setLoading(true);
    setStatus('');

    try {
      const res = await fetch(`${apiBase}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const rawText = await res.text();
      let data = null;
      try { data = rawText ? JSON.parse(rawText) : null; } catch { /* */ }

      if (!res.ok) {
        throw new Error(data?.error || 'Server returned an error.');
      }

      if (!data?.flashcards?.length) {
        throw new Error('No flashcards were generated. Try a different PDF.');
      }

      const fileName = (window.uploadedFileData && window.uploadedFileData.name) || 'Study Deck';
      deck = {
        name: fileName.replace(/\.[^.]+$/, ''),
        cards: data.flashcards.map((c, i) => ({
          number: c.number || i + 1,
          emoji: c.emoji || ['🌸', '✨', '📖', '☁️', '🧸', '⭐'][i % 6],
          front: c.front || '',
          back: c.back || '',
          memoryTip: c.memoryTip || '',
          color: normalizeColor(c.color || COLORS[i % COLORS.length]),
        })),
        unclearSections: data.unclearSections || [],
        sourceNote: data.sourceNote || '',
      };

      currentIndex = 0;
      isFlipped = false;
      saveDeck();
      render();
      setStatus(`✅ Generated ${deck.cards.length} flashcards!`);
    } catch (err) {
      console.error(err);
      const msg = err.message?.includes('Failed to fetch')
        ? 'Backend not reachable. Run: cd backend && npm start'
        : err.message;
      setStatus('❌ ' + msg, true);
    } finally {
      setLoading(false);
    }
  }

  function handleFlashcardUpload(event) {
    if (typeof window.handleFileUpload === 'function') {
      window.handleFileUpload(event);
    }
    const file = event?.target?.files?.[0];
    if (file) setStatus(`📄 ${file.name} ready — click Generate Flashcards`);
  }

  function init() {
    loadDeck();
    render();

    document.getElementById('flashcard-generate-btn')?.addEventListener('click', generateFlashcards);
    document.getElementById('flashcard-prev-btn')?.addEventListener('click', () => goTo(-1));
    document.getElementById('flashcard-next-btn')?.addEventListener('click', () => goTo(1));
    document.getElementById('flashcard-shuffle-btn')?.addEventListener('click', shuffleDeck);
    document.getElementById('flashcard-clear-btn')?.addEventListener('click', clearDeck);
    document.getElementById('flashcard-file-input')?.addEventListener('change', handleFlashcardUpload);
    document.getElementById('flashcard-upload-btn')?.addEventListener('click', () => {
      document.getElementById('flashcard-file-input')?.click();
    });

    document.getElementById('flashcards-viewer')?.addEventListener('click', () => {
      isFlipped = !isFlipped;
      document.getElementById('flashcard-3d')?.classList.toggle('flipped', isFlipped);
    });

    document.addEventListener('keydown', e => {
      if (!document.getElementById('flashcards')?.getBoundingClientRect) return;
      const rect = document.getElementById('flashcards')?.getBoundingClientRect();
      if (!rect || rect.top > window.innerHeight || rect.bottom < 0) return;
      if (e.key === 'ArrowLeft') goTo(-1);
      if (e.key === 'ArrowRight') goTo(1);
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        isFlipped = !isFlipped;
        document.getElementById('flashcard-3d')?.classList.toggle('flipped', isFlipped);
      }
    });
  }

  window.generateFlashcards = generateFlashcards;

  document.addEventListener('DOMContentLoaded', init);
})();

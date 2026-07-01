/**
 * StudySync – User Data Store
 * Persists all user-entered data in localStorage.
 * Designed for future database sync without UI changes.
 */

const USER_STORAGE_KEY = 'studysync_user_v1';

const SUBJECT_COLORS = ['#6366F1', '#8B5CF6', '#3B82F6', '#22C55E', '#F59E0B', '#EF4444'];

class UserDataStore {
  constructor() {
    this._data = this._load();
    this._listeners = [];
  }

  _load() {
    try {
      const raw = localStorage.getItem(USER_STORAGE_KEY);
      if (!raw) return this._default();
      const parsed = JSON.parse(raw);
      const def = this._default();
      return {
        ...def,
        ...parsed,
        profile: { ...def.profile, ...(parsed.profile || {}) },
        settings: { ...def.settings, ...(parsed.settings || {}) },
        notes: { ...def.notes, ...(parsed.notes || {}), saved: parsed.notes?.saved || [] },
        todos: parsed.todos || [],
        timer: { ...def.timer, ...(parsed.timer || {}), dailyLog: parsed.timer?.dailyLog || {} },
        subjects: parsed.subjects || [],
      };
    } catch {
      return this._default();
    }
  }

  _default() {
    return {
      profile: { name: '', email: '', initial: '' },
      settings: { notifications: true, autoSaveNotes: true },
      notes: { draft: '', saved: [] },
      todos: [],
      timer: { sessionsCompleted: 0, totalStudyMinutes: 0, dailyLog: {} },
      subjects: [],
    };
  }

  _persist() {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(this._data));
    this._listeners.forEach(fn => fn(this._data));
    window.dispatchEvent(new CustomEvent('studysync-data-changed'));
  }

  subscribe(fn) {
    this._listeners.push(fn);
    return () => { this._listeners = this._listeners.filter(l => l !== fn); };
  }

  getData() { return this._data; }

  clearAll() {
    this._data = this._default();
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem('studysync_planner_v1');
    localStorage.removeItem('studysync_pdf_library');
    localStorage.removeItem('studysync_flashcards_v1');
    this._persist();
  }

  // ── Profile ──
  setProfile(updates) {
    Object.assign(this._data.profile, updates);
    if (updates.name) {
      this._data.profile.initial = updates.name.charAt(0).toUpperCase();
    }
    this._persist();
  }

  // ── Settings ──
  setSetting(key, value) {
    this._data.settings[key] = value;
    this._persist();
  }

  // ── Notes ──
  setNotesDraft(text) {
    this._data.notes.draft = text;
    this._persist();
  }

  saveNote(title, subject, content) {
    const note = {
      id: Date.now().toString(36),
      title: title || 'Untitled Note',
      subject: subject || 'General',
      content,
      pinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this._data.notes.saved.unshift(note);
    this._data.notes.draft = '';
    this._persist();
    return note;
  }

  deleteNote(id) {
    this._data.notes.saved = this._data.notes.saved.filter(n => n.id !== id);
    this._persist();
  }

  togglePinNote(id) {
    const note = this._data.notes.saved.find(n => n.id === id);
    if (note) { note.pinned = !note.pinned; this._persist(); }
  }

  loadNoteIntoDraft(id) {
    const note = this._data.notes.saved.find(n => n.id === id);
    if (note) {
      this._data.notes.draft = note.content;
      this._persist();
      return note;
    }
    return null;
  }

  // ── Todos ──
  addTodo(text) {
    const todo = { id: Date.now().toString(36), text, completed: false, createdAt: new Date().toISOString() };
    this._data.todos.push(todo);
    this._persist();
    return todo;
  }

  toggleTodo(id) {
    const t = this._data.todos.find(x => x.id === id);
    if (t) { t.completed = !t.completed; this._persist(); }
  }

  deleteTodo(id) {
    this._data.todos = this._data.todos.filter(x => x.id !== id);
    this._persist();
  }

  // ── Timer ──
  logStudySession(minutes) {
    const key = new Date().toISOString().slice(0, 10);
    this._data.timer.sessionsCompleted += 1;
    this._data.timer.totalStudyMinutes += minutes;
    this._data.timer.dailyLog[key] = (this._data.timer.dailyLog[key] || 0) + minutes;
    this._persist();
  }

  getSessionsCompleted() { return this._data.timer.sessionsCompleted; }

  // ── Subjects ──
  addSubject(name, progress = 0) {
    const subject = {
      id: Date.now().toString(36),
      name,
      progress: Math.min(100, Math.max(0, progress)),
      color: SUBJECT_COLORS[this._data.subjects.length % SUBJECT_COLORS.length],
    };
    this._data.subjects.push(subject);
    this._persist();
    return subject;
  }

  updateSubjectProgress(id, progress) {
    const s = this._data.subjects.find(x => x.id === id);
    if (s) { s.progress = Math.min(100, Math.max(0, progress)); this._persist(); }
  }

  deleteSubject(id) {
    this._data.subjects = this._data.subjects.filter(x => x.id !== id);
    this._persist();
  }
}

// ── Read planner data for computed stats ──
function getPlannerData() {
  try {
    const raw = localStorage.getItem('studysync_planner_v1');
    return raw ? JSON.parse(raw) : { days: {} };
  } catch {
    return { days: {} };
  }
}

function computeStats(userData) {
  const planner = getPlannerData();
  let tasksDue = 0;
  let tasksCompleted = 0;
  let tasksTotal = 0;
  let plannerStudyMinutes = 0;
  const today = new Date().toISOString().slice(0, 10);

  Object.entries(planner.days || {}).forEach(([dateKey, day]) => {
    (day.tasks || []).forEach(t => {
      tasksTotal++;
      if (t.completed) tasksCompleted++;
      else if (dateKey >= today) tasksDue++;
    });
    (day.studySessions || []).forEach(s => {
      plannerStudyMinutes += s.durationMinutes || 0;
    });
  });

  const totalMinutes = userData.timer.totalStudyMinutes + plannerStudyMinutes;
  const hoursStudied = Math.round((totalMinutes / 60) * 10) / 10;

  const streak = calcStreak(userData.timer.dailyLog, planner.days);
  const productivity = tasksTotal > 0
    ? Math.round((tasksCompleted / tasksTotal) * 100)
    : (userData.timer.sessionsCompleted > 0 ? Math.min(100, userData.timer.sessionsCompleted * 10) : 0);

  return { hoursStudied, streak, tasksDue, productivity, tasksCompleted, totalMinutes };
}

function calcStreak(dailyLog, plannerDays) {
  const studyDays = new Set();
  Object.entries(dailyLog || {}).forEach(([d, min]) => { if (min > 0) studyDays.add(d); });
  Object.entries(plannerDays || {}).forEach(([d, day]) => {
    if ((day.tasks || []).some(t => t.completed) || (day.studySessions || []).length) studyDays.add(d);
  });
  if (!studyDays.size) return 0;

  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const key = d.toISOString().slice(0, 10);
    if (studyDays.has(key)) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}

function getWeeklyHours(dailyLog, plannerDays) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const result = [];
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    let minutes = dailyLog[key] || 0;
    const day = plannerDays?.[key];
    if (day?.studySessions) {
      minutes += day.studySessions.reduce((s, sess) => s + (sess.durationMinutes || 0), 0);
    }
    result.push({ label: days[d.getDay()], hours: Math.round((minutes / 60) * 10) / 10 });
  }
  return result;
}

function formatRelativeDate(iso) {
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff} days ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── UI Rendering ──
const userStore = new UserDataStore();
let notesFilterState = { search: '', subject: '', sort: 'updated' };

function renderDashboard() {
  const data = userStore.getData();
  const stats = computeStats(data);

  setStat('stat-hours', stats.hoursStudied, stats.hoursStudied % 1 !== 0);
  setStat('stat-streak', stats.streak);
  setStat('stat-tasks-due', stats.tasksDue);
  setStat('stat-productivity', stats.productivity);

  const trendHours = document.getElementById('trend-hours');
  const trendStreak = document.getElementById('trend-streak');
  const trendTasks = document.getElementById('trend-tasks');
  const trendProd = document.getElementById('trend-productivity');
  if (trendHours) trendHours.textContent = stats.totalMinutes > 0 ? `${stats.totalMinutes} min total` : 'Start a focus session';
  if (trendStreak) trendStreak.textContent = stats.streak > 0 ? `${stats.streak} day streak` : 'No streak yet';
  if (trendTasks) trendTasks.textContent = stats.tasksCompleted > 0 ? `${stats.tasksCompleted} completed` : 'Add tasks in planner';
  if (trendProd) trendProd.textContent = stats.productivity > 0 ? 'Based on your tasks' : 'Complete tasks to score';

  renderProfile(data, stats);
  renderSubjects(data.subjects);
  renderNotes(data.notes);
  renderTodos(data.todos);
  renderAnalytics(data, stats);
  renderDashboardWidgets(data, stats);
  renderPdfLibrary();
  loadNotesDraft(data.notes.draft);
  loadSettings(data.settings);
}

function setStat(id, value, isFloat = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.dataset.count = value;
  el.textContent = isFloat ? value.toFixed(1) : value;
}

function renderProfile(data, stats) {
  const name = data.profile.name || 'Your Name';
  const email = data.profile.email || 'Add your email in profile';
  const initial = data.profile.initial || (data.profile.name ? data.profile.name[0].toUpperCase() : '?');

  const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
  set('profile-name', name);
  set('profile-email', email);
  set('profile-avatar-lg', initial);
  set('topbar-avatar', initial);
  set('profile-hours', stats.hoursStudied + 'h');
  set('profile-streak', stats.streak);
  set('profile-score', stats.productivity + '%');

  const nameInput = document.getElementById('profile-name-input');
  const emailInput = document.getElementById('profile-email-input');
  if (nameInput) nameInput.value = data.profile.name;
  if (emailInput) emailInput.value = data.profile.email;
}

function renderSubjects(subjects) {
  const container = document.getElementById('subjects-container');
  const empty = document.getElementById('subjects-empty');
  if (!container) return;

  if (!subjects.length) {
    container.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');

  container.innerHTML = subjects.map(s => `
    <div class="subject-progress glass-card" data-id="${s.id}">
      <div class="subject-head">
        <span>${escapeHtml(s.name)}</span>
        <strong>${s.progress}%</strong>
      </div>
      <div class="progress-bar-track">
        <div class="progress-bar-fill" style="--bar-color:${s.color};width:${s.progress}%"></div>
      </div>
      <div class="subject-actions">
        <input type="range" min="0" max="100" value="${s.progress}" class="subject-slider" data-id="${s.id}" />
        <button class="glass-btn sm danger delete-subject-btn" data-id="${s.id}">Remove</button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.subject-slider').forEach(slider => {
    slider.addEventListener('input', e => {
      const id = e.target.dataset.id;
      const val = parseInt(e.target.value, 10);
      userStore.updateSubjectProgress(id, val);
      const card = e.target.closest('.subject-progress');
      card.querySelector('strong').textContent = val + '%';
      card.querySelector('.progress-bar-fill').style.width = val + '%';
    });
  });
  container.querySelectorAll('.delete-subject-btn').forEach(btn => {
    btn.addEventListener('click', () => userStore.deleteSubject(btn.dataset.id));
  });
}

function renderNotes(notes) {
  const grid = document.getElementById('notes-cards-grid');
  const empty = document.getElementById('notes-empty');
  if (!grid) return;

  updateNotesFilterOptions(notes);
  const sorted = getFilteredNotes(notes);

  if (!notes.saved.length) {
    grid.innerHTML = '';
    if (empty) { empty.classList.remove('hidden'); empty.querySelector('p').textContent = 'No notes yet. Write above and click "Save to Library".'; }
    return;
  }

  if (!sorted.length) {
    grid.innerHTML = '';
    if (empty) { empty.classList.remove('hidden'); empty.querySelector('p').textContent = 'No notes match your search.'; }
    return;
  }
  if (empty) empty.classList.add('hidden');

  grid.innerHTML = sorted.map(n => `
    <div class="note-card glass-card hover-lift" data-id="${n.id}">
      ${n.pinned ? '<span class="pin-icon">📌</span>' : ''}
      <h3>${escapeHtml(n.title)}</h3>
      <p class="note-preview">${escapeHtml(n.content)}</p>
      <p class="note-meta">${escapeHtml(n.subject)} · ${formatRelativeDate(n.updatedAt)}</p>
      <div class="note-card-actions">
        <button class="glass-btn sm open-note-btn" data-id="${n.id}">Open</button>
        <button class="glass-btn sm pin-note-btn" data-id="${n.id}">${n.pinned ? 'Unpin' : 'Pin'}</button>
        <button class="glass-btn sm danger delete-note-btn" data-id="${n.id}">Delete</button>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.open-note-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      userStore.loadNoteIntoDraft(btn.dataset.id);
      renderDashboard();
      document.getElementById('notes-area')?.focus();
    });
  });
  grid.querySelectorAll('.pin-note-btn').forEach(btn => {
    btn.addEventListener('click', () => userStore.togglePinNote(btn.dataset.id));
  });
  grid.querySelectorAll('.delete-note-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Delete this note?')) userStore.deleteNote(btn.dataset.id);
    });
  });
}

function renderTodos(todos) {
  const list = document.getElementById('todo-list');
  const empty = document.getElementById('todo-empty');
  if (!list) return;

  if (!todos.length) {
    list.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');

  list.innerHTML = todos.map(t => `
    <li class="${t.completed ? 'completed' : ''}" data-id="${t.id}">
      <span class="todo-text">${escapeHtml(t.text)}</span>
      <button class="todo-delete-btn" data-id="${t.id}" aria-label="Delete">✕</button>
    </li>
  `).join('');

  list.querySelectorAll('li').forEach(li => {
    li.addEventListener('click', e => {
      if (e.target.closest('.todo-delete-btn')) return;
      userStore.toggleTodo(li.dataset.id);
    });
  });
  list.querySelectorAll('.todo-delete-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      userStore.deleteTodo(btn.dataset.id);
    });
  });
}

function renderAnalytics(data, stats) {
  const planner = getPlannerData();
  const weekly = getWeeklyHours(data.timer.dailyLog, planner.days);
  const maxH = Math.max(...weekly.map(d => d.hours), 1);

  const chart = document.getElementById('weekly-chart');
  if (chart) {
    if (weekly.every(d => d.hours === 0)) {
      chart.innerHTML = '<p class="empty-state-inline">No study data yet. Complete a focus session to see your weekly chart.</p>';
    } else {
      chart.innerHTML = weekly.map(d => `
        <div class="bar-col">
          <div class="bar" style="height:${(d.hours / maxH) * 100}%"></div>
          <span>${d.label}</span>
        </div>
      `).join('');
    }
  }

  const subjects = data.subjects;
  const legend = document.getElementById('donut-legend');
  const donutSvg = document.getElementById('donut-svg');
  if (subjects.length && legend && donutSvg) {
    const total = subjects.reduce((s, x) => s + x.progress, 0) || 1;
    let offset = 0;
    const circumference = 2 * Math.PI * 50;
    const segments = subjects.map(s => {
      const pct = s.progress / total;
      const dash = pct * circumference;
      const seg = `<circle cx="60" cy="60" r="50" fill="none" stroke="${s.color}" stroke-width="14"
        stroke-dasharray="${dash} ${circumference}" stroke-dashoffset="${-offset}" class="donut-seg"/>`;
      offset += dash;
      return seg;
    }).join('');
    donutSvg.innerHTML = `
      <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(148,163,184,0.15)" stroke-width="14"/>
      ${segments}
    `;
    legend.innerHTML = subjects.map(s =>
      `<span><i style="background:${s.color}"></i>${escapeHtml(s.name)} ${s.progress}%</span>`
    ).join('');
  } else if (legend) {
    legend.innerHTML = '<span class="empty-state-inline">Add subjects to see distribution</span>';
    if (donutSvg) donutSvg.innerHTML = '<circle cx="60" cy="60" r="50" fill="none" stroke="rgba(148,163,184,0.15)" stroke-width="14"/>';
  }

  const ringLabel = document.getElementById('task-completion-label');
  const ringCircle = document.getElementById('task-completion-ring');
  if (ringLabel) ringLabel.textContent = stats.productivity + '%';
  if (ringCircle) {
    const c = 2 * Math.PI * 42;
    ringCircle.style.strokeDasharray = c;
    ringCircle.style.strokeDashoffset = c * (1 - stats.productivity / 100);
  }

  const sparkSvg = document.getElementById('sparkline-svg');
  if (sparkSvg) {
    const weeks = Object.values(data.timer.dailyLog || {});
    if (weeks.length < 2) {
      sparkSvg.innerHTML = '<text x="100" y="35" text-anchor="middle" fill="#94A3B8" font-size="10">No data yet</text>';
    } else {
      const vals = weeks.slice(-8);
      const max = Math.max(...vals, 1);
      const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * 200},${60 - (v / max) * 50}`).join(' ');
      sparkSvg.innerHTML = `<polyline class="spark-line" points="${pts}" fill="none" stroke="url(#sparkGrad)" stroke-width="2"/>`;
    }
  }
}

function loadNotesDraft(draft) {
  const area = document.getElementById('notes-area');
  if (area && area !== document.activeElement) area.value = draft || '';
}

function loadSettings(settings) {
  const notif = document.getElementById('setting-notifications');
  const autosave = document.getElementById('setting-autosave');
  if (notif) notif.checked = settings.notifications;
  if (autosave) autosave.checked = settings.autoSaveNotes;
}

function renderPdfLibrary() {
  const container = document.getElementById('pdf-cards-container');
  const empty = document.getElementById('pdf-empty');
  if (!container) return;

  let files = [];
  try {
    files = JSON.parse(localStorage.getItem('studysync_pdf_library') || '[]');
  } catch { files = []; }

  if (!files.length) {
    container.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  container.innerHTML = files.map(f => `
    <div class="pdf-card glass-card">
      <div class="pdf-card-icon">📄</div>
      <div>
        <h4>${escapeHtml(f.name)}</h4>
        <p>Uploaded ${formatRelativeDate(f.uploadedAt)}</p>
      </div>
    </div>
  `).join('');
}

function addPdfToLibrary(name) {
  let files = [];
  try { files = JSON.parse(localStorage.getItem('studysync_pdf_library') || '[]'); } catch { files = []; }
  files.unshift({ name, uploadedAt: new Date().toISOString() });
  localStorage.setItem('studysync_pdf_library', JSON.stringify(files.slice(0, 20)));
  renderPdfLibrary();
}

window.addPdfToLibrary = addPdfToLibrary;
window.renderPdfLibrary = renderPdfLibrary;

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function initUserDataUI() {
  userStore.subscribe(() => renderDashboard());
  window.addEventListener('studysync-data-changed', () => renderDashboard());

  document.getElementById('add-subject-btn')?.addEventListener('click', () => {
    const name = prompt('Subject name:');
    if (name?.trim()) userStore.addSubject(name.trim(), 0);
  });

  document.getElementById('save-note-btn')?.addEventListener('click', () => {
    const content = document.getElementById('notes-area')?.value?.trim();
    if (!content) { alert('Write something before saving.'); return; }
    const title = prompt('Note title:', 'Untitled Note') || 'Untitled Note';
    const subject = prompt('Subject (optional):', 'General') || 'General';
    userStore.saveNote(title, subject, content);
  });

  document.getElementById('profile-name-input')?.addEventListener('change', e => {
    userStore.setProfile({ name: e.target.value.trim() });
  });
  document.getElementById('profile-email-input')?.addEventListener('change', e => {
    userStore.setProfile({ email: e.target.value.trim() });
  });

  document.getElementById('setting-notifications')?.addEventListener('change', e => {
    userStore.setSetting('notifications', e.target.checked);
  });
  document.getElementById('setting-autosave')?.addEventListener('change', e => {
    userStore.setSetting('autoSaveNotes', e.target.checked);
  });

  document.getElementById('clear-all-data-btn')?.addEventListener('click', () => {
    if (confirm('Delete ALL your StudySync data? This cannot be undone.')) {
      userStore.clearAll();
      location.reload();
    }
  });

  let notesDebounce;
  document.getElementById('notes-area')?.addEventListener('input', e => {
    if (!userStore.getData().settings.autoSaveNotes) return;
    clearTimeout(notesDebounce);
    notesDebounce = setTimeout(() => userStore.setNotesDraft(e.target.value), 500);
  });

  document.getElementById('notes-search-input')?.addEventListener('input', e => {
    notesFilterState.search = e.target.value;
    renderNotes(userStore.getData().notes);
  });

  document.getElementById('notes-filter-subject')?.addEventListener('change', e => {
    notesFilterState.subject = e.target.value;
    renderNotes(userStore.getData().notes);
  });

  document.getElementById('notes-sort')?.addEventListener('change', e => {
    notesFilterState.sort = e.target.value;
    renderNotes(userStore.getData().notes);
  });

  renderDashboard();
}

window.userStore = userStore;
window.renderDashboard = renderDashboard;

document.addEventListener('DOMContentLoaded', initUserDataUI);

function renderDashboardWidgets(data, stats) {
  const planner = getPlannerData();
  const today = new Date().toISOString().slice(0, 10);
  const todayDay = planner.days?.[today] || { tasks: [], studySessions: [] };

  renderWidget('dash-notes-widget', data.notes.saved.slice(0, 4).map(n =>
    `<li><span>${escapeHtml(n.title)}</span><span class="meta">${formatRelativeDate(n.updatedAt)}</span></li>`
  ), 'No notes yet.', '📝');

  const todayTasks = todayDay.tasks?.filter(t => !t.completed) || [];
  renderWidget('dash-tasks-widget', todayTasks.slice(0, 4).map(t =>
    `<li><span>${escapeHtml(t.title)}</span><span class="meta">${t.time || 'Today'}</span></li>`
  ), 'No tasks due today.', '📋');

  const sessions = todayDay.studySessions || [];
  renderWidget('dash-sessions-widget', sessions.slice(0, 4).map(s =>
    `<li><span>${escapeHtml(s.subject || 'Study')}</span><span class="meta">${s.durationMinutes || 0}m</span></li>`
  ), 'No study sessions scheduled.', '⏱️');

  renderWidget('dash-subjects-widget', data.subjects.slice(0, 4).map(s =>
    `<li><span>${escapeHtml(s.name)}</span><span class="meta">${s.progress}%</span></li>`
  ), 'Create your first study plan.', '📚');

  const wellnessSessions = document.getElementById('wellness-sessions');
  const wellnessStreak = document.getElementById('wellness-streak');
  const wellnessHours = document.getElementById('wellness-hours');
  if (wellnessSessions) wellnessSessions.textContent = data.timer.sessionsCompleted;
  if (wellnessStreak) wellnessStreak.textContent = stats.streak;
  if (wellnessHours) wellnessHours.textContent = stats.hoursStudied + 'h';
}

function renderWidget(id, items, emptyMsg, icon) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!items.length) {
    el.innerHTML = `<div class="widget-empty"><span class="empty-icon">${icon}</span>${emptyMsg}</div>`;
    return;
  }
  el.innerHTML = `<ul class="widget-list">${items.join('')}</ul>`;
}

function getFilteredNotes(notes) {
  let list = [...notes.saved];
  const q = notesFilterState.search.toLowerCase();
  if (q) {
    list = list.filter(n =>
      n.title.toLowerCase().includes(q) ||
      n.subject.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q)
    );
  }
  if (notesFilterState.subject) {
    list = list.filter(n => n.subject === notesFilterState.subject);
  }
  const sort = notesFilterState.sort;
  list.sort((a, b) => {
    if (a.pinned !== b.pinned) return b.pinned - a.pinned;
    if (sort === 'title') return a.title.localeCompare(b.title);
    if (sort === 'created') return new Date(b.createdAt) - new Date(a.createdAt);
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });
  return list;
}

function updateNotesFilterOptions(notes) {
  const select = document.getElementById('notes-filter-subject');
  if (!select) return;
  const subjects = [...new Set(notes.saved.map(n => n.subject).filter(Boolean))];
  const current = notesFilterState.subject;
  select.innerHTML = '<option value="">All subjects</option>' +
    subjects.map(s => `<option value="${escapeHtml(s)}"${s === current ? ' selected' : ''}>${escapeHtml(s)}</option>`).join('');
}


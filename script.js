/**
 * Smart Study Assistant - Frontend Logic
 * Features:
 * 1) Pomodoro timer
 * 2) Focus & relax sounds
 * 3) Gemini powered summary + quiz generation
 * 4) Student burnout check scoring
 */

// -----------------------------
// 1) Timer Elements + State
// -----------------------------
const timeDisplay = document.getElementById('time-display');
const studyInput = document.getElementById('study-input');
const breakInput = document.getElementById('break-input');
const startBtn = document.getElementById('start-btn');
const breakBtn = document.getElementById('break-btn');
const pauseBtn = document.getElementById('pause-btn');
const resetBtn = document.getElementById('reset-btn');
const sessionCountEl = document.getElementById('session-count');
const rewardMessageEl = document.getElementById('reward-message');

const popupModal = document.getElementById('popup-modal');
const popupTitle = document.getElementById('popup-title');
const popupText = document.getElementById('popup-text');
const closePopupBtn = document.getElementById('close-popup-btn');

const alarmSound = new Audio('https://www.soundjay.com/buttons/beep-07.wav');

let timerInterval = null;
let timeRemaining = 25 * 60;
let isPaused = false;
let isStudySession = true;
let sessionsCompleted = 0;

const rewardMessages = [
    "🔥 You're doing great! Keep it up!",
    '🚀 Fantastic focus!',
    '⭐ One step closer to your goals!',
    '🎓 Amazing work, future engineer!',
    '🌱 Consistency is key. Well done!'
];

function updateButtonLabels() {
    const studyTime = studyInput.value || 25;
    const breakTime = breakInput.value || 5;
    startBtn.textContent = `Start Focus (${studyTime}m)`;
    breakBtn.textContent = `Short Break (${breakTime}m)`;
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function updateDisplay() {
    timeDisplay.textContent = formatTime(Math.max(0, timeRemaining));
}

function timerTick() {
    timeRemaining -= 1;
    updateDisplay();

    if (timeRemaining <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        handleTimerComplete();
    }
}

function startTimer(minutes, isStudy) {
    if (!Number(minutes) || Number(minutes) <= 0) {
        return;
    }

    clearInterval(timerInterval);
    timerInterval = null;

    isStudySession = isStudy;
    isPaused = false;
    pauseBtn.textContent = 'Pause';

    timeRemaining = Number(minutes) * 60;
    updateDisplay();

    startBtn.disabled = true;
    breakBtn.disabled = true;
    rewardMessageEl.textContent = '';

    timerInterval = setInterval(timerTick, 1000);
}

function pauseTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        isPaused = true;
        pauseBtn.textContent = 'Resume';
    } else if (isPaused) {
        timerInterval = setInterval(timerTick, 1000);
        isPaused = false;
        pauseBtn.textContent = 'Pause';
    }
}

function handleTimerComplete() {
    startBtn.disabled = false;
    breakBtn.disabled = false;

    if (isStudySession) {
        sessionsCompleted += 1;
        sessionCountEl.textContent = `Sessions completed: ${sessionsCompleted}`;
        rewardMessageEl.textContent = rewardMessages[Math.floor(Math.random() * rewardMessages.length)];
        showPopup('👏 Great job!', 'You completed a focused study session!');
    } else {
        showPopup("⏰ Break's over!", 'Time to get back to focused studying.');
    }

    alarmSound.play();
}

function resetTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    isPaused = false;
    isStudySession = true;
    pauseBtn.textContent = 'Pause';
    timeRemaining = (Number(studyInput.value) || 25) * 60;
    updateDisplay();
    startBtn.disabled = false;
    breakBtn.disabled = false;
    rewardMessageEl.textContent = '';
}

function showPopup(title, text) {
    popupTitle.textContent = title;
    popupText.textContent = text;
    popupModal.classList.remove('hidden');
}

// -----------------------------
// 2) Ambient Sound Controls
// -----------------------------
const soundButtons = document.querySelectorAll('.sound-btn');
const stopSoundBtn = document.getElementById('stop-sound-btn');
const soundVolume = document.getElementById('sound-volume');
const volumeValue = document.getElementById('volume-value');
const soundStatus = document.getElementById('sound-status');

// Placeholder file paths requested by user
const soundMap = {
    rain: 'audio/rain.mp3',
    forest: 'audio/forest.mp3',
    ocean: 'audio/ocean.mp3',
    night: 'audio/night.mp3',
    'white-noise': 'audio/white-noise.mp3',
    cafe: 'audio/cafe.mp3'
};

let currentAudio = null;

function playSound(soundKey) {
    const filePath = soundMap[soundKey];

    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }

    currentAudio = new Audio(filePath);
    currentAudio.loop = true;
    currentAudio.volume = Number(soundVolume.value);

    currentAudio.play()
        .then(() => {
            soundStatus.textContent = `Playing: ${soundKey.replace('-', ' ')}`;
        })
        .catch(() => {
            soundStatus.textContent = `Could not play ${soundKey}. Add file at ${filePath}`;
        });
}

function stopSound() {
    if (!currentAudio) return;
    currentAudio.pause();
    currentAudio.currentTime = 0;
    soundStatus.textContent = 'No sound playing.';
}

// -----------------------------
// 3) Gemini Summary + Quiz
// -----------------------------
const studyText = document.getElementById('study-text');
const generateSummaryBtn = document.getElementById('generate-summary-btn');
const generateQuizBtn = document.getElementById('generate-quiz-btn');
const aiStatus = document.getElementById('ai-status');
const summaryResult = document.getElementById('summary-result');
const summaryText = document.getElementById('summary-text');
const quizResult = document.getElementById('quiz-result');
const quizList = document.getElementById('quiz-list');

async function generateContent(type) {
    const text = studyText.value.trim();
    if (!text) {
        aiStatus.textContent = 'Please paste text first.';
        return;
    }

    aiStatus.textContent = `Generating ${type}...`;
    generateSummaryBtn.disabled = true;
    generateQuizBtn.disabled = true;

    try {
        const response = await fetch('/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, type })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to generate content');
        }

        if (type === 'summary') {
            summaryText.textContent = data.summary || 'No summary generated.';
            summaryResult.classList.remove('hidden');
        }

        if (type === 'quiz') {
            renderQuiz(data.quiz || []);
            quizResult.classList.remove('hidden');
        }

        aiStatus.textContent = 'Done ✅';
    } catch (error) {
        aiStatus.textContent = `Error: ${error.message}`;
    } finally {
        generateSummaryBtn.disabled = false;
        generateQuizBtn.disabled = false;
    }
}

function renderQuiz(quizItems) {
    quizList.innerHTML = '';

    quizItems.forEach((item, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'quiz-item';

        const q = document.createElement('p');
        q.className = 'quiz-question';
        q.textContent = `${index + 1}. ${item.question}`;

        const ul = document.createElement('ul');
        ul.className = 'quiz-options';

        (item.options || []).forEach((option) => {
            const li = document.createElement('li');
            li.textContent = option;
            ul.appendChild(li);
        });

        const answer = document.createElement('p');
        answer.className = 'quiz-answer';
        answer.textContent = `Correct answer: ${item.answer}`;

        wrapper.appendChild(q);
        wrapper.appendChild(ul);
        wrapper.appendChild(answer);
        quizList.appendChild(wrapper);
    });
}

// -----------------------------
// 4) Burnout Check
// -----------------------------
const burnoutForm = document.getElementById('burnout-form');
const burnoutResult = document.getElementById('burnout-result');
const burnoutScoreText = document.getElementById('burnout-score');
const burnoutFeedbackText = document.getElementById('burnout-feedback');

function calculateBurnoutFeedback(totalScore) {
    if (totalScore <= 14) {
        return "You're doing fine";
    }
    if (totalScore <= 24) {
        return 'Take breaks and manage time';
    }
    return 'You may be experiencing burnout';
}

// -----------------------------
// 5) Event Listeners
// -----------------------------
studyInput.addEventListener('input', updateButtonLabels);
breakInput.addEventListener('input', updateButtonLabels);
startBtn.addEventListener('click', () => startTimer(studyInput.value || 25, true));
breakBtn.addEventListener('click', () => startTimer(breakInput.value || 5, false));
pauseBtn.addEventListener('click', pauseTimer);
resetBtn.addEventListener('click', resetTimer);

closePopupBtn.addEventListener('click', () => {
    popupModal.classList.add('hidden');
});

soundButtons.forEach((button) => {
    button.addEventListener('click', () => playSound(button.dataset.sound));
});

stopSoundBtn.addEventListener('click', stopSound);

soundVolume.addEventListener('input', () => {
    const value = Number(soundVolume.value);
    volumeValue.textContent = `${Math.round(value * 100)}%`;
    if (currentAudio) {
        currentAudio.volume = value;
    }
});

generateSummaryBtn.addEventListener('click', () => generateContent('summary'));
generateQuizBtn.addEventListener('click', () => generateContent('quiz'));

burnoutForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const answers = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7']
        .map((id) => Number(document.getElementById(id).value));

    if (answers.some((value) => !value)) {
        burnoutScoreText.textContent = 'Please answer all questions.';
        burnoutFeedbackText.textContent = '';
        burnoutResult.classList.remove('hidden');
        return;
    }

    const totalScore = answers.reduce((sum, value) => sum + value, 0);
    const feedback = calculateBurnoutFeedback(totalScore);

    burnoutScoreText.textContent = `Total score: ${totalScore} / 35`;
    burnoutFeedbackText.textContent = feedback;
    burnoutResult.classList.remove('hidden');
});

// Initial UI state
updateButtonLabels();
updateDisplay();

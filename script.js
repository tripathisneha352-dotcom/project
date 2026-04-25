/**
 * Smart Study Assistant - Core Logic
 * This file contains the interactive logic for the Pomodoro timer,
 * study buddy animations, and burnout support system.
 * 
 * Keep this file modular so future expansions (like music or planner)
 * can be added seamlessly.
 */

// --- 1. DOM Element Variables ---

// Timer
const timeDisplay = document.getElementById('time-display');
const studyInput = document.getElementById('study-input');
const breakInput = document.getElementById('break-input');
const startBtn = document.getElementById('start-btn');
const breakBtn = document.getElementById('break-btn');
function updateButtonLabels() {
    let studyTime = studyInput.value || 25;
    let breakTime = breakInput.value || 5;

    startBtn.textContent = `Start Focus (${studyTime}m)`;
    breakBtn.textContent = `Short Break (${breakTime}m)`;
}
updateButtonLabels();
const pauseBtn = document.getElementById('pause-btn');
studyInput.addEventListener("input", updateButtonLabels);
breakInput.addEventListener("input", updateButtonLabels);
const resetBtn = document.getElementById('reset-btn');
const sessionCountEl = document.getElementById('session-count');
const rewardMessageEl = document.getElementById('reward-message');
const alarmSound = new Audio("https://www.soundjay.com/buttons/beep-07.wav");

// Modal Popup
const popupModal = document.getElementById('popup-modal');
const popupTitle = document.getElementById('popup-title');
const popupText = document.getElementById('popup-text');
const closePopupBtn = document.getElementById('close-popup-btn');

// Burnout Section
const burnoutBtn = document.getElementById('burnout-btn');
const burnoutOptions = document.getElementById('burnout-options');
const burnoutMessage = document.getElementById('burnout-message');
const optionBtns = document.querySelectorAll('.option-btn');

// --- 2. State & Configuration ---

let timerInterval = null;
let timeRemaining = 0; // stored in seconds
let isPaused = false;
let isStudySession = true; // Tracks if current timer is a study block or break
let sessionsCompleted = 0; // Progress tracking

// Constants for time
const STUDY_TIME_MINUTES = 25;
const BREAK_TIME_MINUTES = 5;

// Reward pool for studying
const rewardMessages = [
    "🔥 You're doing great! Keep it up!",
    "🚀 Fantastic focus!",
    "⭐ One step closer to your goals!",
    "🎓 Amazing work, future engineer!",
    "🌱 Consistency is key. Well done!"
];


// --- 3. Timer Logic ---

/**
 * Format raw seconds into a MM:SS string.
 * @param {number} seconds 
 * @returns {string} Formatted time string
 */
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Update the visual UI of the timer.
 */
function updateDisplay() {
    timeDisplay.textContent = formatTime(timeRemaining);
}

/**
 * Handles the timer tick logic. Separated out for clarity.
 */
function timerTick() {
    if (isPaused) return;
    timeRemaining--;
    updateDisplay();

    if (timeRemaining <= 0) {
        clearInterval(timerInterval);
        handleTimerComplete();
    }
}

/**
 * Starts the countdown timer.
 * @param {number} minutes The duration to calculate
 * @param {boolean} isStudy Whether this is study or break time
 */

function startTimer(minutes, isStudy) {
    clearInterval(timerInterval);
    if (isPaused) {
    timerInterval = setInterval(timerTick, 1000);
    isPaused = false;
    return;
}

    // 2. Setup state
    timeRemaining = minutes * 60;
    isStudySession = isStudy;
    document.body.style.background = isStudy ? "#f4f7fb" : "#e0f7fa";
    updateDisplay();
    
    // 3. UI Updates: Disable action buttons during active timer
    startBtn.disabled = true;
    breakBtn.disabled = true;
    rewardMessageEl.textContent = "";

    // 4. Start tick loop
    timerInterval = setInterval(timerTick, 1000);
}

function pauseTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        isPaused = true;
        pauseBtn.textContent = "Resume";
    } else if (isPaused) {
        timerInterval = setInterval(timerTick, 1000);
        isPaused = false;
        pauseBtn.textContent = "Pause";
    }
}

/**
 * Triggered when the timer count hits exactly 0.
 */
function handleTimerComplete() {
    // 1. Re-enable interactive buttons
    startBtn.disabled = false;
    breakBtn.disabled = false;
    
    // 2. Handle completion based on session type
    if (isStudySession) {
        // Study complete: increment counter, show reward
        sessionsCompleted++;
        sessionCountEl.textContent = `Sessions completed: ${sessionsCompleted}`;
        
        // Pick random encouraging message
        const randomMsg = rewardMessages[Math.floor(Math.random() * rewardMessages.length)];
        rewardMessageEl.textContent = randomMsg;
        
        // Show completion popup
        showPopup("👏 Great job!", "You completed a focused study session!");
    } else {
        // Break complete
        showPopup("⏰ Break's over!", "Time to get back to focused studying.");
    }
    alarmSound.play();
    // ✅ STEP 4 HERE (auto switch)
if (isStudySession) {
    setTimeout(() => {
        let breakTime = breakInput.value || 5;
        startTimer(breakTime, false);
    }, 2000);
}


}

/**
 * Stops any active timer and resets to the default 25min layout.
 */
function resetTimer() {
    clearInterval(timerInterval);
    timeRemaining = STUDY_TIME_MINUTES * 60;
    isStudySession = true;
    isPaused = false;

    pauseBtn.textContent = "Pause";

    updateDisplay();

    startBtn.disabled = false;
    breakBtn.disabled = false;
    rewardMessageEl.textContent = "";
}

// --- 4. Popup Logic ---

/**
 * Displays the modal overlay with a custom title and text
 */
function showPopup(title, text) {
    popupTitle.textContent = title;
    popupText.textContent = text;
    popupModal.classList.remove('hidden');
}


// --- 5. Event Listeners ---

// Timer Controls
startBtn.addEventListener("click", function () {
    let studyTime = document.getElementById("study-input").value || 25;
    startTimer(studyTime, true);
});
breakBtn.addEventListener("click", function () {
    let breakTime = document.getElementById("break-input").value || 5;
    startTimer(breakTime, false);
});
resetBtn.addEventListener('click', resetTimer);

// Modal Controls
closePopupBtn.addEventListener('click', () => {
    popupModal.classList.add('hidden');
});

// Burnout Section Events
burnoutBtn.addEventListener('click', () => {
    // Toggle the options grid visibility
    if (burnoutOptions.classList.contains('hidden')) {
        burnoutOptions.classList.remove('hidden');
        burnoutMessage.classList.add('hidden'); // clear old msg
    } else {
        burnoutOptions.classList.add('hidden');
    }
});

optionBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Retrieve which concern was clicked
        const reason = e.target.getAttribute('data-reason');
        let supportText = "";

        // Determine message mapping
        switch(reason) {
            case "anxiety":
                supportText = "Take a deep breath. Count to 4 as you breathe in, hold for 4, and exhale for 4. You've got this. Take it one step at a time.";
                break;
            case "focus":
                supportText = "It's normal to lose focus. Step away from the screen, drink some water, or stretch for 2 minutes before returning.";
                break;
            case "energy":
                supportText = "Your body might need rest. Consider a 15-minute power nap or a healthy snack to recharge your batteries.";
                break;
            default:
                supportText = "We're here for you. Take a breather.";
        }

        // Hide options, show message
        burnoutOptions.classList.add('hidden');
        burnoutMessage.textContent = supportText;
        burnoutMessage.classList.remove('hidden');
    });
});

// --- 6. Initialization ---

// Setup initial UI loaded state
resetTimer();
pauseBtn.addEventListener('click', pauseTimer);
// 📝 TO-DO LIST
function addTask() {
    let input = document.getElementById("todo-input");
    let taskText = input.value;

    if (taskText.trim() === "") return;

    let li = document.createElement("li");
    li.innerHTML = `
        ${taskText}
        <span onclick="deleteTask(this)">❌</span>
    `;

    li.onclick = function () {
        li.classList.toggle("completed");
    };

    document.getElementById("todo-list").appendChild(li);
    input.value = "";
}

function deleteTask(element) {
    element.parentElement.remove();
}

   

// 📒 NOTES (ONLY SAVE + CLEAR)

// SAVE = DOWNLOAD
document.getElementById("downloadNotesBtn").addEventListener("click", () => {
    const text = document.getElementById("notes-area").value;

    if (!text.trim()) {
        alert("Nothing to save!");
        return;
    }

    const blob = new Blob([text], { type: "text/plain" });
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = "MyNotes.txt";
    link.click();
});

// CLEAR
document.getElementById("clearNotesBtn").addEventListener("click", () => {
    document.getElementById("notes-area").value = "";
});

// =============================================
// 📄 AI Study Tools: Summary + Quiz
// =============================================

let fileText = "";

// FILE READ
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const statusEl = document.getElementById("file-status");
    const labelEl = document.getElementById("file-label-text");

    labelEl.textContent = `📄 ${file.name}`;
    statusEl.classList.remove("hidden");
    statusEl.textContent = "Reading file...";

    fileText = await file.text();

    statusEl.textContent = "✅ File loaded";
}

// SUMMARY
async function generateSummary() {

    // ✅ 1. Validate FIRST (before API call)
    if (!fileText || fileText.trim().length === 0) {
        alert("Upload file first!");
        return;
    }

    // ✅ 2. Size check
    if (fileText.length > 200000) {
        alert("File too large. Please upload smaller text.");
        return;
    }

    try {
        // ✅ 3. API call
        const res = await fetch("http://localhost:3000/generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                text: fileText,
                type: "summary"
            })
        });

        const data = await res.json();

        document.getElementById("outputBox").innerText = data.summary;

    } catch (error) {
        console.error(error);
        alert("Something went wrong while generating summary.");
    }
}

// QUIZ
async function generateQuiz() {
    if (!fileText) {
        alert("Upload file first!");
        return;
    }

    const res = await fetch("http://localhost:3000/generate", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            text: fileText,
            type: "quiz"
        })
    });

    const data = await res.json();

    let html = "<h3>Quiz</h3>";

    data.quiz.forEach((q, i) => {
        html += `<p><b>Q${i + 1}:</b> ${q.question}</p>`;
        q.options.forEach(opt => {
            html += `<p>${opt}</p>`;
        });
        html += "<hr>";
    });

    document.getElementById("outputBox").innerHTML = html;
}
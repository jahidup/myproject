const params = new URLSearchParams(window.location.search);
const testId = params.get("testId");

const testTitleEl = document.getElementById("testTitle");
const testMetaEl = document.getElementById("testMeta");
const timerEl = document.getElementById("timer");
const questionCounterEl = document.getElementById("questionCounter");
const questionPanelEl = document.getElementById("questionPanel");
const questionTextEnEl = document.getElementById("questionTextEn");
const questionTextHiEl = document.getElementById("questionTextHi");
const questionImageEl = document.getElementById("questionImage");
const optionsWrapEl = document.getElementById("optionsWrap");
const numericalWrapEl = document.getElementById("numericalWrap");
const numericalInputEl = document.getElementById("numericalInput");
const clearBtn = document.getElementById("clearAnswerBtn");
const flagBtn = document.getElementById("flagQuestionBtn");
const prevBtn = document.getElementById("prevQuestionBtn");
const nextBtn = document.getElementById("nextQuestionBtn");
const submitBtn = document.getElementById("submitTestBtn");
const exitBtn = document.getElementById("exitBtn");

let test = null;
let questions = [];
let currentIndex = 0;
let remainingSeconds = 0;
let timerRef = null;
let autoSaveRef = null;
const answers = {};
const flagged = new Set();

const progressStorageKey = `testProgress_${testId}`;

function toPlainObject(value) {
  if (!value) return {};
  if (Array.isArray(value)) return Object.fromEntries(value);
  if (typeof value === "object") return value;
  return {};
}

function formatTimer(seconds) {
  const min = String(Math.floor(seconds / 60)).padStart(2, "0");
  const sec = String(seconds % 60).padStart(2, "0");
  return `${min}:${sec}`;
}

function serializeLocalState() {
  return {
    testId,
    answers,
    flagged: Array.from(flagged),
    remainingSeconds,
    currentIndex
  };
}

function saveProgressToLocal() {
  localStorage.setItem(progressStorageKey, JSON.stringify(serializeLocalState()));
}

async function saveProgressToApi() {
  try {
    await window.PortalAPI.apiFetch("/progress", {
      method: "POST",
      auth: "student",
      body: JSON.stringify({
        testId,
        answers,
        flagged: Array.from(flagged),
        remainingSeconds
      })
    });
  } catch (_error) {
    // Silent by design; local autosave already handles backup.
  }
}

function getQuestionStatus(qId) {
  if (flagged.has(qId)) return "flagged";
  const value = answers[qId];
  if (value !== undefined && value !== null && String(value).trim() !== "") return "answered";
  return "pending";
}

function renderNavPanel() {
  questionPanelEl.innerHTML = questions
    .map((q, index) => {
      const status = getQuestionStatus(q.qId);
      const statusClass =
        status === "flagged"
          ? "bg-amber-500/35 border-amber-400"
          : status === "answered"
            ? "bg-emerald-500/30 border-emerald-400"
            : "bg-slate-700/40 border-slate-500";

      return `
        <button
          data-index="${index}"
          class="h-10 w-10 rounded-lg border text-sm font-semibold transition ${
            index === currentIndex ? "ring-2 ring-cyan-300" : ""
          } ${statusClass}">
          ${index + 1}
        </button>
      `;
    })
    .join("");
}

function renderQuestion() {
  const question = questions[currentIndex];
  if (!question) return;

  questionCounterEl.textContent = `Question ${currentIndex + 1} / ${questions.length}`;
  questionTextEnEl.textContent = question.question?.en || "";
  questionTextHiEl.textContent = question.question?.hi || "Hindi text unavailable";

  if (question.imageUrl) {
    questionImageEl.src = question.imageUrl;
    questionImageEl.classList.remove("hidden");
  } else {
    questionImageEl.src = "";
    questionImageEl.classList.add("hidden");
  }

  const currentAnswer = answers[question.qId];
  flagBtn.textContent = flagged.has(question.qId) ? "Unflag" : "Flag";

  if (question.type === "mcq") {
    numericalWrapEl.classList.add("hidden");
    optionsWrapEl.classList.remove("hidden");
    optionsWrapEl.innerHTML = (question.options || [])
      .map(
        (option, idx) => `
          <label class="flex items-center gap-3 rounded-xl border border-slate-500/40 px-3 py-3 bg-slate-800/30 hover:bg-slate-700/40 cursor-pointer">
            <input type="radio" name="mcqOption" value="${option}" ${String(currentAnswer) === String(option) ? "checked" : ""}>
            <span class="text-sm">${String.fromCharCode(65 + idx)}. ${option}</span>
          </label>
        `
      )
      .join("");
  } else {
    optionsWrapEl.classList.add("hidden");
    numericalWrapEl.classList.remove("hidden");
    numericalInputEl.value = currentAnswer ?? "";
  }

  prevBtn.disabled = currentIndex === 0;
  nextBtn.disabled = currentIndex === questions.length - 1;
  renderNavPanel();
}

function restoreLocalProgress() {
  try {
    const raw = localStorage.getItem(progressStorageKey);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.answers) {
      Object.assign(answers, data.answers);
    }
    if (Array.isArray(data.flagged)) {
      data.flagged.forEach((qId) => flagged.add(qId));
    }
    if (Number.isFinite(data.remainingSeconds) && data.remainingSeconds > 0) {
      remainingSeconds = data.remainingSeconds;
    }
    if (Number.isInteger(data.currentIndex) && data.currentIndex >= 0) {
      currentIndex = Math.min(data.currentIndex, Math.max(questions.length - 1, 0));
    }
  } catch (_error) {
    // Ignore malformed local cache
  }
}

function bindEvents() {
  questionPanelEl.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-index]");
    if (!btn) return;
    currentIndex = Number(btn.dataset.index);
    renderQuestion();
    saveProgressToLocal();
  });

  optionsWrapEl.addEventListener("change", (event) => {
    const option = event.target;
    if (option.name !== "mcqOption") return;
    const question = questions[currentIndex];
    answers[question.qId] = option.value;
    saveProgressToLocal();
    renderNavPanel();
  });

  numericalInputEl.addEventListener("input", () => {
    const question = questions[currentIndex];
    answers[question.qId] = numericalInputEl.value.trim();
    saveProgressToLocal();
    renderNavPanel();
  });

  clearBtn.addEventListener("click", () => {
    const question = questions[currentIndex];
    delete answers[question.qId];
    numericalInputEl.value = "";
    renderQuestion();
    saveProgressToLocal();
  });

  flagBtn.addEventListener("click", () => {
    const question = questions[currentIndex];
    if (flagged.has(question.qId)) flagged.delete(question.qId);
    else flagged.add(question.qId);
    renderQuestion();
    saveProgressToLocal();
  });

  prevBtn.addEventListener("click", () => {
    if (currentIndex > 0) {
      currentIndex -= 1;
      renderQuestion();
      saveProgressToLocal();
    }
  });

  nextBtn.addEventListener("click", () => {
    if (currentIndex < questions.length - 1) {
      currentIndex += 1;
      renderQuestion();
      saveProgressToLocal();
    }
  });

  submitBtn.addEventListener("click", async () => {
    const confirmed = window.confirm("Submit test now? You cannot change answers after submitting.");
    if (!confirmed) return;
    await submitTest();
  });

  exitBtn.addEventListener("click", () => {
    window.location.href = "/dashboard.html";
  });
}

function startTimer() {
  timerEl.textContent = formatTimer(remainingSeconds);
  timerRef = setInterval(async () => {
    remainingSeconds -= 1;
    if (remainingSeconds < 0) {
      clearInterval(timerRef);
      await submitTest();
      return;
    }
    timerEl.textContent = formatTimer(remainingSeconds);
    saveProgressToLocal();
  }, 1000);
}

function startAutosave() {
  autoSaveRef = setInterval(async () => {
    saveProgressToLocal();
    await saveProgressToApi();
  }, 10000);
}

async function submitTest() {
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting...";
  try {
    await saveProgressToApi();
    const { result, top3 } = await window.PortalAPI.apiFetch("/submit", {
      method: "POST",
      auth: "student",
      body: JSON.stringify({ testId, answers })
    });

    localStorage.removeItem(progressStorageKey);
    clearInterval(timerRef);
    clearInterval(autoSaveRef);

    const podium = (top3 || [])
      .map((row) => `${row.rank}. ${row.studentId} (${row.score})`)
      .join("\n");
    window.alert(
      `Test submitted.\nScore: ${result.score}\nRank: ${result.rank || "-"}\nTop 3:\n${podium || "Not enough entries yet"}`
    );
    window.location.href = "/dashboard.html";
  } catch (error) {
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit Test";
    window.PortalAPI.showToast(error.message, "error");
  }
}

async function boot() {
  if (!window.PortalAPI.requireStudentPageAuth()) return;
  if (!testId) {
    window.PortalAPI.showToast("Missing testId in URL.", "error");
    setTimeout(() => (window.location.href = "/dashboard.html"), 800);
    return;
  }

  try {
    const [testRes, questionsRes, progressRes] = await Promise.all([
      window.PortalAPI.apiFetch(`/tests/${encodeURIComponent(testId)}`, { auth: "student" }),
      window.PortalAPI.apiFetch(`/questions/${encodeURIComponent(testId)}`, { auth: "student" }),
      window.PortalAPI.apiFetch(`/progress/${encodeURIComponent(testId)}`, { auth: "student" })
    ]);

    test = testRes.test;
    questions = questionsRes.questions || [];
    remainingSeconds = (test.duration || 0) * 60;

    if (!questions.length) {
      window.PortalAPI.showToast("No questions found for this test.", "error");
      setTimeout(() => (window.location.href = "/dashboard.html"), 1000);
      return;
    }

    if (progressRes.progress) {
      Object.assign(answers, toPlainObject(progressRes.progress.answers));
      (progressRes.progress.flagged || []).forEach((qId) => flagged.add(qId));
      if (progressRes.progress.remainingSeconds > 0) {
        remainingSeconds = progressRes.progress.remainingSeconds;
      }
    }

    restoreLocalProgress();

    testTitleEl.textContent = test.title;
    testMetaEl.textContent = `Test ID: ${test.testId} | Class: ${test.class} | Duration: ${test.duration} min`;
    bindEvents();
    renderQuestion();
    startTimer();
    startAutosave();
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      window.PortalAPI.clearStudentSession();
      window.location.href = "/index.html";
      return;
    }
    window.PortalAPI.showToast(error.message, "error");
  }
}

window.addEventListener("beforeunload", () => {
  saveProgressToLocal();
});

boot();

const studentNameEl = document.getElementById("studentName");
const studentMetaEl = document.getElementById("studentMeta");
const testsTakenEl = document.getElementById("testsTaken");
const averageScoreEl = document.getElementById("averageScore");
const testsListEl = document.getElementById("testsList");
const resultsListEl = document.getElementById("resultsList");
const discussionListEl = document.getElementById("discussionList");
const chatListEl = document.getElementById("chatList");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const logoutBtn = document.getElementById("logoutBtn");

let currentStudent = null;
let conversationPoll = null;

function formatDateTime(value) {
  return new Date(value).toLocaleString();
}

function renderTests(tests = []) {
  if (!tests.length) {
    testsListEl.innerHTML =
      '<div class="glass-card p-5 text-sm text-slate-300">No tests assigned to your class yet.</div>';
    return;
  }

  testsListEl.innerHTML = tests
    .map(
      (test) => `
        <article class="glass-card p-5 slide-up">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-lg font-semibold text-cyan-100">${test.title}</p>
              <p class="text-xs text-slate-300 mt-1">Test ID: ${test.testId} | Class: ${test.class}</p>
            </div>
            <span class="chip text-cyan-100">Duration: ${test.duration} min</span>
          </div>
          <div class="mt-3 text-xs text-slate-200/90">
            <span class="mr-3">Questions: ${test.questionCount || 0}</span>
            <span class="mr-3">+${test.marks.correct}</span>
            <span class="mr-3">${test.marks.wrong}</span>
            <span>${test.marks.skip} skip</span>
          </div>
          <div class="mt-4">
            <a class="btn-primary inline-block text-sm" href="/test.html?testId=${encodeURIComponent(test.testId)}">
              Start Test
            </a>
          </div>
        </article>
      `
    )
    .join("");
}

function renderResults(results = []) {
  if (!results.length) {
    resultsListEl.innerHTML =
      '<div class="glass-card p-4 text-sm text-slate-300">No attempts yet. Start your first test.</div>';
    return;
  }

  resultsListEl.innerHTML = results
    .map(
      (row) => `
        <div class="glass-card p-4">
          <div class="flex justify-between items-center gap-2">
            <div>
              <p class="font-semibold text-cyan-100">Test: ${row.testId}</p>
              <p class="text-xs text-slate-300">Updated: ${formatDateTime(row.updatedAt)}</p>
            </div>
            <div class="text-right">
              <p class="text-lg font-bold text-emerald-300">${row.score}</p>
              <p class="text-xs text-slate-300">Rank: ${row.rank || "-"}</p>
            </div>
          </div>
        </div>
      `
    )
    .join("");
}

function renderDiscussions(rows = []) {
  if (!rows.length) {
    discussionListEl.innerHTML =
      '<div class="glass-card p-4 text-sm text-slate-300">No announcements yet.</div>';
    return;
  }

  discussionListEl.innerHTML = rows
    .map(
      (d) => `
      <div class="glass-card p-4">
        <div class="flex items-center justify-between gap-2">
          <p class="font-semibold text-cyan-100">${d.title}</p>
          <span class="text-xs text-slate-300">${d.testId}</span>
        </div>
        <p class="text-sm text-slate-100/95 mt-2">${d.message}</p>
        <p class="text-xs text-slate-300 mt-2">${formatDateTime(d.createdAt)}</p>
      </div>
    `
    )
    .join("");
}

function renderChat(messages = []) {
  if (!messages.length) {
    chatListEl.innerHTML =
      '<div class="text-sm text-slate-300">No messages yet. Start conversation with admin.</div>';
    return;
  }

  chatListEl.innerHTML = messages
    .map((m) => {
      const mine = m.fromRole === "student";
      return `
      <div class="flex ${mine ? "justify-end" : "justify-start"} mb-2">
        <div class="${mine ? "bg-cyan-500/20 border-cyan-400/40" : "bg-slate-700/30 border-slate-500/30"} border rounded-xl px-3 py-2 max-w-[78%]">
          <p class="text-sm">${m.text}</p>
          <p class="text-[10px] text-slate-300 mt-1">${formatDateTime(m.createdAt)}</p>
        </div>
      </div>
      `;
    })
    .join("");

  chatListEl.scrollTop = chatListEl.scrollHeight;
}

async function loadChat() {
  try {
    const { messages } = await window.PortalAPI.apiFetch("/messages", { auth: "student" });
    renderChat(messages);
  } catch (error) {
    if (error.status === 401) {
      window.PortalAPI.clearStudentSession();
      window.location.href = "/index.html";
      return;
    }
    window.PortalAPI.showToast(error.message, "error");
  }
}

async function bootDashboard() {
  if (!window.PortalAPI.requireStudentPageAuth()) return;

  try {
    const me = await window.PortalAPI.apiFetch("/me", { auth: "student" });
    currentStudent = me.student;
    studentNameEl.textContent = me.student.name;
    studentMetaEl.textContent = `Student ID: ${me.student.studentId} | Class: ${me.student.class}`;
    testsTakenEl.textContent = String(me.stats.testsTaken);
    averageScoreEl.textContent = String(me.stats.averageScore);

    const [testsRes, resultsRes, discussionsRes] = await Promise.all([
      window.PortalAPI.apiFetch("/tests", { auth: "student" }),
      window.PortalAPI.apiFetch("/results", { auth: "student" }),
      window.PortalAPI.apiFetch("/discussions", { auth: "student" })
    ]);

    renderTests(testsRes.tests || []);
    renderResults(resultsRes.results || []);
    renderDiscussions(discussionsRes.discussions || []);
    await loadChat();

    conversationPoll = setInterval(loadChat, 12000);
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      window.PortalAPI.clearStudentSession();
      window.location.href = "/index.html";
      return;
    }
    window.PortalAPI.showToast(error.message, "error");
  }
}

if (chatForm) {
  chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    chatInput.value = "";
    try {
      await window.PortalAPI.apiFetch("/message", {
        method: "POST",
        auth: "student",
        body: JSON.stringify({ text })
      });
      await loadChat();
    } catch (error) {
      window.PortalAPI.showToast(error.message, "error");
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    if (conversationPoll) clearInterval(conversationPoll);
    window.PortalAPI.clearStudentSession();
    window.location.href = "/index.html";
  });
}

window.addEventListener("beforeunload", () => {
  if (conversationPoll) clearInterval(conversationPoll);
});

bootDashboard();

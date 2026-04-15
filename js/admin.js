const adminAuthCard = document.getElementById("adminAuthCard");
const adminPanel = document.getElementById("adminPanel");
const adminLoginForm = document.getElementById("adminLoginForm");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");
const navButtons = document.querySelectorAll("[data-tab]");
const tabContents = document.querySelectorAll("[data-tab-content]");

const statsStudentsEl = document.getElementById("statsStudents");
const statsTestsEl = document.getElementById("statsTests");
const statsQuestionsEl = document.getElementById("statsQuestions");

const addStudentForm = document.getElementById("addStudentForm");
const studentClassFilterEl = document.getElementById("studentClassFilter");
const studentsTableBody = document.getElementById("studentsTableBody");

const addTestForm = document.getElementById("addTestForm");
const testsListAdminEl = document.getElementById("testsListAdmin");

const addQuestionForm = document.getElementById("addQuestionForm");
const questionTypeEl = document.getElementById("questionType");
const mcqOptionsWrap = document.getElementById("mcqOptionsWrap");
const questionTestSelectEl = document.getElementById("questionTestId");

const resultsTestFilterEl = document.getElementById("resultsTestFilter");
const resultsTableBody = document.getElementById("resultsTableBody");

const discussionForm = document.getElementById("discussionForm");
const discussionFeedEl = document.getElementById("discussionFeed");
const discussionTestSelectEl = document.getElementById("discussionTestId");

const messageStudentSelectEl = document.getElementById("messageStudentId");
const adminChatListEl = document.getElementById("adminChatList");
const adminChatForm = document.getElementById("adminChatForm");
const adminChatInput = document.getElementById("adminChatInput");

let studentsCache = [];
let testsCache = [];
let chatPollRef = null;

function formatDateTime(value) {
  return new Date(value).toLocaleString();
}

function activateTab(tab) {
  navButtons.forEach((btn) => {
    if (btn.dataset.tab === tab) {
      btn.classList.add("bg-cyan-400/20", "border-cyan-300/70");
    } else {
      btn.classList.remove("bg-cyan-400/20", "border-cyan-300/70");
    }
  });

  tabContents.forEach((section) => {
    const active = section.dataset.tabContent === tab;
    section.classList.toggle("hidden", !active);
  });
}

async function loginAdmin(password) {
  const { token } = await window.PortalAPI.apiFetch("/admin/login", {
    method: "POST",
    body: JSON.stringify({ password })
  });
  window.PortalAPI.setAdminSession(token);
}

function renderStudentRows(students = []) {
  if (!students.length) {
    studentsTableBody.innerHTML = `
      <tr>
        <td colspan="8" class="py-4 text-center text-slate-300">No students found.</td>
      </tr>
    `;
    return;
  }

  studentsTableBody.innerHTML = students
    .map(
      (student) => `
      <tr class="border-b border-white/10 text-sm">
        <td class="py-2 pr-2">${student.studentId}</td>
        <td class="py-2 pr-2">${student.name}</td>
        <td class="py-2 pr-2">${student.class}</td>
        <td class="py-2 pr-2">${student.parentMobile}</td>
        <td class="py-2 pr-2">${student.dob}</td>
        <td class="py-2 pr-2 ${student.status === "active" ? "status-active" : "status-blocked"}">${student.status}</td>
        <td class="py-2 pr-2">
          <button class="btn-soft text-xs" data-edit-student="${student.studentId}">Edit</button>
        </td>
        <td class="py-2 pr-2">
          <button class="btn-soft text-xs" data-delete-student="${student.studentId}">Delete</button>
          <button class="btn-soft text-xs mt-2" data-block-student="${student.studentId}" data-status="${student.status}">
            ${student.status === "active" ? "Block" : "Unblock"}
          </button>
        </td>
      </tr>
    `
    )
    .join("");
}

function renderTestsList(tests = []) {
  if (!tests.length) {
    testsListAdminEl.innerHTML =
      '<div class="text-sm text-slate-300">No tests yet. Create a test first.</div>';
    return;
  }

  testsListAdminEl.innerHTML = tests
    .map(
      (test) => `
      <div class="glass-card p-4">
        <div class="flex justify-between gap-2">
          <div>
            <p class="font-semibold text-cyan-100">${test.title}</p>
            <p class="text-xs text-slate-300">ID: ${test.testId} | Class: ${test.class}</p>
          </div>
          <span class="chip text-slate-100">${test.duration} min</span>
        </div>
        <p class="text-xs text-slate-200 mt-2">
          Marks: +${test.marks.correct}, ${test.marks.wrong}, ${test.marks.skip} skip
        </p>
      </div>
    `
    )
    .join("");
}

function syncTestDropdowns() {
  const questionSelected = questionTestSelectEl.value;
  const resultsSelected = resultsTestFilterEl.value;
  const discussionSelected = discussionTestSelectEl.value;
  const options = testsCache
    .map((test) => `<option value="${test.testId}">${test.testId} - ${test.title} (${test.class})</option>`)
    .join("");

  questionTestSelectEl.innerHTML = `<option value="">Select test</option>${options}`;
  resultsTestFilterEl.innerHTML = `<option value="">Select test</option>${options}`;
  discussionTestSelectEl.innerHTML = `<option value="">Select test</option>${options}`;

  if (questionSelected) questionTestSelectEl.value = questionSelected;
  if (resultsSelected) resultsTestFilterEl.value = resultsSelected;
  if (discussionSelected) discussionTestSelectEl.value = discussionSelected;
}

function syncStudentDropdown() {
  const options = studentsCache
    .map((student) => `<option value="${student.studentId}">${student.studentId} - ${student.name}</option>`)
    .join("");
  messageStudentSelectEl.innerHTML = `<option value="">Select student</option>${options}`;
}

function renderResultsTable(results = []) {
  if (!results.length) {
    resultsTableBody.innerHTML =
      '<tr><td colspan="8" class="py-4 text-center text-slate-300">No results found.</td></tr>';
    return;
  }

  resultsTableBody.innerHTML = results
    .map(
      (row) => `
      <tr class="border-b border-white/10 text-sm">
        <td class="py-2 pr-2">${row.studentId}</td>
        <td class="py-2 pr-2">${row.testId}</td>
        <td class="py-2 pr-2">${row.score}</td>
        <td class="py-2 pr-2">${row.rank || "-"}</td>
        <td class="py-2 pr-2">${row.correct}</td>
        <td class="py-2 pr-2">${row.wrong}</td>
        <td class="py-2 pr-2">${row.skipped}</td>
        <td class="py-2 pr-2">${formatDateTime(row.updatedAt)}</td>
      </tr>
    `
    )
    .join("");
}

function renderDiscussions(rows = []) {
  if (!rows.length) {
    discussionFeedEl.innerHTML = '<div class="text-sm text-slate-300">No announcements yet.</div>';
    return;
  }

  discussionFeedEl.innerHTML = rows
    .map(
      (row) => `
      <div class="glass-card p-4">
        <div class="flex justify-between gap-2">
          <p class="font-semibold text-cyan-100">${row.title}</p>
          <span class="text-xs text-slate-300">${row.testId}</span>
        </div>
        <p class="text-sm mt-2">${row.message}</p>
        <p class="text-xs text-slate-300 mt-1">${formatDateTime(row.createdAt)}</p>
      </div>
    `
    )
    .join("");
}

function renderChat(messages = []) {
  if (!messages.length) {
    adminChatListEl.innerHTML =
      '<div class="text-sm text-slate-300">No messages yet for selected student.</div>';
    return;
  }

  adminChatListEl.innerHTML = messages
    .map((message) => {
      const mine = message.fromRole === "admin";
      return `
        <div class="flex ${mine ? "justify-end" : "justify-start"} mb-2">
          <div class="${mine ? "bg-cyan-500/20 border-cyan-400/40" : "bg-slate-700/30 border-slate-500/30"} border rounded-xl px-3 py-2 max-w-[78%]">
            <p class="text-sm">${message.text}</p>
            <p class="text-[10px] text-slate-300 mt-1">${formatDateTime(message.createdAt)}</p>
          </div>
        </div>
      `;
    })
    .join("");
  adminChatListEl.scrollTop = adminChatListEl.scrollHeight;
}

async function fetchAdminStats() {
  const stats = await window.PortalAPI.apiFetch("/admin/stats", { auth: "admin" });
  statsStudentsEl.textContent = String(stats.totalStudents);
  statsTestsEl.textContent = String(stats.totalTests);
  statsQuestionsEl.textContent = String(stats.totalQuestions);
}

async function fetchStudents() {
  const filterClass = studentClassFilterEl.value.trim();
  const query = filterClass ? `?class=${encodeURIComponent(filterClass)}` : "";
  const { students } = await window.PortalAPI.apiFetch(`/students${query}`, { auth: "admin" });
  studentsCache = students || [];
  renderStudentRows(studentsCache);
  syncStudentDropdown();
}

async function fetchTests() {
  const { tests } = await window.PortalAPI.apiFetch("/tests", { auth: "admin" });
  testsCache = tests || [];
  renderTestsList(testsCache);
  syncTestDropdowns();
}

async function fetchResults() {
  const testId = resultsTestFilterEl.value;
  if (!testId) {
    renderResultsTable([]);
    return;
  }
  const { results } = await window.PortalAPI.apiFetch(`/results?testId=${encodeURIComponent(testId)}`, {
    auth: "admin"
  });
  renderResultsTable(results || []);
}

async function fetchDiscussions() {
  const { discussions } = await window.PortalAPI.apiFetch("/discussions", { auth: "admin" });
  renderDiscussions(discussions || []);
}

async function fetchChat() {
  const sid = messageStudentSelectEl.value;
  if (!sid) {
    renderChat([]);
    return;
  }
  const { messages } = await window.PortalAPI.apiFetch(`/messages?studentId=${encodeURIComponent(sid)}`, {
    auth: "admin"
  });
  renderChat(messages || []);
}

async function refreshEverything() {
  await Promise.all([fetchAdminStats(), fetchStudents(), fetchTests(), fetchDiscussions()]);
  await fetchResults();
  await fetchChat();
}

function attachEvents() {
  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => activateTab(btn.dataset.tab));
  });

  adminLogoutBtn.addEventListener("click", () => {
    if (chatPollRef) clearInterval(chatPollRef);
    window.PortalAPI.clearAdminSession();
    adminPanel.classList.add("hidden");
    adminAuthCard.classList.remove("hidden");
  });

  adminLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = document.getElementById("adminPasswordInput").value.trim();
    if (!password) return;

    const btn = adminLoginForm.querySelector("button[type='submit']");
    btn.disabled = true;
    btn.textContent = "Logging in...";
    try {
      await loginAdmin(password);
      adminAuthCard.classList.add("hidden");
      adminPanel.classList.remove("hidden");
      await refreshEverything();
      chatPollRef = setInterval(fetchChat, 12000);
      window.PortalAPI.showToast("Admin authenticated.", "success");
    } catch (error) {
      window.PortalAPI.showToast(error.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Login";
    }
  });

  studentClassFilterEl.addEventListener("change", fetchStudents);
  resultsTestFilterEl.addEventListener("change", fetchResults);
  messageStudentSelectEl.addEventListener("change", fetchChat);

  addStudentForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(addStudentForm).entries());
    try {
      await window.PortalAPI.apiFetch("/students", {
        method: "POST",
        auth: "admin",
        body: JSON.stringify(data)
      });
      addStudentForm.reset();
      await Promise.all([fetchAdminStats(), fetchStudents()]);
      window.PortalAPI.showToast("Student added.", "success");
    } catch (error) {
      window.PortalAPI.showToast(error.message, "error");
    }
  });

  studentsTableBody.addEventListener("click", async (event) => {
    const editBtn = event.target.closest("[data-edit-student]");
    const deleteBtn = event.target.closest("[data-delete-student]");
    const blockBtn = event.target.closest("[data-block-student]");

    if (editBtn) {
      const sid = editBtn.dataset.editStudent;
      const row = studentsCache.find((s) => s.studentId === sid);
      if (!row) return;
      const name = window.prompt("Edit name:", row.name);
      if (name === null) return;
      const className = window.prompt("Edit class:", row.class);
      if (className === null) return;
      const parentMobile = window.prompt("Edit parent mobile:", row.parentMobile);
      if (parentMobile === null) return;
      try {
        await window.PortalAPI.apiFetch(`/students/${encodeURIComponent(sid)}`, {
          method: "PUT",
          auth: "admin",
          body: JSON.stringify({ name, class: className, parentMobile })
        });
        await fetchStudents();
        window.PortalAPI.showToast("Student updated.", "success");
      } catch (error) {
        window.PortalAPI.showToast(error.message, "error");
      }
      return;
    }

    if (deleteBtn) {
      const sid = deleteBtn.dataset.deleteStudent;
      if (!window.confirm(`Delete student ${sid}?`)) return;
      try {
        await window.PortalAPI.apiFetch(`/students/${encodeURIComponent(sid)}`, {
          method: "DELETE",
          auth: "admin"
        });
        await Promise.all([fetchAdminStats(), fetchStudents()]);
        window.PortalAPI.showToast("Student deleted.", "success");
      } catch (error) {
        window.PortalAPI.showToast(error.message, "error");
      }
      return;
    }

    if (blockBtn) {
      const sid = blockBtn.dataset.blockStudent;
      const currentStatus = blockBtn.dataset.status;
      const action = currentStatus === "active" ? "block" : "unblock";
      try {
        await window.PortalAPI.apiFetch("/block", {
          method: "POST",
          auth: "admin",
          body: JSON.stringify({ studentId: sid, action })
        });
        await fetchStudents();
        window.PortalAPI.showToast(`Student ${action}ed.`, "success");
      } catch (error) {
        window.PortalAPI.showToast(error.message, "error");
      }
    }
  });

  addTestForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(addTestForm).entries());
    const payload = {
      testId: data.testId,
      title: data.title,
      class: data.class,
      duration: Number(data.duration),
      marks: {
        correct: Number(data.correct),
        wrong: Number(data.wrong),
        skip: Number(data.skip)
      },
      shuffleQuestions: Boolean(data.shuffleQuestions)
    };

    try {
      await window.PortalAPI.apiFetch("/tests", {
        method: "POST",
        auth: "admin",
        body: JSON.stringify(payload)
      });
      addTestForm.reset();
      await Promise.all([fetchAdminStats(), fetchTests()]);
      window.PortalAPI.showToast("Test created.", "success");
    } catch (error) {
      window.PortalAPI.showToast(error.message, "error");
    }
  });

  questionTypeEl.addEventListener("change", () => {
    const isMcq = questionTypeEl.value === "mcq";
    mcqOptionsWrap.classList.toggle("hidden", !isMcq);
  });

  addQuestionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(addQuestionForm).entries());
    const type = data.type;
    const options = type === "mcq"
      ? [data.optionA, data.optionB, data.optionC, data.optionD].filter(Boolean)
      : [];

    const payload = {
      testId: data.testId,
      qId: data.qId,
      type,
      questionEn: data.questionEn,
      questionHi: data.questionHi,
      options,
      answer: data.answer,
      imageUrl: data.imageUrl || ""
    };

    try {
      await window.PortalAPI.apiFetch("/questions", {
        method: "POST",
        auth: "admin",
        body: JSON.stringify(payload)
      });
      addQuestionForm.reset();
      window.PortalAPI.showToast("Question added.", "success");
      await Promise.all([fetchAdminStats(), fetchTests()]);
    } catch (error) {
      window.PortalAPI.showToast(error.message, "error");
    }
  });

  discussionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(discussionForm).entries());
    try {
      await window.PortalAPI.apiFetch("/discussions", {
        method: "POST",
        auth: "admin",
        body: JSON.stringify(data)
      });
      discussionForm.reset();
      await fetchDiscussions();
      window.PortalAPI.showToast("Announcement posted.", "success");
    } catch (error) {
      window.PortalAPI.showToast(error.message, "error");
    }
  });

  adminChatForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const sid = messageStudentSelectEl.value;
    const text = adminChatInput.value.trim();
    if (!sid) {
      window.PortalAPI.showToast("Select a student first.", "error");
      return;
    }
    if (!text) return;
    adminChatInput.value = "";
    try {
      await window.PortalAPI.apiFetch("/message", {
        method: "POST",
        auth: "admin",
        body: JSON.stringify({ studentId: sid, text })
      });
      await fetchChat();
    } catch (error) {
      window.PortalAPI.showToast(error.message, "error");
    }
  });
}

async function boot() {
  attachEvents();
  activateTab("overview");

  if (!window.PortalAPI.requireAdminPageAuth()) {
    adminAuthCard.classList.remove("hidden");
    adminPanel.classList.add("hidden");
    return;
  }

  try {
    adminAuthCard.classList.add("hidden");
    adminPanel.classList.remove("hidden");
    await refreshEverything();
    chatPollRef = setInterval(fetchChat, 12000);
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      window.PortalAPI.clearAdminSession();
      adminPanel.classList.add("hidden");
      adminAuthCard.classList.remove("hidden");
      return;
    }
    window.PortalAPI.showToast(error.message, "error");
  }
}

boot();

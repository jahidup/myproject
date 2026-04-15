const API_BASE = "/api";
const STUDENT_TOKEN_KEY = "studentToken";
const ADMIN_TOKEN_KEY = "adminToken";
const STUDENT_PROFILE_KEY = "studentProfile";

function getStudentToken() {
  return localStorage.getItem(STUDENT_TOKEN_KEY);
}

function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

function setStudentSession(token, student) {
  localStorage.setItem(STUDENT_TOKEN_KEY, token);
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  if (student) {
    localStorage.setItem(STUDENT_PROFILE_KEY, JSON.stringify(student));
  }
}

function setAdminSession(token) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
  localStorage.removeItem(STUDENT_TOKEN_KEY);
  localStorage.removeItem(STUDENT_PROFILE_KEY);
}

function clearStudentSession() {
  localStorage.removeItem(STUDENT_TOKEN_KEY);
  localStorage.removeItem(STUDENT_PROFILE_KEY);
}

function clearAdminSession() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

function getStoredStudentProfile() {
  const raw = localStorage.getItem(STUDENT_PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

function showToast(message, type = "info") {
  const node = document.createElement("div");
  node.className =
    "fixed right-4 top-4 z-[1000] px-4 py-3 rounded-xl shadow-xl text-sm font-medium transition-all duration-300";

  const palettes = {
    info: "bg-slate-900/90 text-cyan-200 border border-cyan-500/40",
    success: "bg-emerald-900/90 text-emerald-200 border border-emerald-500/40",
    error: "bg-rose-900/90 text-rose-200 border border-rose-500/40"
  };
  node.className += ` ${palettes[type] || palettes.info}`;
  node.textContent = message;
  document.body.appendChild(node);

  setTimeout(() => {
    node.style.opacity = "0";
    node.style.transform = "translateY(-8px)";
  }, 2600);

  setTimeout(() => node.remove(), 3200);
}

async function apiFetch(path, options = {}) {
  const config = { method: "GET", ...options };
  const headers = { ...(config.headers || {}) };

  if (!headers["Content-Type"] && config.body) {
    headers["Content-Type"] = "application/json";
  }

  if (config.auth === "student" && getStudentToken()) {
    headers.Authorization = `Bearer ${getStudentToken()}`;
  } else if (config.auth === "admin" && getAdminToken()) {
    headers.Authorization = `Bearer ${getAdminToken()}`;
  } else if (config.auth === "auto") {
    const token = getAdminToken() || getStudentToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...config,
    headers
  });

  let payload;
  try {
    payload = await response.json();
  } catch (_error) {
    payload = {};
  }

  if (!response.ok) {
    const error = new Error(payload.error || "Request failed");
    error.status = response.status;
    throw error;
  }

  return payload;
}

function requireStudentPageAuth() {
  if (!getStudentToken()) {
    window.location.href = "/index.html";
    return false;
  }
  return true;
}

function requireAdminPageAuth() {
  if (!getAdminToken()) {
    return false;
  }
  return true;
}

window.PortalAPI = {
  apiFetch,
  getStudentToken,
  getAdminToken,
  setStudentSession,
  setAdminSession,
  clearStudentSession,
  clearAdminSession,
  requireStudentPageAuth,
  requireAdminPageAuth,
  getStoredStudentProfile,
  showToast
};

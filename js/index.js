const studentForm = document.getElementById("studentLoginForm");
const adminForm = document.getElementById("adminLoginForm");

function normalizeDobInput(value) {
  return String(value || "").replace(/\D/g, "");
}

if (studentForm) {
  studentForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const studentId = document.getElementById("studentId").value.trim();
    const dob = normalizeDobInput(document.getElementById("studentDob").value.trim());

    if (!studentId || !/^\d{8}$/.test(dob)) {
      window.PortalAPI.showToast("Enter valid Student ID and DOB (DDMMYYYY).", "error");
      return;
    }

    const submitBtn = studentForm.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    submitBtn.textContent = "Logging in...";

    try {
      const { token, student } = await window.PortalAPI.apiFetch("/login", {
        method: "POST",
        body: JSON.stringify({ studentId, dob })
      });

      window.PortalAPI.setStudentSession(token, student);
      window.PortalAPI.showToast("Login successful. Opening dashboard...", "success");
      setTimeout(() => {
        window.location.href = "/dashboard.html";
      }, 500);
    } catch (error) {
      window.PortalAPI.showToast(error.message, "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Login as Student";
    }
  });
}

if (adminForm) {
  adminForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = document.getElementById("adminPassword").value;
    if (!password) {
      window.PortalAPI.showToast("Enter admin password.", "error");
      return;
    }

    const submitBtn = adminForm.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    submitBtn.textContent = "Checking...";

    try {
      const { token } = await window.PortalAPI.apiFetch("/admin/login", {
        method: "POST",
        body: JSON.stringify({ password })
      });

      window.PortalAPI.setAdminSession(token);
      window.PortalAPI.showToast("Admin login successful.", "success");
      setTimeout(() => {
        window.location.href = "/admin.html";
      }, 450);
    } catch (error) {
      window.PortalAPI.showToast(error.message, "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Login as Admin";
    }
  });
}

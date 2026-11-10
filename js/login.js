(() => {
  "use strict";
  const api = window.NamaProdukAPI;
  const ui = window.NamaProdukUI;
  document.addEventListener("DOMContentLoaded", async () => {
    ui.applyProductName();
    const error = document.getElementById("login-error");
    try {
      const existing = await api.getSesiMitra();
      if (existing) {
        window.location.href = "dashboard.html";
        return;
      }
    } catch (sessionError) {
      error.textContent =
        sessionError.message ||
        "Sesi belum dapat diperiksa. Silakan coba lagi.";
      error.hidden = false;
    }
    document
      .getElementById("login-form")
      .addEventListener("submit", async (event) => {
        event.preventDefault();
        error.hidden = true;
        try {
          await api.loginMitra(
            document.getElementById("email").value,
            document.getElementById("password").value,
          );
          window.location.href = "dashboard.html";
        } catch (loginError) {
          error.textContent =
            loginError.message || "Tidak dapat masuk. Silakan coba lagi.";
          error.hidden = false;
        }
      });
  });
})();

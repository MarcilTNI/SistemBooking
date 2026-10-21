(function () {
  "use strict";
  var api = window.NamaProdukAPI;
  var ui = window.NamaProdukUI;
  document.addEventListener("DOMContentLoaded", async function () {
    ui.applyProductName();
    var existing = await api.getSesiMitra();
    if (existing) {
      window.location.href = "dashboard.html";
      return;
    }
    document.getElementById("login-form").addEventListener("submit", async function (event) {
      event.preventDefault();
      var error = document.getElementById("login-error");
      error.hidden = true;
      try {
        await api.loginMitra(document.getElementById("email").value, document.getElementById("password").value);
        window.location.href = "dashboard.html";
      } catch (loginError) {
        error.textContent = loginError.message || "Tidak dapat masuk. Silakan coba lagi.";
        error.hidden = false;
      }
    });
  });
})();

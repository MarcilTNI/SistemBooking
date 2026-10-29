(function () {
  "use strict";
  var api = window.NamaProdukAPI;
  var ui = window.NamaProdukUI;
  var dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

  document.addEventListener("DOMContentLoaded", initialize);

  async function initialize() {
    ui.applyProductName();
    ui.setPageBrand("Admin", "Admin | " + ui.PRODUCT_NAME);
    renderScheduleInputs();
    addServiceRow();
    document.getElementById("admin-login-form").addEventListener("submit", login);
    document.getElementById("admin-logout").addEventListener("click", logout);
    document.getElementById("merchant-schedule").addEventListener("change", toggleDay);
    document.getElementById("initial-services").addEventListener("click", removeService);
    document.getElementById("add-initial-service").addEventListener("click", addServiceRow);
    document.getElementById("merchant-form").addEventListener("submit", createMerchant);
    document.getElementById("admin-contact-form").addEventListener("submit", saveAdminContact);
    document.getElementById("merchant-list").addEventListener("submit", saveMerchantPhone);
    try {
      var admin = await api.getSesiAdmin();
      if (admin) await showWorkspace(admin.email);
    } catch (error) {
      showLoginError(error.message);
    }
  }

  async function login(event) {
    event.preventDefault();
    showLoginError("");
    try {
      await api.loginAdmin(
        document.getElementById("admin-login-email").value,
        document.getElementById("admin-login-password").value,
      );
      var admin = await api.getSesiAdmin();
      if (!admin) {
        await api.logoutMitra();
        throw new Error("Akun ini belum terdaftar sebagai pengelola platform.");
      }
      await showWorkspace(admin.email);
    } catch (error) {
      showLoginError(error.message || "Tidak dapat masuk.");
    }
  }

  async function showWorkspace(email) {
    document.getElementById("admin-login-panel").hidden = true;
    document.getElementById("admin-workspace").hidden = false;
    document.getElementById("admin-logout").hidden = false;
    document.getElementById("admin-email").textContent = email || "Pengelola";
    await Promise.all([renderMerchants(), loadAdminContact()]);
  }

  async function logout() {
    try {
      await api.logoutMitra();
      window.location.reload();
    } catch (error) {
      showPageError(error.message);
    }
  }

  function showLoginError(message) {
    var element = document.getElementById("admin-login-error");
    element.textContent = message;
    element.hidden = !message;
  }

  function showPageError(message) {
    var element = document.getElementById("admin-page-error");
    element.textContent = message;
    element.hidden = !message;
  }

  async function loadAdminContact() {
    var error = document.getElementById("admin-contact-error");
    try {
      document.getElementById("admin-contact-phone").value = await api.getKontakWhatsAppAdmin();
      error.hidden = true;
    } catch (loadError) {
      error.textContent = loadError.message || "Kontak WhatsApp admin tidak dapat dimuat.";
      error.hidden = false;
    }
  }

  async function saveAdminContact(event) {
    event.preventDefault();
    var form = event.target;
    var input = document.getElementById("admin-contact-phone");
    var error = document.getElementById("admin-contact-error");
    var success = document.getElementById("admin-contact-success");
    var button = form.querySelector('button[type="submit"]');
    error.hidden = true;
    success.hidden = true;
    try {
      var phone = ui.phoneToWhatsApp(input.value);
      if (!/^[0-9]{10,15}$/.test(phone)) {
        throw new Error("Masukkan nomor WhatsApp yang valid, termasuk kode negara. Contoh: 6281234567890.");
      }
      button.disabled = true;
      await api.simpanKontakWhatsAppAdmin(phone);
      input.value = phone;
      success.textContent = "Kontak admin berhasil disimpan dan tersedia untuk pemilik mitra yang masuk.";
      success.hidden = false;
    } catch (saveError) {
      error.textContent = saveError.message || "Kontak WhatsApp admin tidak dapat disimpan.";
      error.hidden = false;
    } finally {
      button.disabled = false;
    }
  }

  async function saveMerchantPhone(event) {
    var form = event.target.closest("[data-merchant-phone-form]");
    if (!form) return;
    event.preventDefault();
    var input = form.querySelector("[data-merchant-phone]");
    var error = form.querySelector("[data-merchant-phone-error]");
    var button = form.querySelector('button[type="submit"]');
    error.hidden = true;
    document.getElementById("merchant-list-status").hidden = true;
    try {
      var phone = ui.phoneToWhatsApp(input.value);
      if (!/^[0-9]{10,15}$/.test(phone)) {
        throw new Error("Masukkan nomor WhatsApp valid, contoh: 6281234567890.");
      }
      button.disabled = true;
      await api.simpanNomorWhatsAppMitra(form.dataset.mitraId, phone);
      input.value = phone;
      var status = document.getElementById("merchant-list-status");
      status.textContent = "Nomor WhatsApp usaha berhasil diperbarui. Pelanggan akan menghubungi nomor ini.";
      status.hidden = false;
    } catch (saveError) {
      error.textContent = saveError.message || "Nomor WhatsApp usaha belum dapat diperbarui.";
      error.hidden = false;
    } finally {
      button.disabled = false;
    }
  }

  function renderScheduleInputs() {
    var container = document.getElementById("merchant-schedule");
    container.innerHTML = dayNames.map(function (name, index) {
      var openByDefault = index >= 1 && index <= 5;
      var disabled = openByDefault ? "" : " disabled";
      return '<fieldset class="admin-day"><legend class="visually-hidden">' + name + '</legend><div class="admin-day-heading"><input type="checkbox" data-open-day="' + index + '" id="new-open-' + index + '" ' + (openByDefault ? "checked" : "") + '><label for="new-open-' + index + '">' + name + '</label></div><div class="admin-time-pair"><label for="new-start-' + index + '">Buka<input id="new-start-' + index + '" type="time" value="09:00"' + disabled + ' required></label><label for="new-end-' + index + '">Tutup<input id="new-end-' + index + '" type="time" value="17:00"' + disabled + ' required></label></div><div class="admin-time-pair"><label for="new-break-start-' + index + '">Istirahat<input id="new-break-start-' + index + '" type="time" value="13:00"' + disabled + '></label><label for="new-break-end-' + index + '">Sampai<input id="new-break-end-' + index + '" type="time" value="14:00"' + disabled + '></label></div></fieldset>';
    }).join("");
  }

  function toggleDay(event) {
    var checkbox = event.target.closest("[data-open-day]");
    if (!checkbox) return;
    var day = checkbox.dataset.openDay;
    ["start", "end", "break-start", "break-end"].forEach(function (part) {
      var input = document.getElementById("new-" + part + "-" + day);
      input.disabled = !checkbox.checked;
      input.required = checkbox.checked && (part === "start" || part === "end");
    });
  }

  function addServiceRow() {
    var container = document.getElementById("initial-services");
    var row = document.createElement("div");
    row.className = "initial-service-row";
    row.innerHTML = '<label>Nama layanan<input data-service-name maxlength="80" required></label><label>Durasi (menit)<input data-service-duration type="number" min="30" max="480" step="30" value="30" required></label><label>Harga (Rp)<input data-service-price type="number" min="0" step="1000" value="0" required></label><button class="button button-secondary remove-service" type="button" aria-label="Hapus layanan ini">Hapus</button>';
    container.appendChild(row);
  }

  function removeService(event) {
    var button = event.target.closest(".remove-service");
    if (!button) return;
    var rows = document.querySelectorAll(".initial-service-row");
    if (rows.length === 1) {
      rows[0].querySelector("[data-service-name]").value = "";
      return;
    }
    button.closest(".initial-service-row").remove();
  }

  function collectSchedule() {
    var schedule = [];
    for (var day = 0; day < 7; day += 1) {
      var buka = document.getElementById("new-open-" + day).checked;
      var mulai = document.getElementById("new-start-" + day).value;
      var selesai = document.getElementById("new-end-" + day).value;
      var istirahatMulai = document.getElementById("new-break-start-" + day).value;
      var istirahatSelesai = document.getElementById("new-break-end-" + day).value;
      if (buka && (!mulai || !selesai || mulai >= selesai)) {
        throw new Error("Jam buka dan tutup untuk " + dayNames[day] + " belum valid.");
      }
      if (buka && ((istirahatMulai && !istirahatSelesai) || (!istirahatMulai && istirahatSelesai) || (istirahatMulai && (istirahatMulai < mulai || istirahatMulai >= istirahatSelesai || istirahatSelesai > selesai)))) {
        throw new Error("Rentang istirahat " + dayNames[day] + " harus berada di antara jam buka dan tutup.");
      }
      schedule.push({
        hari: day,
        buka: buka,
        jam_mulai: buka ? mulai : null,
        jam_selesai: buka ? selesai : null,
        istirahat_mulai: buka ? istirahatMulai || null : null,
        istirahat_selesai: buka ? istirahatSelesai || null : null,
      });
    }
    return schedule;
  }

  async function createMerchant(event) {
    event.preventDefault();
    var error = document.getElementById("merchant-form-error");
    error.hidden = true;
    try {
      var schedule = collectSchedule();
      var serviceRows = Array.from(document.querySelectorAll(".initial-service-row"));
      var services = serviceRows.map(function (row) {
        return {
          nama: row.querySelector("[data-service-name]").value.trim(),
          durasi: Number(row.querySelector("[data-service-duration]").value),
          harga: Number(row.querySelector("[data-service-price]").value),
        };
      });
      if (!services.length || services.some(function (item) {
        return item.nama.length < 2 || item.durasi < 30 || item.durasi > 480 || item.durasi % 30 !== 0 || item.harga < 0;
      })) {
        throw new Error("Isi minimal satu layanan dengan durasi 30–480 menit dan harga yang valid.");
      }
      var merchantPhone = ui.phoneToWhatsApp(document.getElementById("merchant-phone").value);
      if (!/^[0-9]{10,15}$/.test(merchantPhone)) {
        throw new Error("Masukkan nomor WhatsApp usaha yang valid, contoh: 6281234567890.");
      }
      var result = await api.adminTambahMitra({
        slug: document.getElementById("merchant-slug").value.trim().toLowerCase(),
        nama: document.getElementById("merchant-name").value.trim(),
        kategori: document.getElementById("merchant-category").value.trim(),
        alamat: document.getElementById("merchant-address").value.trim(),
        telepon: merchantPhone,
        emailPemilik: document.getElementById("merchant-owner-email").value.trim(),
        jadwal: schedule,
        layanan: services,
      });
      event.target.reset();
      renderScheduleInputs();
      document.getElementById("initial-services").innerHTML = "";
      addServiceRow();
      await renderMerchants();
      showPageError("");
      window.alert("Usaha " + result.nama + " berhasil didaftarkan. Link booking: " + window.location.origin + window.location.pathname.replace(/admin\/index\.html$/, "") + "booking.html?mitra=" + result.slug);
    } catch (submitError) {
      error.textContent = submitError.message || "Usaha belum dapat didaftarkan.";
      error.hidden = false;
    }
  }

  async function renderMerchants() {
    var container = document.getElementById("merchant-list");
    try {
      var merchants = await api.listMitraAdmin();
      if (!merchants.length) {
        container.innerHTML = '<div class="empty-panel">Belum ada usaha terdaftar.</div>';
        return;
      }
      var publicBase = new URL("../", window.location.href);
      container.innerHTML = merchants.map(function (merchant) {
        var href = new URL("booking.html?mitra=" + encodeURIComponent(merchant.slug), publicBase).href;
        return '<article class="admin-merchant-card"><h3>' + ui.escapeHtml(merchant.nama) + '</h3><p>' + ui.escapeHtml(merchant.email || "Email pemilik belum dicatat") + '</p><a href="' + ui.escapeHtml(href) + '" target="_blank" rel="noopener noreferrer">Buka link booking</a><form class="merchant-phone-form" data-merchant-phone-form data-mitra-id="' + ui.escapeHtml(merchant.id) + '"><label>WhatsApp usaha untuk pelanggan<input type="tel" inputmode="tel" data-merchant-phone value="' + ui.escapeHtml(merchant.telepon || "") + '" placeholder="6281234567890" required></label><button class="button button-secondary" type="submit">Simpan nomor</button><p class="merchant-phone-error" data-merchant-phone-error role="alert" hidden></p></form></article>';
      }).join("");
    } catch (error) {
      showPageError(error.message || "Daftar usaha tidak dapat dimuat.");
    }
  }
})();

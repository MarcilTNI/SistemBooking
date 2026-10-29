(function () {
  "use strict";
  var api = window.NamaProdukAPI;
  var ui = window.NamaProdukUI;
  var session;
  var activeTab = "bookings";
  var today = formatInputDate(new Date());

  document.addEventListener("DOMContentLoaded", initialize);

  async function initialize() {
    ui.applyProductName();
    try {
      session = await api.getSesiMitra();
      if (!session) {
        window.location.href = "login.html";
        return;
      }
      document.getElementById("header-mitra-name").textContent = session.nama;
      document.getElementById("dashboard-business-name").textContent =
        session.nama;
      var bookingLink = document.getElementById("public-booking-link");
      bookingLink.href =
        "../booking.html?mitra=" + encodeURIComponent(session.slug);
      await renderAdminContactLink();
      document.getElementById("booking-date").value = today;
      document.getElementById("schedule-date").value = today;
      bindEvents();
      await refreshAll();
    } catch (error) {
      showError(
        error.message || "Dashboard tidak dapat dimuat. Silakan masuk kembali.",
      );
    }
  }

  async function renderAdminContactLink() {
    var link = document.getElementById("contact-admin-link");
    try {
      var phone = await api.getKontakWhatsAppAdmin();
      if (!phone) {
        throw new Error("Kontak WhatsApp pengelola belum diatur.");
      }
      var message = "Halo pengelola " + ui.PRODUCT_NAME + ", saya dari " + session.nama + ". Saya ingin menghubungi admin platform.";
      link.href = "https://wa.me/" + phone + "?text=" + encodeURIComponent(message);
      link.hidden = false;
    } catch (error) {
      showError(error.message || "Kontak pengelola platform belum dapat dimuat.");
    }
  }

  function bindEvents() {
    document
      .getElementById("logout-button")
      .addEventListener("click", async function () {
        try {
          await api.logoutMitra();
          window.location.href = "login.html";
        } catch (error) {
          showError(error.message || "Tidak dapat keluar. Silakan coba lagi.");
        }
      });
    document.querySelectorAll(".tab-button").forEach(function (button) {
      button.addEventListener("click", function () {
        activateTab(button.dataset.tab);
      });
    });
    document
      .getElementById("booking-date")
      .addEventListener("change", renderBookings);
    document
      .getElementById("booking-status")
      .addEventListener("change", renderBookings);
    document
      .getElementById("schedule-date")
      .addEventListener("change", renderSchedule);
    document
      .getElementById("weekly-hours-list")
      .addEventListener("change", handleWeeklyHoursToggle);
    document
      .getElementById("weekly-hours-form")
      .addEventListener("submit", saveWeeklyHours);
    document
      .getElementById("booking-list")
      .addEventListener("click", handleBookingAction);
    document
      .getElementById("schedule-grid")
      .addEventListener("click", handleScheduleAction);
    document
      .getElementById("add-service-button")
      .addEventListener("click", function () {
        openServiceDialog();
      });
    document
      .getElementById("service-list")
      .addEventListener("click", handleServiceAction);
    document
      .getElementById("close-service-dialog")
      .addEventListener("click", closeServiceDialog);
    document
      .getElementById("cancel-service")
      .addEventListener("click", closeServiceDialog);
    document
      .getElementById("service-form")
      .addEventListener("submit", saveService);
  }

  function activateTab(tab) {
    activeTab = tab;
    document.querySelectorAll(".tab-button").forEach(function (button) {
      var selected = button.dataset.tab === tab;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-selected", String(selected));
    });
    document.querySelectorAll(".dashboard-panel").forEach(function (panel) {
      panel.hidden = panel.id !== "panel-" + tab;
    });
    if (tab === "schedule") {
      renderSchedule();
      renderWeeklyHours();
    }
    if (tab === "services") renderServices();
  }

  async function refreshAll() {
    await Promise.all([
      renderStats(),
      renderBookings(),
      renderSchedule(),
      renderWeeklyHours(),
      renderServices(),
    ]);
  }

  async function renderStats() {
    var summary = await api.getRingkasan(session.id, today);
    document.getElementById("stat-bookings").textContent = summary.booking;
    document.getElementById("stat-pending").textContent = summary.menunggu;
    document.getElementById("stat-available").textContent = summary.slotKosong;
  }

  async function renderBookings() {
    var date = document.getElementById("booking-date").value;
    var status = document.getElementById("booking-status").value;
    var list = document.getElementById("booking-list");
    var bookings = await api.listBooking(session.id, date);
    if (status !== "semua")
      bookings = bookings.filter(function (item) {
        return item.status === status;
      });
    if (!bookings.length) {
      list.innerHTML =
        '<div class="empty-panel">Belum ada booking pada tanggal dan status ini.</div>';
      return;
    }
    list.innerHTML = bookings
      .map(function (item) {
        var statusLabel =
          item.status.charAt(0).toUpperCase() + item.status.slice(1);
        var wa =
          "https://wa.me/" +
          ui.phoneToWhatsApp(item.telepon) +
          "?text=" +
          encodeURIComponent(
            "Halo " +
              item.nama +
              ", saya dari " +
              session.nama +
              " terkait booking " +
              item.kode +
              ".",
          );
        return (
          '<article class="booking-row"><div class="booking-customer"><strong>' +
          ui.escapeHtml(item.nama) +
          "</strong><span>" +
          ui.escapeHtml(item.telepon) +
          " · " +
          item.jumlahOrang +
          " orang · " +
          ui.escapeHtml(item.kode) +
          '</span></div><div class="booking-detail"><strong>' +
          ui.escapeHtml(item.layananNama) +
          "</strong><span>" +
          item.jamMulai +
          "–" +
          item.jamSelesai +
          " · " +
          ui.escapeHtml(
            ui.formatTanggal(item.tanggal, { day: "numeric", month: "short" }),
          ) +
          '</span></div><span class="status-badge status-' +
          item.status +
          '">' +
          statusLabel +
          '</span><div class="booking-actions">' +
          (item.status === "menunggu"
            ? '<button class="button button-primary" type="button" data-booking-action="diterima" data-id="' +
              ui.escapeHtml(item.id) +
              '">Terima</button>'
            : "") +
          (item.status !== "dibatalkan"
            ? '<button class="button button-secondary" type="button" data-booking-action="dibatalkan" data-id="' +
              ui.escapeHtml(item.id) +
              '">Batalkan</button>'
            : "") +
          '<a class="button button-secondary" href="' +
          wa +
          '" target="_blank" rel="noopener noreferrer">WhatsApp</a></div></article>'
        );
      })
      .join("");
  }

  async function handleBookingAction(event) {
    var button = event.target.closest("[data-booking-action]");
    if (!button) return;
    button.disabled = true;
    try {
      await api.updateStatusBooking(
        button.dataset.id,
        button.dataset.bookingAction,
      );
      await refreshAll();
    } catch (error) {
      showError(error.message);
      button.disabled = false;
    }
  }

  async function renderSchedule() {
    var date = document.getElementById("schedule-date").value;
    var grid = document.getElementById("schedule-grid");
    if (!date) return;
    try {
      var slots = await api.getJadwalHarian(session.id, date);
      if (!slots.length) {
        grid.innerHTML =
          '<div class="empty-panel">Jadwal belum tersedia.</div>';
        return;
      }
      grid.innerHTML = slots
        .map(function (slot) {
          var label =
            slot.status === "terisi"
              ? "Terisi"
              : slot.status === "istirahat"
                ? "Istirahat"
              : slot.status === "ditutup"
                ? "Ditutup"
                : slot.status === "lewat"
                  ? "Lewat"
                  : "Kosong";
          var canToggle = slot.status === "kosong" || slot.status === "ditutup";
          return (
            '<article class="schedule-slot is-' +
            (slot.status === "kosong"
              ? "available"
              : slot.status === "terisi"
                ? "booked"
                : slot.status === "ditutup" || slot.status === "istirahat"
                  ? "closed"
                  : "past") +
            '"><strong>' +
            slot.jamMulai +
            "–" +
            slot.jamSelesai +
            "</strong><span>" +
            label +
            (slot.bookingKode ? " · " + ui.escapeHtml(slot.bookingKode) : "") +
            "</span>" +
            (canToggle
              ? '<button type="button" class="schedule-toggle" data-schedule-action="' +
                (slot.status === "kosong" ? "tutup" : "buka") +
                '" data-start="' +
                slot.jamMulai +
                '" data-end="' +
                slot.jamSelesai +
                '">' +
                (slot.status === "kosong" ? "Tutup slot" : "Buka slot") +
                "</button>"
              : "") +
            "</article>"
          );
        })
        .join("");
    } catch (error) {
      grid.innerHTML =
        '<div class="empty-panel">' + ui.escapeHtml(error.message) + "</div>";
    }
  }

  async function renderWeeklyHours() {
    var list = document.getElementById("weekly-hours-list");
    if (!list) return;
    try {
      var schedule = await api.getJadwalMingguan(session.id);
      var byDay = {};
      schedule.forEach(function (item) { byDay[item.hari] = item; });
      var dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      list.innerHTML = dayNames.map(function (name, index) {
        var item = byDay[index] || { buka: false, jamMulai: "", jamSelesai: "", istirahatMulai: "", istirahatSelesai: "" };
        var disabled = item.buka ? "" : " disabled";
        return '<fieldset class="weekly-day"><legend class="visually-hidden">' + name + '</legend><div class="weekly-day-heading"><input type="checkbox" id="weekly-open-' + index + '" data-day-open="' + index + '" ' + (item.buka ? "checked" : "") + '><label for="weekly-open-' + index + '"><strong>' + name + '</strong></label></div><div class="weekly-time-field"><label for="weekly-start-' + index + '">Buka<input id="weekly-start-' + index + '" type="time" data-day-field="jam_mulai" value="' + item.jamMulai + '"' + disabled + ' required></label><label for="weekly-end-' + index + '">Tutup<input id="weekly-end-' + index + '" type="time" data-day-field="jam_selesai" value="' + item.jamSelesai + '"' + disabled + ' required></label></div><div class="weekly-time-field"><label for="weekly-break-start-' + index + '">Istirahat mulai<input id="weekly-break-start-' + index + '" type="time" data-day-field="istirahat_mulai" value="' + item.istirahatMulai + '"' + disabled + '></label><label for="weekly-break-end-' + index + '">Istirahat selesai<input id="weekly-break-end-' + index + '" type="time" data-day-field="istirahat_selesai" value="' + item.istirahatSelesai + '"' + disabled + '></label></div></fieldset>';
      }).join("");
    } catch (error) {
      showError(error.message || "Jadwal mingguan belum dapat dimuat.");
    }
  }

  function handleWeeklyHoursToggle(event) {
    var checkbox = event.target.closest("[data-day-open]");
    if (!checkbox) return;
    var day = checkbox.dataset.dayOpen;
    document.querySelectorAll('[id$="-'+ day + '"][data-day-field]').forEach(function (input) {
      input.disabled = !checkbox.checked;
      input.required = checkbox.checked && (input.dataset.dayField === "jam_mulai" || input.dataset.dayField === "jam_selesai");
    });
  }

  async function saveWeeklyHours(event) {
    event.preventDefault();
    var errorBox = document.getElementById("weekly-hours-error");
    errorBox.hidden = true;
    var schedule = [];
    for (var day = 0; day < 7; day += 1) {
      var isOpen = document.getElementById("weekly-open-" + day).checked;
      var getTime = function (field) {
        return document.getElementById("weekly-" + field.replace("_", "-") + "-" + day).value || null;
      };
      var start = getTime("start");
      var end = getTime("end");
      var breakStart = document.getElementById("weekly-break-start-" + day).value || null;
      var breakEnd = document.getElementById("weekly-break-end-" + day).value || null;
      if (isOpen && (!start || !end || start >= end)) {
        errorBox.textContent = "Jam buka dan tutup harus diisi dengan rentang waktu yang valid.";
        errorBox.hidden = false;
        return;
      }
      if (isOpen && ((breakStart && !breakEnd) || (!breakStart && breakEnd) || (breakStart && (breakStart < start || breakStart >= breakEnd || breakEnd > end)))) {
        errorBox.textContent = "Jam istirahat harus berada di antara jam buka dan tutup.";
        errorBox.hidden = false;
        return;
      }
      schedule.push({
        hari: day,
        buka: isOpen,
        jam_mulai: isOpen ? start : null,
        jam_selesai: isOpen ? end : null,
        istirahat_mulai: isOpen ? breakStart : null,
        istirahat_selesai: isOpen ? breakEnd : null,
      });
    }
    try {
      await api.simpanJadwalMingguan(session.id, schedule);
      await Promise.all([renderWeeklyHours(), renderSchedule(), renderStats()]);
    } catch (error) {
      errorBox.textContent = error.message || "Jadwal tidak dapat disimpan.";
      errorBox.hidden = false;
    }
  }

  async function handleScheduleAction(event) {
    var button = event.target.closest("[data-schedule-action]");
    if (!button) return;
    button.disabled = true;
    var date = document.getElementById("schedule-date").value;
    try {
      if (button.dataset.scheduleAction === "tutup")
        await api.tutupJam(
          session.id,
          date,
          button.dataset.start,
          button.dataset.end,
        );
      else
        await api.bukaJam(
          session.id,
          date,
          button.dataset.start,
          button.dataset.end,
        );
      await Promise.all([renderSchedule(), renderStats()]);
    } catch (error) {
      showError(error.message);
      button.disabled = false;
    }
  }

  async function renderServices() {
    var list = document.getElementById("service-list");
    var services = await api.listLayanan(session.id);
    if (!services.length) {
      list.innerHTML =
        '<div class="empty-panel">Belum ada layanan. Tambahkan layanan agar pelanggan dapat memesan.</div>';
      return;
    }
    list.innerHTML = services
      .map(function (item) {
        return (
          '<article class="service-admin-row"><div><h3>' +
          ui.escapeHtml(item.nama) +
          "</h3><p>" +
          item.durasi +
          " menit · " +
          ui.formatRupiah(item.harga) +
          '</p></div><div class="service-actions"><button class="button button-secondary" type="button" data-service-action="edit" data-id="' +
          ui.escapeHtml(item.id) +
          '">Ubah</button><button class="button button-secondary" type="button" data-service-action="delete" data-id="' +
          ui.escapeHtml(item.id) +
          '">Hapus</button></div></article>'
        );
      })
      .join("");
  }

  async function handleServiceAction(event) {
    var button = event.target.closest("[data-service-action]");
    if (!button) return;
    var services = await api.listLayanan(session.id);
    var service = services.find(function (item) {
      return item.id === button.dataset.id;
    });
    if (!service) return;
    if (button.dataset.serviceAction === "edit") {
      openServiceDialog(service);
      return;
    }
    if (!window.confirm('Hapus layanan "' + service.nama + '"?')) return;
    try {
      await api.hapusLayanan(service.id);
      await renderServices();
    } catch (error) {
      showError(error.message);
    }
  }

  function openServiceDialog(service) {
    var form = document.getElementById("service-form");
    form.reset();
    document.getElementById("service-form-error").hidden = true;
    document.getElementById("service-dialog-title").textContent = service
      ? "Ubah layanan"
      : "Tambah layanan";
    document.getElementById("service-id").value = service ? service.id : "";
    if (service) {
      document.getElementById("service-name").value = service.nama;
      document.getElementById("service-duration").value = service.durasi;
      document.getElementById("service-price").value = service.harga;
    }
    document.getElementById("service-dialog").showModal();
    document.getElementById("service-name").focus();
  }

  function closeServiceDialog() {
    document.getElementById("service-dialog").close();
  }

  async function saveService(event) {
    event.preventDefault();
    var id = document.getElementById("service-id").value;
    var input = {
      nama: document.getElementById("service-name").value,
      durasi: document.getElementById("service-duration").value,
      harga: document.getElementById("service-price").value,
    };
    try {
      if (id) await api.ubahLayanan(id, input);
      else await api.tambahLayanan(session.id, input);
      closeServiceDialog();
      await renderServices();
    } catch (error) {
      var errorBox = document.getElementById("service-form-error");
      errorBox.textContent = error.message;
      errorBox.hidden = false;
    }
  }

  function showError(message) {
    var element = document.getElementById("dashboard-error");
    element.textContent = message;
    element.hidden = false;
  }

  function formatInputDate(date) {
    return (
      date.getFullYear() +
      "-" +
      String(date.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(date.getDate()).padStart(2, "0")
    );
  }
})();

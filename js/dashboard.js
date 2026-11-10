(() => {
  "use strict";
  const api = window.NamaProdukAPI;
  const ui = window.NamaProdukUI;
  let session;
  const today = getJakartaDate();
  let bookingCache = [];
  let realtimeChannel;
  let refreshTimer;

  document.addEventListener("DOMContentLoaded", initialize);

  async function initialize() {
    ui.applyProductName();
    try {
      session = await api.getSesiMitra();
      if (!session) {
        window.location.href = "login.html";
        return;
      }
      ui.setPageBrand(session.nama, session.nama + " | Dashboard Mitra — " + ui.PRODUCT_NAME);
      document.getElementById("dashboard-business-name").textContent =
        session.nama;
      let bookingLink = document.getElementById("public-booking-link");
      bookingLink.href =
        "../booking.html?mitra=" + encodeURIComponent(session.slug);
      await renderAdminContactLink();
      document.getElementById("booking-date").value = today;
      document.getElementById("schedule-date").value = today;
      bindEvents();
      realtimeChannel = api.subscribeDashboardRealtime(
        session.id,
        scheduleRealtimeRefresh,
        handleRealtimeStatus,
      );
      await refreshAll();
    } catch (error) {
      showError(
        error.message || "Dashboard tidak dapat dimuat. Silakan masuk kembali.",
      );
    }
  }

  async function renderAdminContactLink() {
    let link = document.getElementById("contact-admin-link");
    try {
      let phone = await api.getKontakWhatsAppAdmin();
      if (!phone) {
        throw new Error("Kontak WhatsApp pengelola belum diatur.");
      }
      let message = "Halo pengelola " + ui.PRODUCT_NAME + ", saya dari " + session.nama + ". Saya ingin menghubungi admin platform.";
      link.href = "https://wa.me/" + phone + "?text=" + encodeURIComponent(message);
      link.hidden = false;
    } catch (error) {
      showError(error.message || "Kontak pengelola platform belum dapat dimuat.");
    }
  }

  function bindEvents() {
    document
      .getElementById("logout-button")
      .addEventListener("click", async () => {
        try {
          await api.unsubscribeDashboardRealtime(realtimeChannel);
          await api.logoutMitra();
          window.location.href = "login.html";
        } catch (error) {
          showError(error.message || "Tidak dapat keluar. Silakan coba lagi.");
        }
      });
    document.querySelectorAll(".tab-button").forEach((button) => {
      button.addEventListener("click", () => {
        activateTab(button.dataset.tab);
      });
      button.addEventListener("keydown", handleTabKeydown);
    });
    document
      .getElementById("booking-date-mode")
      .addEventListener("change", (event) => {
        let dateInput = document.getElementById("booking-date");
        dateInput.disabled = event.target.value !== "selected";
        renderBookings();
      });
    document
      .getElementById("booking-date")
      .addEventListener("change", renderBookings);
    document
      .getElementById("booking-status")
      .addEventListener("change", renderBookings);
    document
      .getElementById("booking-search")
      .addEventListener("input", renderBookings);
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
      .addEventListener("click", () => {
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
    document.querySelectorAll(".tab-button").forEach((button) => {
      let selected = button.dataset.tab === tab;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    document.querySelectorAll(".dashboard-panel").forEach((panel) => {
      panel.hidden = panel.id !== "panel-" + tab;
    });
    if (tab === "schedule") {
      renderSchedule();
      renderWeeklyHours();
    }
    if (tab === "services") renderServices();
  }

  function handleTabKeydown(event) {
    let tabs = Array.from(document.querySelectorAll(".tab-button"));
    let current = tabs.indexOf(event.currentTarget);
    let next = current;
    if (event.key === "ArrowRight") next = (current + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    tabs[next].focus();
    activateTab(tabs[next].dataset.tab);
  }

  async function refreshAll() {
    try {
      bookingCache = await api.listBooking(session.id);
      await Promise.all([
        renderStats(bookingCache),
        renderOverview(bookingCache),
        renderBookings(),
        renderCustomers(bookingCache),
        renderSchedule(),
        renderWeeklyHours(),
        renderServices(),
      ]);
    } catch (error) {
      showError(error.message || "Data dashboard belum dapat dimuat.");
    }
  }

  async function renderStats(bookings) {
    let todayBookings = bookings.filter((item) => {
      return item.tanggal === today;
    });
    let schedule = await api.getJadwalHarian(session.id, today);
    let acceptedRevenue = todayBookings.reduce((total, item) => {
      return total + (item.status === "diterima" ? item.hargaLayanan * item.jumlahOrang : 0);
    }, 0);
    document.getElementById("stat-bookings").textContent = todayBookings.length;
    document.getElementById("stat-revenue").textContent = ui.formatRupiah(acceptedRevenue);
    document.getElementById("stat-pending").textContent = todayBookings.filter((item) => {
      return item.status === "menunggu";
    }).length;
    document.getElementById("stat-available").textContent = schedule.filter((slot) => {
      return slot.status === "kosong";
    }).length;
  }

  function renderBookings() {
    let mode = document.getElementById("booking-date-mode").value;
    let date = document.getElementById("booking-date").value;
    let status = document.getElementById("booking-status").value;
    let search = document.getElementById("booking-search").value.trim().toLocaleLowerCase("id");
    let list = document.getElementById("booking-list");
    let bookings = bookingCache.filter((item) => {
      let matchesDate = mode !== "selected" || item.tanggal === date;
      let matchesStatus = status === "semua" || item.status === status;
      let matchesSearch = !search ||
        item.nama.toLocaleLowerCase("id").includes(search) ||
        item.kode.toLocaleLowerCase("id").includes(search);
      return matchesDate && matchesStatus && matchesSearch;
    }).sort((first, second) => {
      if (mode === "selected") return compareBookingDate(first, second);
      return String(second.dibuatPada || "").localeCompare(String(first.dibuatPada || ""));
    });
    document.getElementById("booking-result-count").textContent =
      bookings.length + " booking ditemukan.";
    if (!bookings.length) {
      list.innerHTML =
        '<div class="empty-panel">Tidak ada booking yang cocok dengan filter ini.</div>';
      return;
    }
    list.innerHTML = bookings.map((item) => {
      return bookingCard(item, true);
    }).join("");
  }

  async function renderOverview(bookings) {
    let lastSevenDays = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      lastSevenDays.push(addDays(today, -offset));
    }
    let dailyCounts = lastSevenDays.map((date) => {
      return bookings.filter((item) => {
        return item.tanggal === date;
      }).length;
    });
    let maxCount = Math.max.apply(null, dailyCounts.concat([1]));
    document.getElementById("weekly-trend").innerHTML = lastSevenDays.map((date, index) => {
      let height = dailyCounts[index] ? Math.max(8, Math.round(dailyCounts[index] / maxCount * 100)) : 0;
      return '<div class="trend-day"><span class="trend-count">' + dailyCounts[index] + '</span><div class="trend-track" aria-hidden="true"><span style="height:' + height + '%"></span></div><span class="trend-label">' + ui.escapeHtml(ui.formatTanggal(date, { weekday: "short" })) + '</span></div>';
    }).join("");
    let weekBookings = bookings.filter((item) => {
      return lastSevenDays.indexOf(item.tanggal) !== -1;
    });
    let statusCounts = {
      diterima: countStatus(weekBookings, "diterima"),
      menunggu: countStatus(weekBookings, "menunggu"),
      dibatalkan: countStatus(weekBookings, "dibatalkan"),
    };
    let total = weekBookings.length;
    document.getElementById("status-ratio").innerHTML = total
      ? '<div class="ratio-bar" role="img" aria-label="Diterima ' + statusCounts.diterima + ', menunggu ' + statusCounts.menunggu + ', dibatalkan ' + statusCounts.dibatalkan + '">' +
        ratioSegment("diterima", statusCounts.diterima, total) +
        ratioSegment("menunggu", statusCounts.menunggu, total) +
        ratioSegment("dibatalkan", statusCounts.dibatalkan, total) +
        '</div><ul class="ratio-legend"><li><span class="ratio-dot ratio-accepted"></span>Diterima <strong>' + statusCounts.diterima + '</strong></li><li><span class="ratio-dot ratio-waiting"></span>Menunggu <strong>' + statusCounts.menunggu + '</strong></li><li><span class="ratio-dot ratio-cancelled"></span>Dibatalkan <strong>' + statusCounts.dibatalkan + '</strong></li></ul>'
      : '<div class="empty-panel">Belum ada booking dalam 7 hari terakhir.</div>';
    let recent = bookings.slice(0, 5);
    document.getElementById("recent-bookings").innerHTML = recent.length
      ? recent.map((item) => { return bookingCard(item, false); }).join("")
      : '<div class="empty-panel">Belum ada booking terbaru.</div>';
  }

  function renderCustomers(bookings) {
    let list = document.getElementById("customer-list");
    list.innerHTML = bookings.length
      ? bookings.map((item) => {
          let message = "Halo " + item.nama + ", saya dari " + session.nama + " terkait booking " + item.kode + ".";
          let wa = "https://wa.me/" + ui.phoneToWhatsApp(item.telepon) + "?text=" + encodeURIComponent(message);
          return '<article class="customer-row"><div class="booking-customer"><strong>' + ui.escapeHtml(item.nama) + '</strong><span>' + ui.escapeHtml(item.telepon) + ' · ' + ui.escapeHtml(item.kode) + '</span></div><div class="booking-detail"><strong>' + ui.escapeHtml(item.layananNama) + ' · ' + item.jumlahOrang + ' orang</strong><span>' + ui.escapeHtml(ui.formatTanggal(item.tanggal, { day: "numeric", month: "short", year: "numeric" })) + ' · ' + item.jamMulai + '–' + item.jamSelesai + '</span></div><span class="status-badge status-' + item.status + '">' + statusLabel(item.status) + '</span><a class="button button-secondary button-small" href="' + wa + '" target="_blank" rel="noopener noreferrer">Hubungi via WhatsApp</a></article>';
        }).join("")
      : '<div class="empty-panel">Belum ada pelanggan yang memesan.</div>';
  }

  function bookingCard(item, includeActions) {
    let message = "Halo " + item.nama + ", saya dari " + session.nama + " terkait booking " + item.kode + ".";
    let wa = "https://wa.me/" + ui.phoneToWhatsApp(item.telepon) + "?text=" + encodeURIComponent(message);
    let dateLabel = ui.formatTanggal(item.tanggal, { day: "numeric", month: "short" });
    let actions = includeActions
      ? '<div class="booking-actions">' +
        (item.status === "menunggu" ? '<button class="button button-primary" type="button" data-booking-action="diterima" data-id="' + ui.escapeHtml(item.id) + '">Terima</button>' : "") +
        (item.status !== "dibatalkan" ? '<button class="button button-secondary" type="button" data-booking-action="dibatalkan" data-id="' + ui.escapeHtml(item.id) + '">Batalkan</button>' : "") +
        '<a class="button button-secondary" href="' + wa + '" target="_blank" rel="noopener noreferrer">WhatsApp</a></div>'
      : "";
    return '<article class="booking-row' + (includeActions ? "" : " booking-row-compact") + '"><div class="booking-customer"><strong>' + ui.escapeHtml(item.nama) + '</strong><span>' + ui.escapeHtml(item.telepon) + ' · ' + item.jumlahOrang + ' orang · ' + ui.escapeHtml(item.kode) + '</span></div><div class="booking-detail"><strong>' + ui.escapeHtml(item.layananNama) + '</strong><span>' + item.jamMulai + '–' + item.jamSelesai + ' · ' + ui.escapeHtml(dateLabel) + '</span></div><span class="status-badge status-' + item.status + '">' + statusLabel(item.status) + '</span>' + actions + '</article>';
  }

  function statusLabel(status) {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  function countStatus(bookings, status) {
    return bookings.filter((item) => { return item.status === status; }).length;
  }

  function ratioSegment(status, count, total) {
    return '<span class="ratio-segment ratio-' + (status === "diterima" ? "accepted" : status === "menunggu" ? "waiting" : "cancelled") + '" style="width:' + count / total * 100 + '%"></span>';
  }

  function compareBookingDate(first, second) {
    return first.tanggal.localeCompare(second.tanggal) ||
      first.jamMulai.localeCompare(second.jamMulai);
  }

  function addDays(date, amount) {
    let value = new Date(date + "T12:00:00+07:00");
    value.setUTCDate(value.getUTCDate() + amount);
    return value.toISOString().slice(0, 10);
  }

  function scheduleRealtimeRefresh() {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => {
      refreshAll().catch((error) => {
        showError(error.message || "Pembaruan data langsung gagal.");
      });
    }, 180);
  }

  function handleRealtimeStatus(status, error) {
    let indicator = document.getElementById("realtime-status");
    if (status === "SUBSCRIBED") {
      indicator.textContent = "Pembaruan langsung aktif";
      indicator.classList.add("is-connected");
      indicator.classList.remove("is-disconnected");
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      indicator.textContent = "Pembaruan langsung terputus";
      indicator.classList.remove("is-connected");
      indicator.classList.add("is-disconnected");
      showError((error && error.message) || "Realtime Supabase tidak dapat tersambung. Pastikan migrasi dashboard-realtime.sql sudah dijalankan.");
    } else if (status === "CLOSED") {
      indicator.textContent = "Pembaruan langsung tidak aktif";
      indicator.classList.remove("is-connected");
    }
  }

  async function handleBookingAction(event) {
    let button = event.target.closest("[data-booking-action]");
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
    let date = document.getElementById("schedule-date").value;
    let grid = document.getElementById("schedule-grid");
    if (!date) return;
    try {
      let slots = await api.getJadwalHarian(session.id, date);
      if (!slots.length) {
        grid.innerHTML =
          '<div class="empty-panel">Jadwal belum tersedia.</div>';
        return;
      }
      grid.innerHTML = slots
        .map((slot) => {
          let label =
            slot.status === "terisi"
              ? "Terisi"
              : slot.status === "istirahat"
                ? "Istirahat"
              : slot.status === "ditutup"
                ? "Ditutup"
                : slot.status === "lewat"
                  ? "Lewat"
                  : "Kosong";
          let canToggle = slot.status === "kosong" || slot.status === "ditutup";
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
    let list = document.getElementById("weekly-hours-list");
    if (!list) return;
    try {
      let schedule = await api.getJadwalMingguan(session.id);
      let byDay = {};
      schedule.forEach((item) => { byDay[item.hari] = item; });
      let dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      list.innerHTML = dayNames.map((name, index) => {
        let item = byDay[index] || { buka: false, jamMulai: "", jamSelesai: "", istirahatMulai: "", istirahatSelesai: "" };
        let disabled = item.buka ? "" : " disabled";
        return '<fieldset class="weekly-day"><legend class="visually-hidden">' + name + '</legend><div class="weekly-day-heading"><input type="checkbox" id="weekly-open-' + index + '" data-day-open="' + index + '" ' + (item.buka ? "checked" : "") + '><label for="weekly-open-' + index + '"><strong>' + name + '</strong></label></div><div class="weekly-time-field"><label for="weekly-start-' + index + '">Buka<input id="weekly-start-' + index + '" type="time" data-day-field="jam_mulai" value="' + item.jamMulai + '"' + disabled + ' required></label><label for="weekly-end-' + index + '">Tutup<input id="weekly-end-' + index + '" type="time" data-day-field="jam_selesai" value="' + item.jamSelesai + '"' + disabled + ' required></label></div><div class="weekly-time-field"><label for="weekly-break-start-' + index + '">Istirahat mulai<input id="weekly-break-start-' + index + '" type="time" data-day-field="istirahat_mulai" value="' + item.istirahatMulai + '"' + disabled + '></label><label for="weekly-break-end-' + index + '">Istirahat selesai<input id="weekly-break-end-' + index + '" type="time" data-day-field="istirahat_selesai" value="' + item.istirahatSelesai + '"' + disabled + '></label></div></fieldset>';
      }).join("");
    } catch (error) {
      showError(error.message || "Jadwal mingguan belum dapat dimuat.");
    }
  }

  function handleWeeklyHoursToggle(event) {
    let checkbox = event.target.closest("[data-day-open]");
    if (!checkbox) return;
    let day = checkbox.dataset.dayOpen;
    document.querySelectorAll('[id$="-'+ day + '"][data-day-field]').forEach((input) => {
      input.disabled = !checkbox.checked;
      input.required = checkbox.checked && (input.dataset.dayField === "jam_mulai" || input.dataset.dayField === "jam_selesai");
    });
  }

  async function saveWeeklyHours(event) {
    event.preventDefault();
    let errorBox = document.getElementById("weekly-hours-error");
    errorBox.hidden = true;
    let schedule = [];
    for (let day = 0; day < 7; day += 1) {
      let isOpen = document.getElementById("weekly-open-" + day).checked;
      let getTime = (field) => {
        return document.getElementById("weekly-" + field.replace("_", "-") + "-" + day).value || null;
      };
      let start = getTime("start");
      let end = getTime("end");
      let breakStart = document.getElementById("weekly-break-start-" + day).value || null;
      let breakEnd = document.getElementById("weekly-break-end-" + day).value || null;
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
      await refreshAll();
    } catch (error) {
      errorBox.textContent = error.message || "Jadwal tidak dapat disimpan.";
      errorBox.hidden = false;
    }
  }

  async function handleScheduleAction(event) {
    let button = event.target.closest("[data-schedule-action]");
    if (!button) return;
    button.disabled = true;
    let date = document.getElementById("schedule-date").value;
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
      await refreshAll();
    } catch (error) {
      showError(error.message);
      button.disabled = false;
    }
  }

  async function renderServices() {
    let list = document.getElementById("service-list");
    let services = await api.listLayanan(session.id);
    if (!services.length) {
      list.innerHTML =
        '<div class="empty-panel">Belum ada layanan. Tambahkan layanan agar pelanggan dapat memesan.</div>';
      return;
    }
    list.innerHTML = services
      .map((item) => {
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
    let button = event.target.closest("[data-service-action]");
    if (!button) return;
    let services = await api.listLayanan(session.id);
    let service = services.find((item) => {
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
      await refreshAll();
    } catch (error) {
      showError(error.message);
    }
  }

  function openServiceDialog(service) {
    let form = document.getElementById("service-form");
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
    let id = document.getElementById("service-id").value;
    let input = {
      nama: document.getElementById("service-name").value,
      durasi: document.getElementById("service-duration").value,
      harga: document.getElementById("service-price").value,
    };
    try {
      if (id) await api.ubahLayanan(id, input);
      else await api.tambahLayanan(session.id, input);
      closeServiceDialog();
      await refreshAll();
    } catch (error) {
      let errorBox = document.getElementById("service-form-error");
      errorBox.textContent = error.message;
      errorBox.hidden = false;
    }
  }

  function showError(message) {
    let element = document.getElementById("dashboard-error");
    element.textContent = message;
    element.hidden = false;
  }

  function getJakartaDate() {
    let parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    let values = {};
    parts.forEach((part) => {
      if (part.type !== "literal") values[part.type] = part.value;
    });
    return values.year + "-" + values.month + "-" + values.day;
  }
})();

(function () {
  "use strict";
  var api = window.NamaProdukAPI;
  var ui = window.NamaProdukUI;
  var mitra;
  var layanan = [];
  var selectedService = null;
  var selectedDate = "";
  var selectedSlot = null;
  var weeklySchedule = [];
  var isSubmitting = false;
  var slotRequestId = 0;

  document.addEventListener("DOMContentLoaded", initialize);

  async function initialize() {
    ui.applyProductName();
    var slug = new URLSearchParams(window.location.search).get("mitra");
    var loading = document.getElementById("booking-loading");
    try {
      if (!slug) {
        showNotFound();
        return;
      }
      mitra = await api.getMitraBySlug(slug);
      if (!mitra) {
        showNotFound();
        return;
      }
      layanan = await api.listLayanan(mitra.id);
      weeklySchedule = await api.getJadwalMingguan(mitra.id);
      document.getElementById("business-category").textContent = mitra.kategori;
      document.getElementById("business-name").textContent = mitra.nama;
      document.getElementById("business-address").textContent = mitra.alamat;
      renderBusinessHours();
      document.getElementById("booking-content").hidden = false;
      renderServices();
      renderDates();
      if (!layanan.length) {
        showError("Mitra ini belum menyediakan layanan untuk dipesan.");
      }
    } catch (error) {
      showError(error.message || "Halaman booking belum dapat dimuat. Silakan muat ulang.");
      document.getElementById("booking-content").hidden = false;
    } finally {
      loading.hidden = true;
    }
  }

  function showNotFound() {
    document.getElementById("booking-loading").hidden = true;
    document.getElementById("booking-not-found").hidden = false;
  }

  function showError(message) {
    var error = document.getElementById("booking-error");
    error.textContent = message;
    error.hidden = false;
  }

  function clearError() {
    var error = document.getElementById("booking-error");
    error.textContent = "";
    error.hidden = true;
  }

  function renderServices() {
    var list = document.getElementById("service-list");
    list.innerHTML = layanan.map(function (item) {
      return '<button class="service-option" type="button" data-service-id="' + ui.escapeHtml(item.id) + '" aria-pressed="false"><strong>' + ui.escapeHtml(item.nama) + '</strong><span>' + item.durasi + ' menit · ' + ui.formatRupiah(item.harga) + '</span></button>';
    }).join("");
    list.addEventListener("click", function (event) {
      var button = event.target.closest("[data-service-id]");
      if (!button) return;
      selectedService = layanan.find(function (item) { return item.id === button.dataset.serviceId; });
      selectedSlot = null;
      clearError();
      list.querySelectorAll(".service-option").forEach(function (option) {
        var selected = option === button;
        option.classList.toggle("is-selected", selected);
        option.setAttribute("aria-pressed", String(selected));
      });
      renderSlots();
      updateCustomerForm();
    });
  }

  function renderBusinessHours() {
    var days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    var list = document.getElementById("business-hours-value");
    list.innerHTML = weeklySchedule.map(function (item) {
      var text = item.buka
        ? days[item.hari] + ": " + item.jamMulai + "–" + item.jamSelesai +
          (item.istirahatMulai ? " (istirahat " + item.istirahatMulai + "–" + item.istirahatSelesai + ")" : "")
        : days[item.hari] + ": tutup";
      return "<li>" + ui.escapeHtml(text) + "</li>";
    }).join("");
  }

  function renderDates() {
    var list = document.getElementById("date-list");
    var today = getJakartaDate();
    var dates = [];
    for (var offset = 0; offset < 14; offset += 1) {
      var date = new Date(Date.UTC(today.year, today.month - 1, today.day + offset, 12));
      dates.push({
        date: date,
        value: formatInputDate(date),
        isToday: offset === 0,
      });
    }
    selectedDate = dates[0].value;
    list.innerHTML = dates.map(function (item, index) {
      var weekday = item.isToday ? "Hari ini" : new Intl.DateTimeFormat("id-ID", { weekday: "short", timeZone: "Asia/Jakarta" }).format(item.date);
      return '<button type="button" class="date-option' + (index === 0 ? " is-selected" : "") + '" data-date="' + item.value + '" aria-pressed="' + (index === 0) + '"><span>' + ui.escapeHtml(weekday) + '</span><strong>' + item.date.getUTCDate() + " " + ui.escapeHtml(new Intl.DateTimeFormat("id-ID", { month: "short", timeZone: "Asia/Jakarta" }).format(item.date)) + "</strong></button>";
    }).join("");
    list.addEventListener("click", function (event) {
      var button = event.target.closest("[data-date]");
      if (!button) return;
      selectedDate = button.dataset.date;
      selectedSlot = null;
      list.querySelectorAll(".date-option").forEach(function (option) {
        var selected = option === button;
        option.classList.toggle("is-selected", selected);
        option.setAttribute("aria-pressed", String(selected));
      });
      renderSlots();
      updateCustomerForm();
    });
  }

  async function renderSlots() {
    var list = document.getElementById("slot-list");
    var requestId = ++slotRequestId;
    if (!selectedService) {
      list.innerHTML = '<p class="slot-empty">Pilih layanan terlebih dahulu untuk melihat waktu yang tersedia.</p>';
      return;
    }
    var partySize = Number(document.getElementById("party-size").value);
    if (!Number.isInteger(partySize) || partySize < 1 || partySize > 12) {
      list.innerHTML = '<p class="slot-empty">Masukkan jumlah orang antara 1 sampai 12 untuk melihat waktu yang tersedia.</p>';
      return;
    }
    var serviceId = selectedService.id;
    var date = selectedDate;
    list.innerHTML = '<p class="slot-empty">Memuat slot waktu…</p>';
    try {
      var slots = await api.getSlotTersedia(mitra.id, serviceId, date, partySize);
      if (requestId !== slotRequestId) return;
      if (!slots.length || slots.every(function (slot) { return !slot.tersedia; })) {
        list.innerHTML = '<p class="slot-empty">Tidak tersedia waktu berurutan untuk rombongan sebanyak ' + partySize + ' orang pada tanggal ini. Coba kurangi jumlah orang atau pilih tanggal lain.</p>';
        return;
      }
      list.innerHTML = slots.map(function (slot) {
        var label = slot.status === "terisi" ? "Terisi" : slot.status === "ditutup" ? "Ditutup" : slot.status === "lewat" ? "Lewat" : "Kosong";
        return '<button type="button" class="slot-option' + (slot.status === "ditutup" ? " is-closed" : "") + (selectedSlot && selectedSlot.jamMulai === slot.jamMulai ? " is-selected" : "") + '" data-time="' + slot.jamMulai + '" ' + (!slot.tersedia ? "disabled" : "") + ' aria-label="' + slot.jamMulai + ", " + label + '">' + slot.jamMulai + (slot.tersedia ? "" : " · " + label) + "</button>";
      }).join("");
    } catch (error) {
      if (requestId !== slotRequestId) return;
      list.innerHTML = '<p class="slot-empty">Slot belum dapat dimuat. ' + ui.escapeHtml(error.message) + "</p>";
    }
  }

  document.getElementById("slot-list").addEventListener("click", function (event) {
    var button = event.target.closest("[data-time]");
    if (!button || button.disabled) return;
    selectedSlot = { jamMulai: button.dataset.time };
    document.querySelectorAll(".slot-option").forEach(function (option) {
      option.classList.toggle("is-selected", option === button);
    });
    updateCustomerForm();
    document.getElementById("customer-step").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.getElementById("party-size").addEventListener("input", function () {
    var input = document.getElementById("party-size");
    var value = Number(input.value);
    if (!Number.isInteger(value) || value < 1 || value > 12) {
      input.setCustomValidity("Jumlah orang harus antara 1 sampai 12.");
    } else {
      input.setCustomValidity("");
    }
    selectedSlot = null;
    renderSlots();
    updateCustomerForm();
  });

  document.getElementById("party-size").addEventListener("change", function (event) {
    if (!event.target.checkValidity()) event.target.reportValidity();
  });

  function updateCustomerForm() {
    var step = document.getElementById("customer-step");
    var ready = Boolean(selectedService && selectedDate && selectedSlot);
    step.hidden = !ready;
    if (!ready) return;
    var partySize = Number(document.getElementById("party-size").value);
    var end = selectedService.durasi * partySize;
    var timeParts = selectedSlot.jamMulai.split(":").map(Number);
    var endMinutes = timeParts[0] * 60 + timeParts[1] + end;
    var endTime = String(Math.floor(endMinutes / 60)).padStart(2, "0") + ":" + String(endMinutes % 60).padStart(2, "0");
    document.getElementById("booking-summary").innerHTML = '<h3>Ringkasan booking</h3><div class="summary-row"><span>Usaha</span><strong>' + ui.escapeHtml(mitra.nama) + '</strong></div><div class="summary-row"><span>Layanan per orang</span><strong>' + ui.escapeHtml(selectedService.nama) + '</strong></div><div class="summary-row"><span>Jumlah orang</span><strong>' + partySize + ' orang</strong></div><div class="summary-row"><span>Tanggal</span><strong>' + ui.escapeHtml(ui.formatTanggal(selectedDate)) + '</strong></div><div class="summary-row"><span>Waktu berurutan</span><strong>' + selectedSlot.jamMulai + "–" + endTime + '</strong></div><div class="summary-row"><span>Total estimasi</span><strong>' + ui.formatRupiah(selectedService.harga * partySize) + "</strong></div>";
  }

  document.getElementById("customer-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    if (isSubmitting) return;
    var errorBox = document.getElementById("form-error");
    var name = document.getElementById("customer-name").value.trim();
    var phone = document.getElementById("customer-phone").value.trim();
    var partySizeValue = Number(document.getElementById("party-size").value);
    if (name.length < 2) return setFormError("Nama minimal terdiri dari 2 karakter.");
    if (!ui.isValidIndonesianPhone(phone)) return setFormError("Masukkan nomor HP Indonesia yang valid, misalnya 081234567890.");
    if (!Number.isInteger(partySizeValue) || partySizeValue < 1 || partySizeValue > 12) {
      return setFormError("Jumlah orang harus antara 1 sampai 12.");
    }
    var button = document.getElementById("confirm-booking");
    var service = selectedService;
    var date = selectedDate;
    var startTime = selectedSlot.jamMulai;
    isSubmitting = true;
    button.disabled = true;
    button.textContent = "Menyimpan…";
    errorBox.hidden = true;
    try {
      // API memeriksa kembali ketersediaan slot tepat sebelum data disimpan.
      var partySize = partySizeValue;
      var booking = await api.buatBooking({ mitraId: mitra.id, layananId: service.id, tanggal: date, jamMulai: startTime, nama: name, telepon: ui.phoneToWhatsApp(phone), jumlahOrang: partySize });
      document.getElementById("booking-content").querySelectorAll(".booking-step").forEach(function (step) { step.hidden = true; });
      document.getElementById("success-code").textContent = booking.kode;
      var message = "Halo " + mitra.nama + ", saya " + name + " membuat booking " + service.nama + " untuk " + partySize + " orang secara berurutan pada " + ui.formatTanggal(date) + " pukul " + booking.jamMulai + "–" + booking.jamSelesai + ". Kode booking: " + booking.kode + ".";
      document.getElementById("whatsapp-link").href = "https://wa.me/" + mitra.telepon + "?text=" + encodeURIComponent(message);
      document.getElementById("booking-success").hidden = false;
      document.getElementById("booking-success").scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) {
      setFormError(error.message || "Booking belum dapat disimpan. Silakan coba lagi.");
      await renderSlots();
    } finally {
      isSubmitting = false;
      button.disabled = false;
      button.textContent = "Konfirmasi booking";
    }
  });

  function setFormError(message) {
    var errorBox = document.getElementById("form-error");
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function formatInputDate(date) {
    return date.getUTCFullYear() + "-" + String(date.getUTCMonth() + 1).padStart(2, "0") + "-" + String(date.getUTCDate()).padStart(2, "0");
  }

  function getJakartaDate() {
    var parts = new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(new Date());
    return {
      year: Number(parts.find(function (part) { return part.type === "year"; }).value),
      month: Number(parts.find(function (part) { return part.type === "month"; }).value),
      day: Number(parts.find(function (part) { return part.type === "day"; }).value),
    };
  }
})();

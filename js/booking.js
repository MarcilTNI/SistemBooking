(function () {
  "use strict";
  var api = window.NamaProdukAPI;
  var ui = window.NamaProdukUI;
  var mitra;
  var layanan = [];
  var selectedService = null;
  var selectedDate = "";
  var selectedSlot = null;

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
      document.getElementById("business-category").textContent = mitra.kategori;
      document.getElementById("business-name").textContent = mitra.nama;
      document.getElementById("business-address").textContent = mitra.alamat;
      document.getElementById("business-hours-value").textContent = mitra.jamMulai + "–" + mitra.jamSelesai;
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

  function renderDates() {
    var list = document.getElementById("date-list");
    var today = new Date();
    var dates = [];
    for (var offset = 1; offset <= 14; offset += 1) {
      var date = new Date(today);
      date.setDate(today.getDate() + offset);
      dates.push(date);
    }
    selectedDate = formatInputDate(dates[0]);
    list.innerHTML = dates.map(function (date, index) {
      var value = formatInputDate(date);
      var weekday = new Intl.DateTimeFormat("id-ID", { weekday: "short" }).format(date);
      return '<button type="button" class="date-option' + (index === 0 ? " is-selected" : "") + '" data-date="' + value + '" aria-pressed="' + (index === 0) + '"><span>' + ui.escapeHtml(weekday) + '</span><strong>' + date.getDate() + " " + ui.escapeHtml(new Intl.DateTimeFormat("id-ID", { month: "short" }).format(date)) + "</strong></button>";
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
    if (!selectedService) {
      list.innerHTML = '<p class="slot-empty">Pilih layanan terlebih dahulu untuk melihat waktu yang tersedia.</p>';
      return;
    }
    list.innerHTML = '<p class="slot-empty">Memuat slot waktu…</p>';
    try {
      var slots = await api.getSlotTersedia(mitra.id, selectedService.id, selectedDate);
      if (!slots.length || slots.every(function (slot) { return !slot.tersedia; })) {
        list.innerHTML = '<p class="slot-empty">Tidak ada slot kosong untuk tanggal ini. Silakan pilih tanggal lain.</p>';
        return;
      }
      list.innerHTML = slots.map(function (slot) {
        var label = slot.status === "terisi" ? "Terisi" : slot.status === "ditutup" ? "Ditutup" : slot.status === "lewat" ? "Lewat" : "Kosong";
        return '<button type="button" class="slot-option' + (slot.status === "ditutup" ? " is-closed" : "") + (selectedSlot && selectedSlot.jamMulai === slot.jamMulai ? " is-selected" : "") + '" data-time="' + slot.jamMulai + '" ' + (!slot.tersedia ? "disabled" : "") + ' aria-label="' + slot.jamMulai + ", " + label + '">' + slot.jamMulai + (slot.tersedia ? "" : " · " + label) + "</button>";
      }).join("");
    } catch (error) {
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

  function updateCustomerForm() {
    var step = document.getElementById("customer-step");
    var ready = Boolean(selectedService && selectedDate && selectedSlot);
    step.hidden = !ready;
    if (!ready) return;
    var end = selectedService.durasi;
    var timeParts = selectedSlot.jamMulai.split(":").map(Number);
    var endMinutes = timeParts[0] * 60 + timeParts[1] + end;
    var endTime = String(Math.floor(endMinutes / 60)).padStart(2, "0") + ":" + String(endMinutes % 60).padStart(2, "0");
    document.getElementById("booking-summary").innerHTML = '<h3>Ringkasan booking</h3><div class="summary-row"><span>Usaha</span><strong>' + ui.escapeHtml(mitra.nama) + '</strong></div><div class="summary-row"><span>Layanan</span><strong>' + ui.escapeHtml(selectedService.nama) + '</strong></div><div class="summary-row"><span>Tanggal</span><strong>' + ui.escapeHtml(ui.formatTanggal(selectedDate)) + '</strong></div><div class="summary-row"><span>Waktu</span><strong>' + selectedSlot.jamMulai + "–" + endTime + '</strong></div><div class="summary-row"><span>Total</span><strong>' + ui.formatRupiah(selectedService.harga) + "</strong></div>";
  }

  document.getElementById("customer-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    var errorBox = document.getElementById("form-error");
    var name = document.getElementById("customer-name").value.trim();
    var phone = document.getElementById("customer-phone").value.trim();
    if (name.length < 2) return setFormError("Nama minimal terdiri dari 2 karakter.");
    if (!ui.isValidIndonesianPhone(phone)) return setFormError("Masukkan nomor HP Indonesia yang valid, misalnya 081234567890.");
    var button = document.getElementById("confirm-booking");
    button.disabled = true;
    button.textContent = "Menyimpan…";
    errorBox.hidden = true;
    try {
      // API memeriksa kembali ketersediaan slot tepat sebelum data disimpan.
      var booking = await api.buatBooking({ mitraId: mitra.id, layananId: selectedService.id, tanggal: selectedDate, jamMulai: selectedSlot.jamMulai, nama: name, telepon: ui.phoneToWhatsApp(phone) });
      document.getElementById("booking-content").querySelectorAll(".booking-step").forEach(function (step) { step.hidden = true; });
      document.getElementById("success-code").textContent = booking.kode;
      var message = "Halo " + mitra.nama + ", saya " + name + " sudah membuat booking " + selectedService.nama + " pada " + ui.formatTanggal(selectedDate) + " pukul " + booking.jamMulai + ". Kode booking: " + booking.kode + ".";
      document.getElementById("whatsapp-link").href = "https://wa.me/" + mitra.telepon + "?text=" + encodeURIComponent(message);
      document.getElementById("booking-success").hidden = false;
      document.getElementById("booking-success").scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) {
      setFormError(error.message || "Booking belum dapat disimpan. Silakan coba lagi.");
      await renderSlots();
    } finally {
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
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  }
})();

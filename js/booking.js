(() => {
  "use strict";
  const api = window.NamaProdukAPI;
  const ui = window.NamaProdukUI;
  let mitra;
  let layanan = [];
  let selectedService = null;
  let selectedDate = "";
  let selectedSlot = null;
  let weeklySchedule = [];
  let isSubmitting = false;
  let slotRequestId = 0;

  document.addEventListener("DOMContentLoaded", initialize);

  async function initialize() {
    ui.applyProductName();
    let slug = new URLSearchParams(window.location.search).get("mitra");
    let loading = document.getElementById("booking-loading");
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
      ui.setPageBrand(mitra.nama, "Booking " + mitra.nama + " | " + ui.PRODUCT_NAME, mitra.nama + ", ke bagian atas halaman booking");
      updateWhatsAppLinks("Halo " + mitra.nama + ", saya ingin bertanya mengenai layanan dan booking.");
      layanan = await api.listLayanan(mitra.id);
      weeklySchedule = await api.getJadwalMingguan(mitra.id);
      document.getElementById("business-category").textContent = mitra.kategori;
      document.getElementById("business-name").textContent = mitra.nama;
      document.getElementById("business-address").textContent = mitra.alamat;
      renderBusinessHours();
      document.getElementById("booking-content").hidden = false;
      renderServices();
      renderDates();
      updateCustomerForm();
      document.getElementById("mobile-receipt-bar").hidden = false;
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
    let error = document.getElementById("booking-error");
    error.textContent = message;
    error.hidden = false;
  }

  function clearError() {
    let error = document.getElementById("booking-error");
    error.textContent = "";
    error.hidden = true;
  }

  function renderServices() {
    let list = document.getElementById("service-list");
    list.innerHTML = layanan.map((item) => {
      return '<button class="service-option" type="button" data-service-id="' + ui.escapeHtml(item.id) + '" aria-pressed="false"><strong>' + ui.escapeHtml(item.nama) + '</strong><span>' + item.durasi + ' menit · ' + ui.formatRupiah(item.harga) + '</span></button>';
    }).join("");
    list.addEventListener("click", (event) => {
      let button = event.target.closest("[data-service-id]");
      if (!button) return;
      selectedService = layanan.find((item) => { return item.id === button.dataset.serviceId; });
      selectedSlot = null;
      clearError();
      list.querySelectorAll(".service-option").forEach((option) => {
        let selected = option === button;
        option.classList.toggle("is-selected", selected);
        option.setAttribute("aria-pressed", String(selected));
      });
      renderSlots();
      updateCustomerForm();
    });
  }

  function renderBusinessHours() {
    let days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    let list = document.getElementById("business-hours-value");
    list.innerHTML = weeklySchedule.map((item) => {
      return '<article class="business-hours-card' + (item.buka ? "" : " is-closed") + '"><strong>' +
        days[item.hari] + '</strong><span>' +
        (item.buka ? ui.escapeHtml(item.jamMulai + "–" + item.jamSelesai) : "Tutup") +
        (item.buka && item.istirahatMulai
          ? '<small>Istirahat ' + ui.escapeHtml(item.istirahatMulai + "–" + item.istirahatSelesai) + "</small>"
          : "") +
        "</span></article>";
    }).join("");
  }

  function renderDates() {
    let list = document.getElementById("date-list");
    let today = getJakartaDate();
    let dates = [];
    for (let offset = 0; offset < 14; offset += 1) {
      let date = new Date(Date.UTC(today.year, today.month - 1, today.day + offset, 12));
      dates.push({
        date: date,
        value: formatInputDate(date),
        isToday: offset === 0,
      });
    }
    selectedDate = dates[0].value;
    list.innerHTML = dates.map((item, index) => {
      let weekday = item.isToday ? "Hari ini" : new Intl.DateTimeFormat("id-ID", { weekday: "short", timeZone: "Asia/Jakarta" }).format(item.date);
      return '<button type="button" class="date-option' + (index === 0 ? " is-selected" : "") + '" data-date="' + item.value + '" aria-pressed="' + (index === 0) + '"><span>' + ui.escapeHtml(weekday) + '</span><strong>' + item.date.getUTCDate() + " " + ui.escapeHtml(new Intl.DateTimeFormat("id-ID", { month: "short", timeZone: "Asia/Jakarta" }).format(item.date)) + "</strong></button>";
    }).join("");
    list.addEventListener("click", (event) => {
      let button = event.target.closest("[data-date]");
      if (!button) return;
      selectedDate = button.dataset.date;
      selectedSlot = null;
      list.querySelectorAll(".date-option").forEach((option) => {
        let selected = option === button;
        option.classList.toggle("is-selected", selected);
        option.setAttribute("aria-pressed", String(selected));
      });
      renderSlots();
      updateCustomerForm();
    });
  }

  async function renderSlots() {
    let list = document.getElementById("slot-list");
    let requestId = ++slotRequestId;
    if (!selectedService) {
      list.innerHTML = '<p class="slot-empty">Pilih layanan terlebih dahulu untuk melihat waktu yang tersedia.</p>';
      return;
    }
    let partySize = Number(document.getElementById("party-size").value);
    if (!Number.isInteger(partySize) || partySize < 1 || partySize > 12) {
      list.innerHTML = '<p class="slot-empty">Masukkan jumlah orang antara 1 sampai 12 untuk melihat waktu yang tersedia.</p>';
      return;
    }
    let serviceId = selectedService.id;
    let date = selectedDate;
    list.innerHTML = '<p class="slot-empty">Memuat slot waktu…</p>';
    try {
      let slots = await api.getSlotTersedia(mitra.id, serviceId, date, partySize);
      if (requestId !== slotRequestId) return;
      if (!slots.length || slots.every((slot) => { return !slot.tersedia; })) {
        list.innerHTML = '<p class="slot-empty">Tidak tersedia waktu berurutan untuk rombongan sebanyak ' + partySize + ' orang pada tanggal ini. Coba kurangi jumlah orang atau pilih tanggal lain.</p>';
        return;
      }
      list.innerHTML = slots.map((slot) => {
        let label = slot.status === "terisi" ? "Terisi" : slot.status === "ditutup" ? "Ditutup" : slot.status === "lewat" ? "Lewat" : "Kosong";
        return '<button type="button" class="slot-option' + (slot.status === "ditutup" ? " is-closed" : "") + (selectedSlot && selectedSlot.jamMulai === slot.jamMulai ? " is-selected" : "") + '" data-time="' + slot.jamMulai + '" ' + (!slot.tersedia ? "disabled" : "") + ' aria-label="' + slot.jamMulai + ", " + label + '">' + slot.jamMulai + (slot.tersedia ? "" : " · " + label) + "</button>";
      }).join("");
    } catch (error) {
      if (requestId !== slotRequestId) return;
      list.innerHTML = '<p class="slot-empty">Slot belum dapat dimuat. ' + ui.escapeHtml(error.message) + "</p>";
    }
  }

  document.getElementById("slot-list").addEventListener("click", (event) => {
    let button = event.target.closest("[data-time]");
    if (!button || button.disabled) return;
    selectedSlot = { jamMulai: button.dataset.time };
    document.querySelectorAll(".slot-option").forEach((option) => {
      option.classList.toggle("is-selected", option === button);
    });
    updateCustomerForm();
  });

  document.getElementById("party-size").addEventListener("input", () => {
    let input = document.getElementById("party-size");
    let value = Number(input.value);
    if (!Number.isInteger(value) || value < 1 || value > 12) {
      input.setCustomValidity("Jumlah orang harus antara 1 sampai 12.");
    } else {
      input.setCustomValidity("");
    }
    selectedSlot = null;
    renderSlots();
    updateCustomerForm();
  });

  document.getElementById("customer-name").addEventListener("input", () => {
    document.getElementById("form-error").hidden = true;
    updateCustomerForm();
  });
  document.getElementById("customer-phone").addEventListener("input", () => {
    document.getElementById("form-error").hidden = true;
    updateCustomerForm();
  });
  document.getElementById("receipt-guide").addEventListener("click", () => {
    let target = getNextBookingTarget();
    target.element.scrollIntoView({ behavior: "smooth", block: "center" });
    if (target.focus) target.element.focus({ preventScroll: true });
  });
  document.getElementById("mobile-receipt-button").addEventListener("click", () => {
    document.getElementById("customer-step").scrollIntoView({ behavior: "smooth", block: "center" });
  });

  document.getElementById("party-size").addEventListener("change", (event) => {
    if (!event.target.checkValidity()) event.target.reportValidity();
  });

  function updateCustomerForm() {
    let partySize = Number(document.getElementById("party-size").value);
    let validPartySize = Number.isInteger(partySize) && partySize >= 1 && partySize <= 12;
    let endTime = "—";
    if (selectedService && selectedSlot && validPartySize) {
      let duration = selectedService.durasi * partySize;
      let timeParts = selectedSlot.jamMulai.split(":").map(Number);
      let endMinutes = timeParts[0] * 60 + timeParts[1] + duration;
      endTime = String(Math.floor(endMinutes / 60)).padStart(2, "0") + ":" + String(endMinutes % 60).padStart(2, "0");
    }
    let dateSummary = selectedDate
      ? ui.formatTanggal(selectedDate)
      : "Pilih tanggal";
    let name = document.getElementById("customer-name").value.trim();
    let phone = document.getElementById("customer-phone").value.trim();
    let complete = Boolean(
      selectedService &&
      selectedDate &&
      selectedSlot &&
      validPartySize &&
      name.length >= 2 &&
      ui.isValidIndonesianPhone(phone),
    );
    document.getElementById("booking-summary").innerHTML =
      '<h3>Struk booking</h3>' +
      '<div class="summary-row"><span>Usaha</span><strong>' + ui.escapeHtml(mitra.nama) + '</strong></div>' +
      '<div class="summary-row"><span>Layanan</span><strong>' + (selectedService ? ui.escapeHtml(selectedService.nama) : "Pilih layanan") + '</strong></div>' +
      '<div class="summary-row"><span>Durasi</span><strong>' + (selectedService ? selectedService.durasi + " menit per orang" : "—") + '</strong></div>' +
      '<div class="summary-row"><span>Jumlah orang</span><strong>' + (validPartySize ? partySize + " orang" : "Periksa jumlah") + '</strong></div>' +
      '<div class="summary-row"><span>Tanggal</span><strong>' + ui.escapeHtml(dateSummary) + '</strong></div>' +
      '<div class="summary-row"><span>Waktu</span><strong>' + (selectedSlot ? selectedSlot.jamMulai + "–" + endTime : "Pilih slot") + '</strong></div>' +
      '<div class="receipt-total"><span>Total estimasi</span><strong>' + (selectedService && validPartySize ? ui.formatRupiah(selectedService.harga * partySize) : "—") + '</strong></div>';
    let guideButton = document.getElementById("receipt-guide");
    let confirmButton = document.getElementById("confirm-booking");
    guideButton.hidden = complete;
    confirmButton.hidden = !complete;
    confirmButton.textContent = "Booking sekarang";
    document.getElementById("mobile-receipt-label").textContent = complete
      ? "Pilihan lengkap · " + ui.formatRupiah(selectedService.harga * partySize)
      : "Lanjutkan pemesanan";
    if (!complete) guideButton.textContent = getNextBookingTarget().label;
  }

  function getNextBookingTarget() {
    let partySize = Number(document.getElementById("party-size").value);
    if (!selectedService) {
      return { element: document.getElementById("service-section"), label: "Pilih layanan" };
    }
    if (!Number.isInteger(partySize) || partySize < 1 || partySize > 12) {
      return { element: document.getElementById("party-size"), label: "Periksa jumlah orang", focus: true };
    }
    if (!selectedSlot) {
      return { element: document.getElementById("schedule-section"), label: "Pilih tanggal dan waktu" };
    }
    let name = document.getElementById("customer-name").value.trim();
    if (name.length < 2) {
      return { element: document.getElementById("customer-name"), label: "Isi nama pemesan", focus: true };
    }
    let phone = document.getElementById("customer-phone").value.trim();
    if (!ui.isValidIndonesianPhone(phone)) {
      return { element: document.getElementById("customer-phone"), label: "Isi nomor WhatsApp", focus: true };
    }
    return { element: document.getElementById("customer-step"), label: "Booking sekarang" };
  }

  document.getElementById("customer-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    let errorBox = document.getElementById("form-error");
    let name = document.getElementById("customer-name").value.trim();
    let phone = document.getElementById("customer-phone").value.trim();
    let partySizeValue = Number(document.getElementById("party-size").value);
    if (name.length < 2) return setFormError("Nama minimal terdiri dari 2 karakter.");
    if (!ui.isValidIndonesianPhone(phone)) return setFormError("Masukkan nomor HP Indonesia yang valid, misalnya 081234567890.");
    if (!Number.isInteger(partySizeValue) || partySizeValue < 1 || partySizeValue > 12) {
      return setFormError("Jumlah orang harus antara 1 sampai 12.");
    }
    let button = document.getElementById("confirm-booking");
    if (!selectedService || !selectedDate || !selectedSlot) {
      return setFormError("Pilih layanan, tanggal, dan slot waktu terlebih dahulu.");
    }
    let service = selectedService;
    let date = selectedDate;
    let startTime = selectedSlot.jamMulai;
    isSubmitting = true;
    button.disabled = true;
    button.textContent = "Menyimpan…";
    errorBox.hidden = true;
    try {
      // API memeriksa kembali ketersediaan slot tepat sebelum data disimpan.
      let partySize = partySizeValue;
      let booking = await api.buatBooking({ mitraId: mitra.id, layananId: service.id, tanggal: date, jamMulai: startTime, nama: name, telepon: ui.phoneToWhatsApp(phone), jumlahOrang: partySize });
      document.getElementById("booking-layout").hidden = true;
      document.getElementById("business-header").hidden = true;
      document.getElementById("booking-error").hidden = true;
      document.getElementById("mobile-receipt-bar").hidden = true;
      document.getElementById("success-code").textContent = booking.kode;
      let message = "Halo " + mitra.nama + ", saya " + name + " membuat booking " + service.nama + " untuk " + partySize + " orang secara berurutan pada " + ui.formatTanggal(date) + " pukul " + booking.jamMulai + "–" + booking.jamSelesai + ". Kode booking: " + booking.kode + ".";
      updateWhatsAppLinks(message);
      document.getElementById("booking-success").hidden = false;
      document.getElementById("booking-success").scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) {
      setFormError(error.message || "Booking belum dapat disimpan. Silakan coba lagi.");
      selectedSlot = null;
      updateCustomerForm();
      await renderSlots();
    } finally {
      isSubmitting = false;
      button.disabled = false;
      button.textContent = "Booking sekarang";
    }
  });

  function setFormError(message) {
    let errorBox = document.getElementById("form-error");
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function updateWhatsAppLinks(message) {
    let phone = ui.phoneToWhatsApp(mitra.telepon);
    if (!/^[0-9]{10,15}$/.test(phone)) {
      throw new Error("Nomor WhatsApp usaha belum valid. Silakan hubungi mitra melalui informasi kontak lain.");
    }
    let href = "https://wa.me/" + phone + "?text=" + encodeURIComponent(message);
    document.getElementById("persistent-whatsapp-link").href = href;
    document.getElementById("persistent-whatsapp-link").hidden = false;
    document.getElementById("whatsapp-link").href = href;
  }

  function formatInputDate(date) {
    return date.getUTCFullYear() + "-" + String(date.getUTCMonth() + 1).padStart(2, "0") + "-" + String(date.getUTCDate()).padStart(2, "0");
  }

  function getJakartaDate() {
    let parts = new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(new Date());
    return {
      year: Number(parts.find((part) => { return part.type === "year"; }).value),
      month: Number(parts.find((part) => { return part.type === "month"; }).value),
      day: Number(parts.find((part) => { return part.type === "day"; }).value),
    };
  }
})();

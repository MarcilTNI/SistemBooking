(function () {
  "use strict";
  var ui = window.NamaProdukUI;
  var partners = [];
  // Ganti jalur ini saat file logo platform sudah ditambahkan ke proyek.
  var PLATFORM_LOGO_PATH = "images/logo.png";
  var dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  var shortDayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

  document.addEventListener("DOMContentLoaded", initialize);

  async function initialize() {
    ui.applyProductName();
    initializePlatformLogos();
    document.getElementById("current-year").textContent = new Date().getFullYear();
    bindFilters();
    var list = document.getElementById("partner-list");
    try {
      partners = await window.NamaProdukAPI.listMitraDirektori();
      list.setAttribute("aria-busy", "false");
      renderPartners();
    } catch (error) {
      list.setAttribute("aria-busy", "false");
      list.innerHTML =
        '<div class="notice notice-error">Daftar mitra belum dapat dimuat. Periksa koneksi internet atau coba muat ulang halaman.</div>';
      document.getElementById("partner-result-count").textContent =
        "Terjadi kendala saat memuat daftar mitra.";
      console.error("Gagal memuat direktori mitra:", error);
    }
  }

  function initializePlatformLogos() {
    document.querySelectorAll("[data-platform-logo]").forEach(function (logo) {
      logo.addEventListener("load", function () {
        logo.hidden = false;
        logo.closest(".brand").classList.add("has-platform-logo");
      });
      logo.addEventListener("error", function () {
        logo.hidden = true;
      });
      logo.src = PLATFORM_LOGO_PATH;
    });
  }

  function bindFilters() {
    var form = document.getElementById("directory-filter-form");
    form.addEventListener("input", renderPartners);
    form.addEventListener("change", renderPartners);
    form.addEventListener("reset", function () {
      window.setTimeout(renderPartners, 0);
    });
  }

  function renderPartners() {
    var list = document.getElementById("partner-list");
    var error = document.getElementById("filter-error");
    var minInput = document.getElementById("minimum-price");
    var maxInput = document.getElementById("maximum-price");
    var min = minInput.value === "" ? null : Number(minInput.value);
    var max = maxInput.value === "" ? null : Number(maxInput.value);

    if ((min !== null && min < 0) || (max !== null && max < 0)) {
      error.textContent = "Rentang harga tidak boleh kurang dari nol.";
      error.hidden = false;
      return;
    }
    if (min !== null && max !== null && min > max) {
      error.textContent = "Harga minimum tidak boleh lebih besar dari harga maksimum.";
      error.hidden = false;
      return;
    }
    error.hidden = true;

    var search = document.getElementById("partner-search").value
      .trim()
      .toLocaleLowerCase("id");
    var latestOpening = document.getElementById("latest-opening").value;
    var earliestClosing = document.getElementById("earliest-closing").value;
    var filtered = partners.filter(function (partner) {
      var searchable = [
        partner.nama,
        partner.kategori,
        partner.alamat,
      ].concat(partner.layanan.map(function (service) {
        return service.nama;
      })).join(" ").toLocaleLowerCase("id");

      if (search && searchable.indexOf(search) === -1) return false;
      if (!matchesPrice(partner, min, max)) return false;
      if (!matchesHours(partner, latestOpening, earliestClosing)) return false;
      return true;
    });

    document.getElementById("partner-result-count").textContent =
      filtered.length + " dari " + partners.length + " mitra ditampilkan.";
    if (!partners.length) {
      list.innerHTML =
        '<div class="empty-panel directory-empty">Belum ada mitra yang terdaftar. Silakan kembali lagi nanti.</div>';
      return;
    }
    if (!filtered.length) {
      list.innerHTML =
        '<div class="empty-panel directory-empty">Belum ada mitra yang sesuai. Coba ubah kata kunci atau rentang filter.</div>';
      return;
    }
    list.innerHTML = filtered.map(function (partner) {
      return renderPartnerCard(partner, min, max);
    }).join("");
  }

  function matchesPrice(partner, min, max) {
    if (min === null && max === null) return true;
    return partner.layanan.some(function (service) {
      return (min === null || service.harga >= min) &&
        (max === null || service.harga <= max);
    });
  }

  function matchesHours(partner, latestOpening, earliestClosing) {
    if (!latestOpening && !earliestClosing) return true;
    return partner.jadwal.some(function (day) {
      if (!day.buka) return false;
      return (!latestOpening || day.jamMulai <= latestOpening) &&
        (!earliestClosing || day.jamSelesai >= earliestClosing);
    });
  }

  function renderPartnerCard(partner, min, max) {
    var matchingServices = partner.layanan.filter(function (service) {
      return (min === null || service.harga >= min) &&
        (max === null || service.harga <= max);
    });
    var servicesForPrice = matchingServices.length ? matchingServices : partner.layanan;
    var cheapest = servicesForPrice.reduce(function (current, service) {
      return !current || service.harga < current.harga ? service : current;
    }, null);
    var openDays = partner.jadwal.filter(function (day) {
      return day.buka;
    });
    var firstDay = openDays[0];
    var scheduleSummary = firstDay
      ? dayNames[firstDay.hari] + " " + firstDay.jamMulai + "–" + firstDay.jamSelesai
      : "Jadwal belum tersedia";
    var serviceNames = partner.layanan.map(function (service) {
      return service.nama;
    });

    return '<article class="partner-card">' +
      '<div class="partner-card-main">' +
        '<span class="tag">' + ui.escapeHtml(partner.kategori || "Usaha lokal") + '</span>' +
        '<h3>' + ui.escapeHtml(partner.nama) + '</h3>' +
        '<p class="partner-address">' + ui.escapeHtml(partner.alamat || "Alamat belum dicantumkan") + '</p>' +
        '<div class="partner-highlights">' +
          '<div class="partner-price"><span>' + (min !== null || max !== null ? 'Harga termurah sesuai filter' : 'Harga layanan termurah') + '</span>' +
            (cheapest
              ? '<strong>' + ui.formatRupiah(cheapest.harga) + '</strong><small>' + ui.escapeHtml(cheapest.nama) + '</small>'
              : '<strong>Belum tersedia</strong><small>Hubungi mitra untuk informasi</small>') +
          '</div>' +
          '<div class="partner-hours"><span>Contoh jam operasional</span><strong>' +
            ui.escapeHtml(scheduleSummary) + '</strong><small>' + openDays.length + ' hari buka dalam seminggu</small>' +
          '</div>' +
        '</div>' +
        '<details class="partner-details"><summary>Lihat layanan dan jadwal lengkap</summary>' +
          '<div class="partner-detail-content">' +
            '<div><strong>Layanan tersedia</strong>' +
              (partner.layanan.length
                ? '<ul class="partner-services">' + partner.layanan.map(function (service) {
                    return '<li><span>' + ui.escapeHtml(service.nama) + '</span><span>' + service.durasi + ' menit · ' + ui.formatRupiah(service.harga) + '</span></li>';
                  }).join("") + '</ul>'
                : '<p class="partner-no-services">Belum ada layanan yang dipublikasikan.</p>') +
            '</div>' +
            '<div><strong>Jam operasional mingguan</strong>' +
              '<ul class="partner-schedule">' + partner.jadwal.map(function (day) {
                return '<li><span>' + shortDayNames[day.hari] + '</span><span>' +
                  (day.buka
                    ? ui.escapeHtml(day.jamMulai + "–" + day.jamSelesai + (day.istirahatMulai ? " · Istirahat " + day.istirahatMulai + "–" + day.istirahatSelesai : ""))
                    : "Tutup") + '</span></li>';
              }).join("") + '</ul>' +
            '</div>' +
          '</div>' +
        '</details>' +
        '<p class="partner-search-data visually-hidden">' + ui.escapeHtml(serviceNames.join(", ")) + '</p>' +
      '</div>' +
      '<a class="button button-primary button-small" href="booking.html?mitra=' +
        encodeURIComponent(partner.slug) + '">Lihat halaman booking</a>' +
    '</article>';
  }
})();

(function (global) {
  "use strict";
  var PRODUCT_NAME = global.NamaProdukAPI.PRODUCT_NAME;

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character];
    });
  }

  function formatRupiah(value) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value) || 0);
  }

  function formatTanggal(value, options) {
    var parts = value.split("-").map(Number);
    return new Intl.DateTimeFormat("id-ID", options || { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(parts[0], parts[1] - 1, parts[2]));
  }

  function phoneToWhatsApp(value) {
    var digits = String(value || "").replace(/\D/g, "");
    if (digits.indexOf("0") === 0) return "62" + digits.slice(1);
    if (digits.indexOf("62") === 0) return digits;
    return digits;
  }

  function isValidIndonesianPhone(value) {
    var digits = String(value || "").replace(/\D/g, "");
    if (digits.indexOf("62") === 0) digits = "0" + digits.slice(2);
    return /^08[1-9][0-9]{7,10}$/.test(digits);
  }

  function applyProductName() {
    document.querySelectorAll("[data-product-name]").forEach(function (element) {
      element.textContent = PRODUCT_NAME;
    });
    document.title = document.title.replace(/NamaProduk/g, PRODUCT_NAME);
    document.querySelectorAll('meta[name="description"]').forEach(function (element) {
      element.content = element.content.replace(/NamaProduk/g, PRODUCT_NAME);
    });
  }

  global.NamaProdukUI = {
    PRODUCT_NAME: PRODUCT_NAME,
    escapeHtml: escapeHtml,
    formatRupiah: formatRupiah,
    formatTanggal: formatTanggal,
    phoneToWhatsApp: phoneToWhatsApp,
    isValidIndonesianPhone: isValidIndonesianPhone,
    applyProductName: applyProductName
  };
})(window);

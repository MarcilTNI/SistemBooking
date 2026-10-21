(function (global) {
  "use strict";

  var PRODUCT_NAME = "NamaProduk";
  var DATA_KEY = "namaproduk_demo_data_v1";
  var SESSION_KEY = "namaproduk_demo_session_v1";
  var DAY_MS = 24 * 60 * 60 * 1000;

  function dateAfter(days) {
    var date = new Date();
    date.setDate(date.getDate() + days);
    return formatDate(date);
  }

  function formatDate(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function timeToMinutes(time) {
    var parts = time.split(":").map(Number);
    return parts[0] * 60 + parts[1];
  }

  function minutesToTime(minutes) {
    return String(Math.floor(minutes / 60)).padStart(2, "0") + ":" + String(minutes % 60).padStart(2, "0");
  }

  function createSeed() {
    var barbershop = { id: "mitra-rapi", slug: "barbershop-rapi", nama: "Barbershop Rapi", kategori: "Barbershop", alamat: "Jl. Melati No. 12, Bandung", telepon: "6281234567801", jamMulai: "09:00", jamSelesai: "17:00", email: "rapi@demo.id", password: "demo123" };
    var laundry = { id: "mitra-bersih", slug: "laundry-bersih", nama: "Laundry Bersih", kategori: "Laundry", alamat: "Jl. Mawar No. 8, Bandung", telepon: "6281234567802", jamMulai: "08:00", jamSelesai: "18:00", email: "bersih@demo.id", password: "demo123" };
    var salon = { id: "mitra-senja", slug: "salon-senja", nama: "Salon Senja", kategori: "Salon", alamat: "Jl. Anggrek No. 21, Bandung", telepon: "6281234567803", jamMulai: "10:00", jamSelesai: "19:00", email: "senja@demo.id", password: "demo123" };
    return {
      mitra: [barbershop, laundry, salon],
      layanan: [
        { id: "layanan-potong", mitraId: barbershop.id, nama: "Potong rambut", durasi: 30, harga: 35000 },
        { id: "layanan-cukur", mitraId: barbershop.id, nama: "Potong + keramas", durasi: 60, harga: 55000 },
        { id: "layanan-cukur-jenggot", mitraId: barbershop.id, nama: "Rapikan jenggot", durasi: 30, harga: 25000 },
        { id: "layanan-cuci", mitraId: laundry.id, nama: "Cuci dan setrika (reguler)", durasi: 60, harga: 8000 },
        { id: "layanan-setrika", mitraId: laundry.id, nama: "Setrika saja", durasi: 60, harga: 6000 },
        { id: "layanan-express", mitraId: laundry.id, nama: "Cuci express", durasi: 120, harga: 15000 },
        { id: "layanan-potong-salon", mitraId: salon.id, nama: "Potong rambut", durasi: 45, harga: 50000 },
        { id: "layanan-creambath", mitraId: salon.id, nama: "Creambath", durasi: 60, harga: 75000 },
        { id: "layanan-blow", mitraId: salon.id, nama: "Cuci dan blow", durasi: 30, harga: 40000 }
      ],
      booking: [
        { id: "booking-demo-1", kode: "NB-DEMO01", mitraId: barbershop.id, layananId: "layanan-potong", layananNama: "Potong rambut", durasi: 30, tanggal: dateAfter(0), jamMulai: "10:00", jamSelesai: "10:30", nama: "Andi Pratama", telepon: "628111222333", status: "menunggu", dibuatPada: new Date().toISOString() },
        { id: "booking-demo-2", kode: "NB-DEMO02", mitraId: barbershop.id, layananId: "layanan-cukur", layananNama: "Potong + keramas", durasi: 60, tanggal: dateAfter(0), jamMulai: "13:00", jamSelesai: "14:00", nama: "Dewi Lestari", telepon: "628111222444", status: "diterima", dibuatPada: new Date().toISOString() },
        { id: "booking-demo-3", kode: "NB-DEMO03", mitraId: laundry.id, layananId: "layanan-cuci", layananNama: "Cuci dan setrika (reguler)", durasi: 60, tanggal: dateAfter(1), jamMulai: "09:00", jamSelesai: "10:00", nama: "Rina Putri", telepon: "628111222555", status: "menunggu", dibuatPada: new Date().toISOString() },
        { id: "booking-demo-4", kode: "NB-DEMO04", mitraId: salon.id, layananId: "layanan-creambath", layananNama: "Creambath", durasi: 60, tanggal: dateAfter(2), jamMulai: "14:00", jamSelesai: "15:00", nama: "Maya Sari", telepon: "628111222666", status: "diterima", dibuatPada: new Date().toISOString() }
      ],
      penutupan: []
    };
  }

  // TODO: ganti dengan Supabase
  function readData() {
    var stored = global.localStorage.getItem(DATA_KEY);
    if (!stored) {
      var seed = createSeed();
      global.localStorage.setItem(DATA_KEY, JSON.stringify(seed));
      return seed;
    }
    try {
      return JSON.parse(stored);
    } catch (error) {
      throw new Error("Data demo tidak dapat dibaca. Hapus data situs lalu muat ulang halaman.");
    }
  }

  function writeData(data) {
    global.localStorage.setItem(DATA_KEY, JSON.stringify(data));
  }

  function getMitra(mitraId, data) {
    var mitra = data.mitra.find(function (item) { return item.id === mitraId; });
    if (!mitra) throw new Error("Data mitra tidak ditemukan.");
    return mitra;
  }

  function makeId(prefix) {
    return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function getSlotTersediaSync(data, mitraId, layananId, tanggal) {
    var mitra = getMitra(mitraId, data);
    var layanan = data.layanan.find(function (item) { return item.id === layananId && item.mitraId === mitraId; });
    if (!layanan) throw new Error("Layanan tidak ditemukan.");
    var duration = Number(layanan.durasi);
    var start = timeToMinutes(mitra.jamMulai);
    var end = timeToMinutes(mitra.jamSelesai);
    var now = new Date();
    var today = formatDate(now);
    var currentMinutes = now.getHours() * 60 + now.getMinutes();
    var bookings = data.booking.filter(function (item) {
      return item.mitraId === mitraId && item.tanggal === tanggal && item.status !== "dibatalkan";
    });
    var closures = data.penutupan.filter(function (item) { return item.mitraId === mitraId && item.tanggal === tanggal; });
    var slots = [];
    for (var minute = start; minute + duration <= end; minute += 30) {
      var slotEnd = minute + duration;
      var overlapsBooking = bookings.some(function (item) {
        return minute < timeToMinutes(item.jamSelesai) && slotEnd > timeToMinutes(item.jamMulai);
      });
      var overlapsClosure = closures.some(function (item) {
        return minute < timeToMinutes(item.jamSelesai) && slotEnd > timeToMinutes(item.jamMulai);
      });
      var past = tanggal < today || (tanggal === today && minute <= currentMinutes);
      var jamMulai = minutesToTime(minute);
      var status = overlapsBooking ? "terisi" : overlapsClosure ? "ditutup" : past ? "lewat" : "kosong";
      slots.push({ jamMulai: jamMulai, jamSelesai: minutesToTime(slotEnd), status: status, tersedia: status === "kosong" });
    }
    return slots;
  }

  var api = {
    PRODUCT_NAME: PRODUCT_NAME,
    async listMitra() {
      return readData().mitra.map(function (item) {
        return { id: item.id, slug: item.slug, nama: item.nama, kategori: item.kategori, alamat: item.alamat };
      });
    },
    async getMitraBySlug(slug) {
      var mitra = readData().mitra.find(function (item) { return item.slug === slug; });
      if (!mitra) return null;
      return { id: mitra.id, slug: mitra.slug, nama: mitra.nama, kategori: mitra.kategori, alamat: mitra.alamat, telepon: mitra.telepon, jamMulai: mitra.jamMulai, jamSelesai: mitra.jamSelesai };
    },
    async listLayanan(mitraId) {
      return readData().layanan.filter(function (item) { return item.mitraId === mitraId; }).slice().sort(function (a, b) { return a.nama.localeCompare(b.nama, "id"); });
    },
    async listBooking(mitraId, tanggal) {
      return readData().booking.filter(function (item) { return item.mitraId === mitraId && (!tanggal || item.tanggal === tanggal); }).slice().sort(function (a, b) { return a.jamMulai.localeCompare(b.jamMulai); });
    },
    async getSlotTersedia(mitraId, layananId, tanggal) {
      return getSlotTersediaSync(readData(), mitraId, layananId, tanggal);
    },
    async buatBooking(input) {
      var data = readData();
      var slots = getSlotTersediaSync(data, input.mitraId, input.layananId, input.tanggal);
      var slot = slots.find(function (item) { return item.jamMulai === input.jamMulai && item.tersedia; });
      if (!slot) throw new Error("Maaf, slot ini baru saja tidak tersedia. Silakan pilih waktu lain.");
      var layanan = data.layanan.find(function (item) { return item.id === input.layananId && item.mitraId === input.mitraId; });
      var booking = {
        id: makeId("booking"), kode: "NB-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
        mitraId: input.mitraId, layananId: layanan.id, layananNama: layanan.nama, durasi: layanan.durasi,
        tanggal: input.tanggal, jamMulai: slot.jamMulai, jamSelesai: slot.jamSelesai,
        nama: input.nama.trim(), telepon: input.telepon, status: "menunggu", dibuatPada: new Date().toISOString()
      };
      data.booking.push(booking);
      writeData(data);
      return booking;
    },
    async updateStatusBooking(id, status) {
      if (["menunggu", "diterima", "dibatalkan"].indexOf(status) === -1) throw new Error("Status booking tidak valid.");
      var data = readData();
      var booking = data.booking.find(function (item) { return item.id === id; });
      if (!booking) throw new Error("Booking tidak ditemukan.");
      booking.status = status;
      writeData(data);
      return booking;
    },
    async tutupJam(mitraId, tanggal, jamMulai, jamSelesai) {
      var data = readData();
      getMitra(mitraId, data);
      var hasBooking = data.booking.some(function (item) {
        return item.mitraId === mitraId && item.tanggal === tanggal && item.status !== "dibatalkan" &&
          timeToMinutes(jamMulai) < timeToMinutes(item.jamSelesai) && timeToMinutes(jamSelesai) > timeToMinutes(item.jamMulai);
      });
      if (hasBooking) throw new Error("Jam tersebut memiliki booking aktif dan tidak dapat ditutup.");
      data.penutupan = data.penutupan.filter(function (item) {
        return !(item.mitraId === mitraId && item.tanggal === tanggal && item.jamMulai === jamMulai && item.jamSelesai === jamSelesai);
      });
      data.penutupan.push({ id: makeId("tutup"), mitraId: mitraId, tanggal: tanggal, jamMulai: jamMulai, jamSelesai: jamSelesai });
      writeData(data);
    },
    async bukaJam(mitraId, tanggal, jamMulai, jamSelesai) {
      var data = readData();
      data.penutupan = data.penutupan.filter(function (item) {
        if (item.mitraId !== mitraId || item.tanggal !== tanggal) return true;
        return !(timeToMinutes(jamMulai) < timeToMinutes(item.jamSelesai) && timeToMinutes(jamSelesai) > timeToMinutes(item.jamMulai));
      });
      writeData(data);
    },
    async tambahLayanan(mitraId, input) {
      var data = readData();
      getMitra(mitraId, data);
      var layanan = { id: makeId("layanan"), mitraId: mitraId, nama: input.nama.trim(), durasi: Number(input.durasi), harga: Number(input.harga) };
      validateService(layanan);
      data.layanan.push(layanan);
      writeData(data);
      return layanan;
    },
    async ubahLayanan(id, input) {
      var data = readData();
      var layanan = data.layanan.find(function (item) { return item.id === id; });
      if (!layanan) throw new Error("Layanan tidak ditemukan.");
      var updated = { id: layanan.id, mitraId: layanan.mitraId, nama: input.nama.trim(), durasi: Number(input.durasi), harga: Number(input.harga) };
      validateService(updated);
      Object.assign(layanan, updated);
      writeData(data);
      return layanan;
    },
    async hapusLayanan(id) {
      var data = readData();
      var hasBooking = data.booking.some(function (item) { return item.layananId === id && item.status !== "dibatalkan"; });
      if (hasBooking) throw new Error("Layanan masih memiliki booking aktif sehingga tidak dapat dihapus.");
      data.layanan = data.layanan.filter(function (item) { return item.id !== id; });
      writeData(data);
    },
    async loginMitra(email, password) {
      var data = readData();
      var mitra = data.mitra.find(function (item) { return item.email.toLowerCase() === email.trim().toLowerCase() && item.password === password; });
      if (!mitra) throw new Error("Email atau kata sandi tidak sesuai.");
      var session = { mitraId: mitra.id, dibuatPada: new Date().toISOString() };
      global.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return { id: mitra.id, slug: mitra.slug, nama: mitra.nama };
    },
    async logoutMitra() {
      global.localStorage.removeItem(SESSION_KEY);
    },
    async getSesiMitra() {
      var stored = global.localStorage.getItem(SESSION_KEY);
      if (!stored) return null;
      try {
        var session = JSON.parse(stored);
        var mitra = readData().mitra.find(function (item) { return item.id === session.mitraId; });
        return mitra ? { id: mitra.id, slug: mitra.slug, nama: mitra.nama } : null;
      } catch (error) {
        throw new Error("Sesi mitra tidak dapat dibaca. Silakan masuk kembali.");
      }
    },
    async getRingkasan(mitraId, tanggal) {
      var data = readData();
      var bookings = data.booking.filter(function (item) { return item.mitraId === mitraId && item.tanggal === tanggal; });
      var freeCount = (await api.getJadwalHarian(mitraId, tanggal)).filter(function (slot) { return slot.status === "kosong"; }).length;
      return { booking: bookings.length, menunggu: bookings.filter(function (item) { return item.status === "menunggu"; }).length, slotKosong: freeCount };
    },
    async getJadwalHarian(mitraId, tanggal) {
      var data = readData();
      var mitra = getMitra(mitraId, data);
      var start = timeToMinutes(mitra.jamMulai);
      var end = timeToMinutes(mitra.jamSelesai);
      var bookings = data.booking.filter(function (item) { return item.mitraId === mitraId && item.tanggal === tanggal && item.status !== "dibatalkan"; });
      var closures = data.penutupan.filter(function (item) { return item.mitraId === mitraId && item.tanggal === tanggal; });
      var now = new Date();
      var pastDate = tanggal < formatDate(now);
      var slots = [];
      for (var minute = start; minute < end; minute += 30) {
        var slotEnd = Math.min(minute + 30, end);
        var booking = bookings.find(function (item) { return minute < timeToMinutes(item.jamSelesai) && slotEnd > timeToMinutes(item.jamMulai); });
        var closed = closures.some(function (item) { return minute < timeToMinutes(item.jamSelesai) && slotEnd > timeToMinutes(item.jamMulai); });
        var past = pastDate || (tanggal === formatDate(now) && minute <= now.getHours() * 60 + now.getMinutes());
        slots.push({ jamMulai: minutesToTime(minute), jamSelesai: minutesToTime(slotEnd), status: booking ? "terisi" : closed ? "ditutup" : past ? "lewat" : "kosong", bookingKode: booking ? booking.kode : null });
      }
      return slots;
    }
  };

  function validateService(service) {
    if (!service.nama || service.durasi < 30 || service.durasi % 30 !== 0 || service.harga < 0 || !Number.isFinite(service.harga)) {
      throw new Error("Isi nama layanan, durasi kelipatan 30 menit, dan harga yang valid.");
    }
  }

  global.NamaProdukAPI = api;
})(window);

(function (global) {
  "use strict";

  var PRODUCT_NAME = "NamaProduk";

  function client() {
    if (!global.NamaProdukSupabase) {
      throw new Error("Koneksi Supabase belum siap. Periksa URL, key, dan koneksi internet.");
    }
    return global.NamaProdukSupabase;
  }

  function throwIfError(result) {
    if (result.error) {
      throw new Error(result.error.message || "Permintaan ke database gagal.");
    }
    return result.data;
  }

  function toTime(value) {
    return String(value || "").slice(0, 5);
  }

  function mapMitra(row) {
    if (!row) return null;
    return {
      id: row.id,
      slug: row.slug,
      nama: row.nama,
      kategori: row.kategori,
      alamat: row.alamat,
      telepon: row.telepon,
      jamMulai: toTime(row.jam_mulai),
      jamSelesai: toTime(row.jam_selesai),
    };
  }

  function mapLayanan(row) {
    return {
      id: row.id,
      mitraId: row.mitra_id,
      nama: row.nama,
      durasi: Number(row.durasi),
      harga: Number(row.harga),
    };
  }

  function mapBooking(row) {
    var relatedService = Array.isArray(row.layanan) ? row.layanan[0] : row.layanan;
    return {
      id: row.id,
      kode: row.kode,
      mitraId: row.mitra_id,
      layananId: row.layanan_id,
      layananNama: relatedService ? relatedService.nama : "Layanan",
      durasi: Number(row.durasi_menit || (relatedService ? relatedService.durasi : 0)),
      jumlahOrang: Number(row.jumlah_orang || 1),
      tanggal: row.tanggal,
      jamMulai: toTime(row.jam_mulai),
      jamSelesai: toTime(row.jam_selesai),
      nama: row.nama,
      telepon: row.telepon,
      status: row.status,
    };
  }

  function minutes(time) {
    var parts = toTime(time).split(":").map(Number);
    return parts[0] * 60 + parts[1];
  }

  function timeFromMinutes(value) {
    return String(Math.floor(value / 60)).padStart(2, "0") + ":" + String(value % 60).padStart(2, "0");
  }

  function dateInJakarta() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }

  // Seluruh operasi database dikelola lewat lapisan API ini.
  var api = {
    PRODUCT_NAME: PRODUCT_NAME,

    async listMitra() {
      var result = await client()
        .from("mitra")
        .select("id, slug, nama, kategori, alamat")
        .order("nama");
      return throwIfError(result);
    },

    async getMitraBySlug(slug) {
      var result = await client()
        .from("mitra")
        .select("id, slug, nama, kategori, alamat, telepon, jam_mulai, jam_selesai")
        .eq("slug", slug)
        .maybeSingle();
      return mapMitra(throwIfError(result));
    },

    async listLayanan(mitraId) {
      var result = await client()
        .from("layanan")
        .select("id, mitra_id, nama, durasi, harga")
        .eq("mitra_id", mitraId)
        .order("nama");
      return throwIfError(result).map(mapLayanan);
    },

    async listBooking(mitraId, tanggal) {
      var query = client()
        .from("booking")
        .select("id, kode, mitra_id, layanan_id, nama, telepon, tanggal, jam_mulai, jam_selesai, status, jumlah_orang, durasi_menit, layanan ( nama, durasi )")
        .eq("mitra_id", mitraId)
        .order("jam_mulai");
      if (tanggal) query = query.eq("tanggal", tanggal);
      return throwIfError(await query).map(mapBooking);
    },

    async getSlotTersedia(mitraId, layananId, tanggal, jumlahOrang) {
      var result = await client().rpc("get_slot_tersedia", {
        p_mitra_id: mitraId,
        p_layanan_id: layananId,
        p_tanggal: tanggal,
        p_jumlah_orang: Number(jumlahOrang) || 1,
      });
      return throwIfError(result).map(function (slot) {
        return {
          jamMulai: toTime(slot.jam_mulai),
          jamSelesai: toTime(slot.jam_selesai),
          status: slot.status,
          tersedia: slot.tersedia,
        };
      });
    },

    async buatBooking(input) {
      var result = await client().rpc("create_booking", {
        p_mitra_id: input.mitraId,
        p_layanan_id: input.layananId,
        p_tanggal: input.tanggal,
        p_jam_mulai: input.jamMulai,
        p_nama: input.nama.trim(),
        p_telepon: input.telepon,
        p_jumlah_orang: Number(input.jumlahOrang) || 1,
      });
      var rows = throwIfError(result);
      var row = Array.isArray(rows) ? rows[0] : rows;
      if (!row) throw new Error("Booking tidak berhasil disimpan. Silakan coba lagi.");
      return {
        id: row.booking_id,
        kode: row.kode,
        tanggal: row.tanggal,
        jamMulai: toTime(row.jam_mulai),
        jamSelesai: toTime(row.jam_selesai),
        status: row.status,
        jumlahOrang: Number(row.jumlah_orang || 1),
      };
    },

    async updateStatusBooking(id, status) {
      if (["menunggu", "diterima", "dibatalkan"].indexOf(status) === -1) {
        throw new Error("Status booking tidak valid.");
      }
      var result = await client()
        .from("booking")
        .update({ status: status })
        .eq("id", id)
        .select("id, status")
        .single();
      return throwIfError(result);
    },

    async tutupJam(mitraId, tanggal, jamMulai, jamSelesai) {
      var result = await client().rpc("tutup_jam", {
        p_mitra_id: mitraId,
        p_tanggal: tanggal,
        p_jam_mulai: jamMulai,
        p_jam_selesai: jamSelesai,
      });
      throwIfError(result);
    },

    async bukaJam(mitraId, tanggal, jamMulai, jamSelesai) {
      var result = await client().rpc("buka_jam", {
        p_mitra_id: mitraId,
        p_tanggal: tanggal,
        p_jam_mulai: jamMulai,
        p_jam_selesai: jamSelesai,
      });
      throwIfError(result);
    },

    async tambahLayanan(mitraId, input) {
      var result = await client()
        .from("layanan")
        .insert({
          mitra_id: mitraId,
          nama: input.nama.trim(),
          durasi: Number(input.durasi),
          harga: Number(input.harga),
        })
        .select("id, mitra_id, nama, durasi, harga")
        .single();
      return mapLayanan(throwIfError(result));
    },

    async ubahLayanan(id, input) {
      var result = await client()
        .from("layanan")
        .update({
          nama: input.nama.trim(),
          durasi: Number(input.durasi),
          harga: Number(input.harga),
        })
        .eq("id", id)
        .select("id, mitra_id, nama, durasi, harga")
        .single();
      return mapLayanan(throwIfError(result));
    },

    async hapusLayanan(id) {
      var result = await client().from("layanan").delete().eq("id", id);
      throwIfError(result);
    },

    async loginMitra(email, password) {
      var result = await client().auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });
      var authData = throwIfError(result);
      var profileResult = await client()
        .from("mitra")
        .select("id, slug, nama, kategori, alamat, telepon, jam_mulai, jam_selesai, auth_user_id")
        .eq("auth_user_id", authData.user.id)
        .maybeSingle();
      var profile = throwIfError(profileResult);
      if (!profile) {
        await client().auth.signOut();
        throw new Error("Akun ini belum dihubungkan dengan data mitra.");
      }
      return mapMitra(profile);
    },

    async loginAdmin(email, password) {
      var result = await client().auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });
      throwIfError(result);
    },

    async logoutMitra() {
      var result = await client().auth.signOut();
      throwIfError(result);
    },

    async getSesiMitra() {
      var authResult = await client().auth.getSession();
      if (authResult.error) throw new Error(authResult.error.message);
      var authUser = authResult.data.session && authResult.data.session.user;
      if (!authUser) return null;
      var profileResult = await client()
        .from("mitra")
        .select("id, slug, nama, kategori, alamat, telepon, jam_mulai, jam_selesai, auth_user_id")
        .eq("auth_user_id", authUser.id)
        .maybeSingle();
      var profile = throwIfError(profileResult);
      if (!profile) return null;
      return mapMitra(profile);
    },

    async getSesiAdmin() {
      var authResult = await client().auth.getSession();
      if (authResult.error) throw new Error(authResult.error.message);
      if (!authResult.data.session) return null;
      var result = await client().rpc("is_platform_admin");
      if (result.error) throw new Error(result.error.message);
      return result.data ? authResult.data.session.user : null;
    },

    async listMitraAdmin() {
      var result = await client().rpc("admin_list_mitra");
      return throwIfError(result);
    },

    async getKontakWhatsAppAdmin() {
      var result = await client().rpc("get_platform_contact_whatsapp");
      return throwIfError(result);
    },

    async simpanKontakWhatsAppAdmin(phone) {
      var normalizedPhone = String(phone || "").replace(/\D/g, "");
      if (normalizedPhone.indexOf("0") === 0) {
        normalizedPhone = "62" + normalizedPhone.slice(1);
      }
      if (!/^[0-9]{10,15}$/.test(normalizedPhone)) {
        throw new Error("Nomor WhatsApp admin harus berisi 10 sampai 15 digit.");
      }
      var result = await client().rpc("set_platform_contact_whatsapp", {
        p_phone: normalizedPhone,
      });
      throwIfError(result);
    },

    async simpanNomorWhatsAppMitra(mitraId, phone) {
      var normalizedPhone = String(phone || "").replace(/\D/g, "");
      if (normalizedPhone.indexOf("0") === 0) {
        normalizedPhone = "62" + normalizedPhone.slice(1);
      }
      if (!/^[0-9]{10,15}$/.test(normalizedPhone)) {
        throw new Error("Nomor WhatsApp usaha harus berisi 10 sampai 15 digit.");
      }
      var result = await client().rpc("admin_update_mitra_whatsapp", {
        p_mitra_id: mitraId,
        p_phone: normalizedPhone,
      });
      throwIfError(result);
    },

    async adminTambahMitra(input) {
      var result = await client().rpc("admin_create_mitra", {
        p_slug: input.slug,
        p_nama: input.nama,
        p_kategori: input.kategori,
        p_alamat: input.alamat,
        p_telepon: input.telepon,
        p_email_pemilik: input.emailPemilik,
        p_jadwal: input.jadwal,
        p_layanan: input.layanan,
      });
      var rows = throwIfError(result);
      if (!rows || !rows.length) throw new Error("Usaha belum berhasil dibuat.");
      return rows[0];
    },

    async getJadwalMingguan(mitraId) {
      var result = await client().rpc("get_jadwal_operasional", {
        p_mitra_id: mitraId,
      });
      return throwIfError(result).map(function (row) {
        return {
          hari: Number(row.hari),
          buka: row.buka,
          jamMulai: toTime(row.jam_mulai),
          jamSelesai: toTime(row.jam_selesai),
          istirahatMulai: toTime(row.istirahat_mulai),
          istirahatSelesai: toTime(row.istirahat_selesai),
        };
      });
    },

    async simpanJadwalMingguan(mitraId, jadwal) {
      var result = await client().rpc("save_jadwal_mingguan", {
        p_mitra_id: mitraId,
        p_jadwal: jadwal,
      });
      throwIfError(result);
    },

    async getRingkasan(mitraId, tanggal) {
      var bookings = await api.listBooking(mitraId, tanggal);
      var schedule = await api.getJadwalHarian(mitraId, tanggal);
      return {
        booking: bookings.length,
        menunggu: bookings.filter(function (item) {
          return item.status === "menunggu";
        }).length,
        slotKosong: schedule.filter(function (slot) {
          return slot.status === "kosong";
        }).length,
      };
    },

    async getJadwalHarian(mitraId, tanggal) {
      var weekly = await api.getJadwalMingguan(mitraId);
      var day = new Date(tanggal + "T12:00:00");
      var weekday = day.getDay();
      var daily = weekly.find(function (item) {
        return item.hari === weekday;
      });
      if (!daily || !daily.buka) return [];
      var bookingResult = await client()
        .from("booking")
        .select("kode, tanggal, jam_mulai, jam_selesai, status, jumlah_orang")
        .eq("mitra_id", mitraId)
        .eq("tanggal", tanggal)
        .neq("status", "dibatalkan");
      var bookings = throwIfError(bookingResult);
      var closureResult = await client()
        .from("penutupan_jadwal")
        .select("jam_mulai, jam_selesai")
        .eq("mitra_id", mitraId)
        .eq("tanggal", tanggal);
      var closures = throwIfError(closureResult);
      var today = dateInJakarta();
      var now = new Date();
      var currentMinutes = Number(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Jakarta",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        })
          .format(now)
          .replace(":", ""),
      );
      currentMinutes = Math.floor(currentMinutes / 100) * 60 + currentMinutes % 100;
      var pastDate = tanggal < today;
      var slots = [];

      for (var start = minutes(daily.jamMulai); start < minutes(daily.jamSelesai); start += 30) {
        var end = Math.min(start + 30, minutes(daily.jamSelesai));
        var booking = bookings.find(function (item) {
          return start < minutes(item.jam_selesai) && end > minutes(item.jam_mulai);
        });
        var breakTime = daily.istirahatMulai && start < minutes(daily.istirahatSelesai) && end > minutes(daily.istirahatMulai);
        var closed = closures.some(function (item) {
          return start < minutes(item.jam_selesai) && end > minutes(item.jam_mulai);
        });
        var isPast = pastDate || (tanggal === today && start <= currentMinutes);
        slots.push({
          jamMulai: timeFromMinutes(start),
          jamSelesai: timeFromMinutes(end),
          status: booking ? "terisi" : breakTime ? "istirahat" : closed ? "ditutup" : isPast ? "lewat" : "kosong",
          bookingKode: booking ? booking.kode : null,
          jumlahOrang: Number(booking ? booking.jumlah_orang : 0),
        });
      }
      return slots;
    },
  };
  global.NamaProdukAPI = api;
})(window);

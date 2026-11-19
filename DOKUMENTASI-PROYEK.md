# Panduan Proyek bookingYukk

Dokumen ini adalah panduan belajar untuk memahami struktur, alur kerja, data,
dan fungsi utama dalam proyek bookingYukk. Penjelasan mengikuti implementasi
yang ada di source code dan file SQL, bukan rancangan yang belum diterapkan.

## Daftar isi

1. [Gambaran proyek](#1-gambaran-proyek)
2. [Teknologi dan struktur folder](#2-teknologi-dan-struktur-folder)
3. [Cara menjalankan dan menyiapkan Supabase](#3-cara-menjalankan-dan-menyiapkan-supabase)
4. [Alur aplikasi dari awal sampai akhir](#4-alur-aplikasi-dari-awal-sampai-akhir)
5. [Model data](#5-model-data)
6. [Katalog fungsi JavaScript](#6-katalog-fungsi-javascript)
7. [Katalog fungsi database Supabase](#7-katalog-fungsi-database-supabase)
8. [Keamanan dan batasan prototipe](#8-keamanan-dan-batasan-prototipe)
9. [Istilah penting](#9-istilah-penting)
10. [Cara belajar dan menelusuri masalah](#10-cara-belajar-dan-menelusuri-masalah)

## 1. Gambaran proyek

bookingYukk adalah aplikasi web booking untuk usaha jasa lokal seperti
barbershop, salon, laundry, dan bengkel. Ada tiga jenis pengguna:

- **Pelanggan** mencari usaha, membuka link booking usaha tertentu, memilih
  layanan dan jadwal, lalu mengirim permintaan tanpa membuat akun.
- **Mitra/pemilik usaha** masuk ke dashboard untuk mengelola booking, jam
  operasional, penutupan slot, layanan, dan harga.
- **Pengelola platform/admin** mendaftarkan mitra, menghubungkan akun pemilik,
  dan mengatur nomor WhatsApp pengelola.

Frontend dibuat dengan HTML, CSS, dan JavaScript vanilla. Data dan autentikasi
menggunakan Supabase. Tidak ada framework frontend atau proses bundling yang
dijalankan oleh aplikasi.

### Ide utama sistem

Setiap mitra memiliki URL publik sendiri, misalnya:

```text
booking.html?mitra=barber-jamal
```

Bagian `barber-jamal` adalah **slug**. Slug mencari profil usaha, lalu aplikasi
menggunakan UUID `mitra.id` untuk mengambil layanan, jadwal, dan booking yang
terkait. Semua mitra berada di tabel/database Supabase yang sama; data
dipisahkan menggunakan `mitra_id`, bukan dengan membuat database baru untuk
setiap slug.

### Dua jenis status booking

- Booking baru dibuat dengan status `menunggu`.
- Mitra dapat mengubah status menjadi `diterima` atau `dibatalkan`.
- Booking yang dibatalkan tidak lagi menghalangi slot, kecuali slot sudah lewat
  atau ditutup secara terpisah.
- Status booking adalah status permintaan layanan, bukan status pembayaran.

## 2. Teknologi dan struktur folder

### Teknologi

- **HTML** menyusun halaman, form, elemen navigasi, dan area yang akan diisi
  dengan data.
- **CSS** menangani warna, tata letak, responsivitas, fokus keyboard, dan
  komponen antarmuka. Variabel tema utama ada di `css/style.css`.
- **JavaScript vanilla** mengatur interaksi halaman dan pemanggilan API. File
  dimuat sebagai script klasik biasa.
- **Supabase JavaScript client** dimuat dari CDN, lalu digunakan untuk Auth,
  query database, RPC, dan Realtime.
- **PostgreSQL, RLS, grants, dan RPC Supabase** menyimpan serta melindungi data.

### File dan tanggung jawabnya

| File/folder | Tanggung jawab |
|---|---|
| [index.html](./index.html) | Beranda, petunjuk pemesanan, pencarian/filter mitra, testimoni ilustrasi, FAQ, dan ajakan untuk mitra. |
| [booking.html](./booking.html) | Halaman pelanggan untuk satu mitra; profil, layanan, tanggal, slot, form, struk, dan sukses booking. |
| [mitra/login.html](./mitra/login.html) | Form login pemilik mitra dan informasi portal. |
| [mitra/dashboard.html](./mitra/dashboard.html) | Struktur dashboard mitra: informasi, tren, booking, jadwal, pelanggan, dan layanan. |
| [admin/index.html](./admin/index.html) | Struktur login admin dan formulir pendaftaran/pengelolaan mitra. |
| [css/style.css](./css/style.css) | Reset, warna global, tombol, form, tipografi, dan komponen bersama. |
| [css/landing.css](./css/landing.css) | Tata letak dan gaya beranda. |
| [css/booking.css](./css/booking.css) | Tata letak halaman booking dan struk pelanggan. |
| [css/login.css](./css/login.css) | Tata letak halaman login mitra. |
| [css/dashboard.css](./css/dashboard.css) | Komponen dashboard, tab, tabel/kartu, dan jadwal. |
| [css/admin.css](./css/admin.css) | Tampilan pengelola platform. |
| [js/supabase-client.js](./js/supabase-client.js) | Membuat satu Supabase client untuk digunakan aplikasi. |
| [js/api.js](./js/api.js) | Satu-satunya lapisan aplikasi yang membaca/menulis data Supabase. |
| [js/utils.js](./js/utils.js) | Fungsi format, validasi, escape HTML, dan branding bersama. |
| [js/landing.js](./js/landing.js) | Pemuatan direktori dan filter beranda. |
| [js/booking.js](./js/booking.js) | Alur booking pelanggan dan validasi form. |
| [js/login.js](./js/login.js) | Pemeriksaan sesi dan login mitra. |
| [js/dashboard.js](./js/dashboard.js) | Interaksi dan pembaruan dashboard mitra. |
| [js/admin.js](./js/admin.js) | Login admin, pendaftaran usaha, dan pengelolaan kontak. |
| [supabase/](./supabase) | Migrasi SQL, kebijakan akses, fungsi RPC, dan utilitas database. |
| [images/logo.png](./images/logo.png) | Logo platform yang digunakan pada beranda. |

### Urutan pemuatan script

Setiap halaman yang memakai Supabase memuat script dalam urutan berikut:

1. Supabase JavaScript SDK dari CDN.
2. `supabase-client.js` membuat `window.NamaProdukSupabase`.
3. `api.js` membuat `window.NamaProdukAPI`.
4. `utils.js` membuat `window.NamaProdukUI`.
5. Script khusus halaman (`landing.js`, `booking.js`, `login.js`,
   `dashboard.js`, atau `admin.js`).

Urutan ini penting: script yang menggunakan API tidak boleh dimuat sebelum
`api.js`. Script tetap non-module agar sesuai dengan pola halaman saat ini.

## 3. Cara menjalankan dan menyiapkan Supabase

### Menjalankan frontend

1. Buka folder proyek di VS Code.
2. Jalankan `index.html` dengan ekstensi Live Server.
3. Pastikan browser terhubung ke internet untuk memuat Supabase SDK dan
   mengakses proyek Supabase.
4. Periksa URL dan Publishable key di `js/supabase-client.js` jika memakai
   proyek Supabase yang berbeda.

Hindari `file://` untuk pengujian login; origin dari Live Server lebih sesuai
untuk Supabase Auth. Aplikasi tidak memerlukan build frontend. Walaupun ada
file manifest dependency dalam repository, halaman HTML memuat Supabase SDK
langsung dari CDN.

### Prasyarat database

Migrasi proyek mengasumsikan tabel inti seperti `mitra`, `layanan`, `booking`,
dan `penutupan_jadwal` sudah dibuat oleh setup database sebelumnya. Tabel inti
tersebut tidak semuanya dibuat ulang oleh kumpulan migrasi di folder
`supabase/`.

Urutan umum migrasi yang dipakai source saat ini:

1. Siapkan skema/tabel inti serta relasi foreign key Supabase.
2. Jalankan `supabase/booking-access.sql` untuk kebijakan dasar dan RPC akses
   booking.
3. Jalankan `supabase/tenant-scheduling.sql` untuk jadwal mingguan, peran admin
   platform, booking rombongan, dan versi RPC terbaru.
4. Jalankan `supabase/platform-contact.sql` untuk nomor WhatsApp pengelola dan
   fitur kontak usaha dari admin.
5. Jalankan `supabase/dashboard-realtime.sql` untuk publikasi Realtime dan
   waktu pembuatan booking yang dipakai dashboard.
6. Jalankan `supabase/security-hardening.sql` **terakhir**. File ini menutup
   pembacaan langsung nomor telepon mitra oleh publik. Jalankan ulang setelah
   migrasi akses/jadwal yang mengubah grant atau kebijakan, supaya penguncian
   kolom telepon tetap berlaku.
7. Buat akun Auth admin, sesuaikan email target di
   `supabase/register-platform-admin.sql`, lalu jalankan SQL tersebut untuk
   menambahkan role admin.

Sebelum menghapus data contoh, baca
`supabase/clear-demo-data.sql`: file tersebut menghapus usaha berdasarkan slug
yang tertulis dan data terkait dapat ikut terhapus melalui foreign key cascade.
File ini opsional dan bukan bagian dari setup biasa.

> Menjalankan file SQL di editor lokal tidak mengubah Supabase. Setiap migrasi
> harus dijalankan pada SQL Editor proyek Supabase yang memang dipakai aplikasi.

## 4. Alur aplikasi dari awal sampai akhir

### 4.1 Beranda dan pencarian mitra

1. `index.html` memuat layout beranda.
2. `landing.js` memanggil `listMitraDirektori()` melalui `api.js`.
3. API mengambil profil mitra dan layanan, lalu mengambil jadwal mingguan
   setiap mitra.
4. Beranda membuat pilihan kategori dari data yang diterima.
5. Pencarian, kategori, harga, jam buka/tutup, dan urutan mengubah hasil di
   browser tanpa mengirim ulang query untuk setiap ketikan.
6. Tombol pada kartu membuka `booking.html?mitra=<slug>`.

Kartu layanan dan testimoni contoh diberi penanda ilustrasi jika isinya bukan
data/ulasan nyata.

### 4.2 Pelanggan membuat booking

1. `booking.js` membaca query URL `mitra`.
2. `getMitraBySlug()` mencari satu profil berdasarkan slug dan mengambil kontak
   publik lewat RPC khusus.
3. `listLayanan()` dan `getJadwalMingguan()` mengambil layanan dan jam usaha.
4. Pelanggan memilih layanan, jumlah orang, tanggal, dan slot.
5. `getSlotTersedia()` meminta database menghitung ketersediaan. UI membedakan
   slot kosong, terisi, ditutup, dan lewat.
6. Pelanggan mengisi nama dan nomor HP. Struk serta tombol konfirmasi
   diperbarui saat pilihan berubah.
7. Saat dikirim, `create_booking()` memeriksa ulang ketersediaan di database
   dan menyimpan booking. Pemeriksaan kedua mencegah dua pelanggan mendapatkan
   slot yang sama pada saat hampir bersamaan.
8. UI menampilkan kode booking dan link WhatsApp dengan pesan terisi. Pesan
   tidak dikirim otomatis; pelanggan tetap mengirimnya dari WhatsApp.

Booking rombongan menggunakan satu layanan yang sama, dilakukan berurutan pada
satu kursi/pekerja. Durasi keseluruhan = durasi layanan per orang × jumlah
orang. Jumlah orang dibatasi 1–12.

### 4.3 Mitra mengelola usaha

1. Pemilik masuk lewat Supabase Auth pada `mitra/login.html`.
2. API mencari profil mitra yang `auth_user_id`-nya sama dengan user Auth.
3. `dashboard.js` memuat booking milik mitra itu dan memasang langganan
   Supabase Realtime.
4. Dashboard menghitung informasi hari ini, tren 7 hari, rasio status, booking
   terbaru, daftar pelanggan, jadwal, dan layanan.
5. Perubahan data terkait memicu refresh singkat (debounce) agar dashboard
   menampilkan data baru.
6. Mitra dapat menerima/membatalkan booking, menutup/membuka slot, mengubah
   jadwal mingguan, dan mengelola layanan.

### 4.4 Admin mendaftarkan mitra

1. Pengelola platform masuk menggunakan akun Auth yang memiliki role
   `platform_admins`.
2. Akun Auth pemilik mitra harus sudah dibuat terlebih dahulu.
3. Admin mengisi profil usaha, slug, kontak usaha, jadwal 7 hari, layanan awal,
   dan email pemilik.
4. `admin_create_mitra()` memvalidasi isi, menghubungkan email ke user Auth,
   lalu menyimpan mitra, jadwal, dan layanan.
5. Aplikasi membuat link publik usaha dari slug tersebut.

## 5. Model data

Nama kolom aktual dapat bergantung pada skema inti yang dibuat sebelum migrasi.
Hubungan utama yang dipakai aplikasi adalah:

| Entitas/tabel | Isi | Hubungan |
|---|---|---|
| `mitra` | Identitas usaha: `id`, `slug`, nama, kategori, alamat, nomor kontak, akun pemilik, status aktif, dan jam dasar lama. | Satu mitra mempunyai banyak layanan, booking, jadwal, dan penutupan. |
| `layanan` | Nama layanan, durasi, harga. | Setiap layanan memiliki `mitra_id`; harga adalah harga layanan, bukan harga global platform. |
| `jadwal_mingguan` | Hari buka/tutup, jam mulai/selesai, dan jam istirahat. | Primary key gabungan `(mitra_id, hari)` membuat paling banyak satu pengaturan per hari per mitra. |
| `booking` | Kode, pemesan, kontak, tanggal, rentang waktu, status, jumlah orang, dan durasi tersimpan. | Terhubung ke mitra dan layanan; dashboard hanya menampilkan data mitra yang berwenang. |
| `penutupan_jadwal` | Rentang waktu yang ditutup pada tanggal tertentu. | Terhubung ke mitra; berbeda dari jam istirahat mingguan. |
| `platform_admins` | Daftar user Auth yang memiliki role pengelola platform. | `user_id` merujuk ke `auth.users`. |
| `platform_settings` | Kontak WhatsApp admin platform dan waktu perubahan. | Dibuat sebagai pengaturan platform tunggal. |
| Supabase Auth | User dan sesi login. | `mitra.auth_user_id` menghubungkan user pemilik dengan profil usaha. |

**Slug adalah alamat yang bisa dibaca manusia, bukan foreign key.** Slug
digunakan untuk menemukan satu baris `mitra`. Setelah profil ditemukan,
aplikasi memakai `mitra.id` untuk query terkait. Mengubah slug mengubah link
publik, tetapi hubungan layanan dan booking tetap menggunakan ID mitra.

## 6. Katalog fungsi JavaScript

Semua fungsi yang bernama dan metode API dijelaskan di bawah. Banyak callback
ditulis sebagai arrow function langsung di dalam event listener, `map`,
`filter`, `reduce`, atau `Promise.all`; callback tersebut dijelaskan bersama
fungsi induknya karena tidak memiliki nama dan tidak dipanggil dari tempat
lain secara mandiri.

### 6.1 `js/api.js` — lapisan data

#### Helper internal

| Fungsi | Kegunaan |
|---|---|
| `client()` | Mengambil `window.NamaProdukSupabase`; melempar error eksplisit jika Supabase belum siap. |
| `throwIfError(result)` | Memeriksa properti `error` dari hasil query/RPC; melempar error atau mengembalikan `data`. |
| `toTime(value)` | Menormalkan representasi jam dari database menjadi teks `HH:MM`. |
| `mapMitra(row)` | Mengubah record mitra snake_case dari database menjadi bentuk objek JS, misalnya `jam_mulai` menjadi `jamMulai`. Mengembalikan `null` bila row kosong. |
| `mapLayanan(row)` | Mengubah layanan database menjadi objek JS dan mengubah durasi/harga menjadi angka. |
| `mapJadwal(row)` | Mengubah record jadwal mingguan menjadi nama properti JS dan format jam yang dipakai UI. |
| `mapBooking(row)` | Membentuk satu model booking untuk UI, termasuk data layanan relasi, jumlah orang, durasi, harga, status, dan waktu. Jika relasi layanan berupa array, mengambil elemen pertama. |
| `minutes(time)` | Mengubah `HH:MM` menjadi total menit sejak tengah malam untuk membandingkan rentang waktu. |
| `timeFromMinutes(value)` | Mengubah total menit kembali menjadi string `HH:MM`. |
| `dateInJakarta()` | Menghasilkan tanggal hari ini berdasarkan zona waktu `Asia/Jakarta` dalam format `YYYY-MM-DD`. |

#### Metode pada `window.NamaProdukAPI`

**Mitra dan direktori**

| Metode | Kegunaan |
|---|---|
| `listMitra()` | Mengambil daftar ringkas mitra berdasarkan nama. |
| `listMitraDirektori()` | Mengambil profil mitra beserta layanan berelasi dalam query direktori, lalu mengambil jadwal tiap mitra; hasil dipetakan untuk kartu beranda. |
| `getMitraBySlug(slug)` | Mencari satu usaha berdasarkan slug; jika ada, mengubah row ke model mitra dan mengambil kontak publik melalui RPC. |
| `getMitraPublicContact(slug)` | Memanggil RPC yang hanya mengembalikan nomor kontak usaha aktif yang diminta. |
| `listLayanan(mitraId)` | Mengambil dan mengurutkan layanan satu mitra, lalu memetakan setiap row. |
| `getJadwalMingguan(mitraId)` | Memanggil RPC jadwal operasional satu mitra, kemudian memetakan hasilnya. |
| `simpanJadwalMingguan(mitraId, jadwal)` | Mengirim jadwal mingguan baru ke RPC database untuk divalidasi dan disimpan. |

**Booking, slot, dan jadwal**

| Metode | Kegunaan |
|---|---|
| `listBooking(mitraId, tanggal)` | Mengambil booking satu mitra, opsional dibatasi tanggal, mengurutkan dari data terbaru, dan memetakan hasil dengan `mapBooking()`. |
| `getSlotTersedia(mitraId, layananId, tanggal, jumlahOrang)` | Meminta RPC database menghasilkan slot sesuai durasi layanan, jadwal, istirahat, booking, penutupan, waktu kini, dan jumlah orang. |
| `buatBooking(input)` | Memanggil RPC pembuatan booking; mengirim input pemesan dan mengubah hasil RPC ke objek booking UI. Error dilempar jika database tidak mengembalikan booking. |
| `updateStatusBooking(id, status)` | Memvalidasi status lokal, memperbarui status booking, dan mengambil row hasil update. Status yang diterima: `menunggu`, `diterima`, `dibatalkan`. |
| `getJadwalHarian(mitraId, tanggal)` | Menggabungkan jadwal mingguan, booking, dan penutupan untuk menghasilkan slot setengah jam berstatus kosong/terisi/istirahat/ditutup/lewat. |
| `getRingkasan(mitraId, tanggal)` | Menghitung total booking, booking menunggu, dan jumlah slot kosong pada tanggal tertentu. |
| `tutupJam(mitraId, tanggal, jamMulai, jamSelesai)` | Meminta database menutup rentang slot pada satu tanggal; otorisasi dan benturan booking diperiksa di database. |
| `bukaJam(mitraId, tanggal, jamMulai, jamSelesai)` | Meminta database menghapus penutupan yang beririsan dengan rentang waktu tersebut. |

**Realtime dashboard**

| Metode | Kegunaan |
|---|---|
| `subscribeDashboardRealtime(mitraId, onChange, onStatus)` | Membuat channel Supabase Realtime untuk perubahan `booking`, `penutupan_jadwal`, `jadwal_mingguan`, dan `layanan` milik mitra; callback perubahan dan status koneksi diberikan oleh pemanggil. |
| `unsubscribeDashboardRealtime(channel)` | Melepaskan channel Realtime ketika tidak diperlukan lagi. |

**Layanan, login, dan sesi**

| Metode | Kegunaan |
|---|---|
| `tambahLayanan(mitraId, input)` | Menyimpan nama, durasi, dan harga layanan baru, lalu memetakan hasilnya. |
| `ubahLayanan(id, input)` | Mengubah nama, durasi, atau harga layanan berdasarkan ID dan mengembalikan hasilnya. |
| `hapusLayanan(id)` | Menghapus layanan berdasarkan ID; kebijakan database tetap menentukan aksesnya. |
| `loginMitra(email, password)` | Login via Supabase Auth, mencari profil mitra berdasarkan user Auth, dan keluar lagi jika user tidak terhubung ke mitra. |
| `loginAdmin(email, password)` | Login via Supabase Auth. Pemeriksaan role admin dilakukan terpisah melalui `getSesiAdmin()`. |
| `logoutMitra()` | Meminta Supabase Auth mengakhiri sesi aktif. |
| `getSesiMitra()` | Memeriksa sesi Auth lalu mengambil profil mitra yang terhubung; `null` jika tidak ada sesi/profil. |
| `getSesiAdmin()` | Memeriksa sesi Auth lalu memanggil RPC `is_platform_admin`; mengembalikan user hanya jika memiliki role admin. |

**Pengelolaan platform dan kontak**

| Metode | Kegunaan |
|---|---|
| `listMitraAdmin()` | Mengambil daftar usaha untuk area admin melalui RPC khusus admin. |
| `getKontakWhatsAppAdmin()` | Mengambil nomor WhatsApp pengelola melalui RPC yang memeriksa jenis user. |
| `simpanKontakWhatsAppAdmin(phone)` | Menormalkan nomor ke digit/kode negara, memvalidasi panjang 10–15 digit, lalu menyimpan lewat RPC admin. |
| `simpanNomorWhatsAppMitra(mitraId, phone)` | Memvalidasi dan mengubah nomor kontak publik mitra melalui RPC admin. |
| `adminTambahMitra(input)` | Mengirim profil, slug, email pemilik, jadwal mingguan, dan layanan awal ke RPC pendaftaran usaha. |

### 6.2 `js/utils.js` — helper antarmuka bersama

| Fungsi | Kegunaan |
|---|---|
| `escapeHtml(value)` | Mengubah karakter HTML berbahaya menjadi entity sebelum nilai dinamis dimasukkan ke markup HTML. |
| `formatRupiah(value)` | Memformat angka menjadi mata uang Rupiah dengan locale Indonesia. |
| `formatTanggal(value, options)` | Memformat string tanggal `YYYY-MM-DD` menjadi tanggal berbahasa Indonesia; `options` mengatur bagian tanggal yang ditampilkan. |
| `phoneToWhatsApp(value)` | Menghapus selain digit, lalu mengubah awalan `0` menjadi `62` untuk link WhatsApp. |
| `isValidIndonesianPhone(value)` | Memeriksa pola nomor HP Indonesia setelah karakter non-digit dan awalan `62` dinormalisasi. |
| `applyProductName()` | Mengisi elemen `[data-product-name]` dan mengganti nama produk pada title/meta description. |
| `setPageBrand(name, title, ariaLabel)` | Mengganti identitas halaman/aksesibilitas pada elemen branding halaman dan, bila diberikan, judul dokumen. |

Fungsi-fungsi tersebut diekspos melalui `window.NamaProdukUI`.

### 6.3 `js/landing.js` — beranda dan direktori

| Fungsi | Kegunaan |
|---|---|
| `initialize()` | Menyiapkan nama produk, logo, tahun footer, listener filter, lalu memuat direktori. Menampilkan pesan jika pemuatan gagal. |
| `initializePlatformLogos()` | Mengatur gambar logo beranda dan menyembunyikannya jika file gambar gagal dimuat. |
| `bindFilters()` | Menghubungkan perubahan form filter dan reset form ke proses render ulang direktori. |
| `populateCategoryFilter()` | Membuat pilihan kategori unik dari data mitra yang berhasil dimuat. |
| `renderPartners()` | Membaca pencarian/kategori/harga/jam/urutan, memvalidasi rentang harga, memfilter dan mengurutkan mitra, lalu menampilkan kartu atau keadaan kosong. |
| `matchesPrice(partner, min, max)` | Menentukan apakah minimal satu layanan mitra berada dalam batas harga pilihan. |
| `matchesHours(partner, latestOpening, earliestClosing)` | Menentukan apakah ada hari buka mitra yang memenuhi batas jam buka/tutup. |
| `getCheapestPrice(partner)` | Menghasilkan harga layanan terendah untuk digunakan saat pengurutan direktori. |
| `comparePrice(first, second, direction)` | Membandingkan harga awal dua mitra, menangani mitra tanpa layanan, dan memakai nama sebagai urutan pemecah nilai sama. |
| `renderPartnerCard(partner, min, max)` | Membentuk kartu mitra berisi kategori, nama, alamat, harga, jam, layanan/jadwal rinci, dan link booking. |

Callback dalam `filter`, `map`, `reduce`, dan event listener di file ini
menyusun pencarian, mengurutkan data, membangun HTML kartu, dan merespons
perubahan filter; callback tidak disimpan sebagai fungsi global.

### 6.4 `js/booking.js` — halaman pemesanan pelanggan

#### Fungsi bernama

| Fungsi | Kegunaan |
|---|---|
| `initialize()` | Membaca slug, memuat profil/kontak/layanan/jadwal, mengisi halaman, dan menangani slug tidak ditemukan atau error. |
| `showNotFound()` | Menyembunyikan pesan loading dan menampilkan keadaan mitra tidak ditemukan. |
| `showError(message)` | Menampilkan pesan error halaman booking. |
| `clearError()` | Mengosongkan dan menyembunyikan pesan error booking. |
| `renderServices()` | Membentuk kartu tombol layanan; listener pilihan menyimpan layanan, memperbarui slot, dan memperbarui struk. |
| `renderBusinessHours()` | Menampilkan jadwal mingguan dan jam istirahat usaha. |
| `renderDates()` | Membuat tombol tanggal untuk hari ini hingga 13 hari berikutnya; pilihan tanggal memuat ulang slot. |
| `renderSlots()` | Memvalidasi layanan/jumlah orang, meminta slot dari database, mencegah respons request lama menimpa pilihan terbaru, dan menampilkan slot/keadaan kosong/error. |
| `updateCustomerForm()` | Menghitung kesiapan form, durasi, estimasi harga, isi struk, dan teks tombol lanjutan/konfirmasi. |
| `getNextBookingTarget()` | Menentukan bagian yang perlu dilengkapi berikutnya dan label tombol panduan, seperti pilih layanan atau isi nomor. |
| `setFormError(message)` | Menampilkan kesalahan validasi/pengiriman form pelanggan. |
| `updateWhatsAppLinks(message)` | Memvalidasi nomor mitra, lalu menyusun URL WhatsApp dengan pesan yang sudah di-encode. |
| `formatInputDate(date)` | Memformat objek tanggal UTC sebagai `YYYY-MM-DD` untuk input dan API. |
| `getJakartaDate()` | Membaca tahun/bulan/hari saat ini dalam zona waktu Jakarta. |

#### Listener inline

- Listener layanan dan tanggal memperbarui pilihan serta memuat slot baru.
- Listener slot memilih waktu yang tersedia.
- Listener jumlah orang memvalidasi 1–12, mengosongkan slot terpilih, dan memuat ulang slot.
- Listener nama/telepon memperbarui validasi dan struk.
- Tombol struk mencari langkah yang belum lengkap; tombol mobile menggulir ke form struk.
- Listener submit memvalidasi input, mencegah submit ganda, memanggil `buatBooking()`, menampilkan kode sukses atau error, dan membangun pesan WhatsApp.

### 6.5 `js/login.js` — login mitra

File ini tidak memiliki fungsi bernama terpisah; semua logika berada pada dua
callback event:

1. **Callback `DOMContentLoaded`** menerapkan branding, memeriksa sesi yang
   masih aktif, dan mengarahkan mitra yang sudah login ke dashboard.
2. **Callback submit form** mencegah submit HTML biasa, memanggil
   `loginMitra()`, mengarahkan ke dashboard jika berhasil, atau menampilkan
   pesan error.

### 6.6 `js/dashboard.js` — dashboard mitra

**Bootstrap, tab, dan data**

| Fungsi | Kegunaan |
|---|---|
| `initialize()` | Memeriksa sesi mitra, mengarahkan user yang belum login, mengisi identitas/link booking, memasang event dan Realtime, lalu memuat dashboard. |
| `renderAdminContactLink()` | Memuat kontak WhatsApp pengelola dan membentuk pesan/link untuk mitra yang sudah login. |
| `bindEvents()` | Memasang listener keluar, tab keyboard, filter booking, tanggal jadwal, form jadwal, aksi booking/slot, dan dialog layanan. |
| `activateTab(tab)` | Memperbarui atribut aksesibilitas/tab aktif, menyembunyikan panel lain, dan memuat ulang bagian jadwal/layanan saat dibuka. |
| `handleTabKeydown(event)` | Mendukung navigasi tab dengan panah kiri/kanan, Home, dan End. |
| `refreshAll()` | Memuat booking mitra sebagai cache lalu memperbarui statistik, overview, booking, pelanggan, jadwal, dan layanan. |
| `scheduleRealtimeRefresh()` | Menjadwalkan refresh setelah perubahan Realtime dengan jeda singkat agar event beruntun tidak memicu query berulang. |
| `handleRealtimeStatus(status, error)` | Memperbarui indikator koneksi Realtime; menampilkan error saat channel gagal atau timeout. |
| `getJakartaDate()` | Menghasilkan tanggal lokal Jakarta untuk filter dan informasi hari ini. |

**Statistik dan daftar booking**

| Fungsi | Kegunaan |
|---|---|
| `renderStats(bookings)` | Menghitung booking hari ini, nilai booking diterima × jumlah orang, booking menunggu, dan slot kosong hari ini. |
| `renderBookings()` | Memfilter cache booking menurut semua/tanggal tertentu, status, nama atau kode; lalu menampilkan daftar dengan aksi. |
| `handleBookingAction(event)` | Mengirim aksi Terima/Batalkan ke API, menonaktifkan tombol selama proses, dan refresh jika berhasil. |
| `bookingCard(item, includeActions)` | Membentuk kartu booking dan link WhatsApp; opsi `includeActions` mengatur tombol untuk daftar manajemen. |
| `statusLabel(status)` | Mengubah nilai status untuk label tampilan dengan huruf awal kapital. |
| `compareBookingDate(first, second)` | Mengurutkan booking berdasarkan tanggal, lalu jam mulai. |
| `addDays(date, amount)` | Menghitung tanggal relatif dari tanggal dasar dalam konteks offset Jakarta yang digunakan tren mingguan. |

**Dashboard overview dan pelanggan**

| Fungsi | Kegunaan |
|---|---|
| `renderOverview(bookings)` | Membuat grafik 7 hari, menghitung rasio status untuk 7 hari, dan menampilkan lima booking terbaru. |
| `countStatus(bookings, status)` | Menghitung banyak booking dengan status tertentu. |
| `ratioSegment(status, count, total)` | Membuat segmen bar rasio untuk suatu status. |
| `renderCustomers(bookings)` | Menampilkan daftar pelanggan per booking dengan detail layanan/jadwal/status dan tombol WhatsApp. |

**Jadwal**

| Fungsi | Kegunaan |
|---|---|
| `renderSchedule()` | Mengambil slot harian dan menampilkan statusnya; slot kosong/ditutup dapat diberi tombol tutup/buka. |
| `renderWeeklyHours()` | Membentuk form tujuh hari dari jadwal mitra, termasuk jam buka, tutup, dan istirahat. |
| `handleWeeklyHoursToggle(event)` | Mengaktifkan/menonaktifkan input jam ketika checkbox hari buka berubah. |
| `saveWeeklyHours(event)` | Memvalidasi tujuh hari dan waktu istirahat, lalu menyimpan melalui API dan refresh dashboard. Helper lokal `getTime(field)` membaca input jam berdasarkan nama field dan mengubah nilai kosong menjadi `null`. |
| `handleScheduleAction(event)` | Memanggil API tutup/buka untuk slot tanggal yang dipilih, lalu refresh. |

**Layanan dan pesan error**

| Fungsi | Kegunaan |
|---|---|
| `renderServices()` | Mengambil layanan mitra dan membentuk kartu ubah/hapus atau pesan jika belum ada layanan. |
| `handleServiceAction(event)` | Mencari layanan terkait tombol, membuka dialog edit, atau meminta konfirmasi dan menghapus layanan. |
| `openServiceDialog(service)` | Mengisi dialog untuk tambah/edit, membersihkan error, menampilkan modal, dan memfokuskan nama layanan. |
| `closeServiceDialog()` | Menutup dialog layanan. |
| `saveService(event)` | Memvalidasi melalui form browser/API, menambah atau mengubah layanan, lalu refresh dashboard. |
| `showError(message)` | Menampilkan error umum pada dashboard. |

Listener inline di `bindEvents()` menghubungkan fungsi-fungsi ini dengan HTML;
callback tersebut bukan API terpisah.

### 6.7 `js/admin.js` — portal pengelola platform

| Fungsi | Kegunaan |
|---|---|
| `initialize()` | Mengisi jadwal/layanan awal, memasang listener form, memeriksa sesi admin, dan membuka workspace jika sesi valid. |
| `login(event)` | Login Auth, memeriksa role platform admin, dan menampilkan workspace atau pesan error. |
| `showWorkspace(email)` | Menampilkan area admin serta memuat daftar mitra dan kontak admin. |
| `logout()` | Mengakhiri sesi Auth dan memuat ulang halaman. |
| `showLoginError(message)` | Menampilkan atau menyembunyikan error login admin. |
| `showPageError(message)` | Menampilkan atau menyembunyikan error umum halaman admin. |
| `loadAdminContact()` | Memuat nomor kontak admin ke form dan menampilkan error jika gagal. |
| `saveAdminContact(event)` | Menormalkan/memvalidasi nomor WhatsApp admin, menyimpan lewat RPC, dan menampilkan status berhasil/gagal. |
| `saveMerchantPhone(event)` | Menangani submit form kontak satu mitra, memvalidasi nomor, menyimpan lewat RPC, dan memberi status. |
| `renderScheduleInputs()` | Membuat input jadwal tujuh hari untuk usaha baru dengan hari kerja awal yang dapat diedit. |
| `toggleDay(event)` | Mengaktifkan/menonaktifkan input jam berdasarkan status buka/tutup hari. |
| `addServiceRow()` | Membuat satu baris form layanan awal yang bisa diisi admin. |
| `removeService(event)` | Menghapus baris layanan; jika hanya tersisa satu baris, mengosongkan nama daripada menghilangkan seluruh form. |
| `collectSchedule()` | Membaca dan memvalidasi jam buka/tutup/istirahat tujuh hari, lalu mengembalikan data jadwal. |
| `createMerchant(event)` | Memvalidasi jadwal, layanan, dan nomor; memanggil `adminTambahMitra()`, membersihkan form, refresh daftar, dan menampilkan link booking. |
| `renderMerchants()` | Memuat daftar usaha admin dan membentuk kartu link booking serta form edit WhatsApp. |

### 6.8 `js/supabase-client.js` — inisialisasi

File ini menjalankan satu **IIFE** (fungsi yang langsung dieksekusi), bukan
fungsi bernama yang dipanggil halaman. IIFE memeriksa SDK CDN, kemudian
membuat client Supabase dan menyimpannya di `window.NamaProdukSupabase`.
Publishable key memang boleh berada di frontend; Secret/service-role key tidak
boleh.

## 7. Katalog fungsi database Supabase

Fungsi database yang dipanggil dari JavaScript disebut **RPC**. Validasi penting
tetap dilakukan di database karena validasi frontend dapat dilewati oleh
pengguna yang memanggil endpoint secara langsung.

### `supabase/booking-access.sql`

File ini memasang RLS/grants awal serta definisi awal fungsi berikut:

| Fungsi | Tujuan |
|---|---|
| `get_slot_tersedia(mitra, layanan, tanggal)` | Versi awal pembuat slot: menghitung rentang layanan dan memberi status kosong, terisi, ditutup, atau lewat. |
| `create_booking(mitra, layanan, tanggal, jam, nama, telepon)` | Versi awal penyimpanan booking; memvalidasi input, mengambil lock pada mitra, mengecek benturan/penutupan, lalu menyimpan status awal menunggu. |
| `tutup_jam(mitra, tanggal, mulai, selesai)` | Memeriksa bahwa pemilik sedang menutup waktu yang valid dan tidak bertabrakan dengan booking aktif. |
| `buka_jam(mitra, tanggal, mulai, selesai)` | Menghapus penutupan jadwal yang beririsan, setelah memastikan mitra milik user yang login. |

Versi fungsi `get_slot_tersedia` dan `create_booking` pada file ini adalah versi
sebelum dukungan booking rombongan. `tenant-scheduling.sql` menghapus/mengganti
signature tersebut dengan versi yang menerima `jumlah_orang`.

### `supabase/tenant-scheduling.sql`

Selain tabel jadwal mingguan, relasi admin, grants, dan RLS, file ini membuat
atau memperbarui fungsi:

| Fungsi | Tujuan |
|---|---|
| `is_platform_admin()` | Mengembalikan true jika user Auth saat ini terdaftar pada `platform_admins`. |
| `get_jadwal_operasional(mitra_id)` | Mengembalikan jadwal mingguan mitra aktif untuk halaman publik. |
| `admin_create_mitra(...)` | Hanya admin platform yang boleh menjalankan; memvalidasi slug/profil/layanan/jadwal, mencari user pemilik berdasarkan email, lalu membuat mitra, jadwal tujuh hari, dan layanan awal. |
| `admin_list_mitra()` | Hanya admin platform yang boleh menjalankan; mengembalikan daftar ringkas semua mitra. Versi `platform-contact.sql` menambahkan kolom kontak telepon. |
| `save_jadwal_mingguan(mitra_id, jadwal)` | Memastikan pemanggil adalah pemilik mitra, memvalidasi tujuh hari dan booking mendatang, lalu insert/update jadwal per hari. |
| `get_slot_tersedia(mitra_id, layanan_id, tanggal, jumlah_orang)` | Versi final perhitungan slot; memeriksa jadwal mingguan, durasi total rombongan, istirahat, penutupan, booking aktif, dan waktu lewat. |
| `create_booking(mitra_id, layanan_id, tanggal, jam, nama, telepon, jumlah_orang)` | Versi final pembuatan booking; memvalidasi input, mengunci mitra untuk mencegah double booking serentak, memeriksa ulang seluruh rentang, lalu menyimpan kode/status/jumlah/durasi. |
| `tutup_jam(mitra_id, tanggal, mulai, selesai)` | Versi final penutupan slot; memastikan pemilik berhak, rentang mengikuti interval 30 menit dalam jam buka, dan tidak ada booking aktif yang bertabrakan. |
| `buka_jam(mitra_id, tanggal, mulai, selesai)` | Versi final membuka slot untuk pemilik; menghapus penutupan yang waktunya beririsan dengan rentang yang diminta. |

Fungsi keamanan sensitif menggunakan `security definer` dengan `search_path`
yang dibatasi, lalu hak eksekusinya dicabut/diberikan ke role yang diperlukan.
`anon` hanya mendapat RPC yang dibutuhkan halaman pelanggan, sedangkan aksi
admin dan mitra dibatasi untuk `authenticated` dan pemeriksaan peran/kepemilikan.

### `supabase/platform-contact.sql`

File ini mengelola kontak WhatsApp platform dan melengkapi fungsi admin:

| Fungsi | Tujuan |
|---|---|
| `admin_list_mitra()` | Versi yang menambahkan nomor WhatsApp usaha ke hasil daftar admin. |
| `admin_update_mitra_whatsapp(mitra_id, phone)` | Hanya admin platform yang dapat mengubah nomor usaha; memvalidasi 10–15 digit dan memastikan mitra ada. |
| `get_platform_contact_whatsapp()` | Mengembalikan nomor admin hanya untuk admin atau pemilik mitra yang sedang login. |
| `set_platform_contact_whatsapp(phone)` | Hanya admin yang dapat mengatur nomor admin; memvalidasi format lalu insert/update pengaturan tunggal. |

### `supabase/security-hardening.sql`

| Fungsi | Tujuan |
|---|---|
| `get_mitra_public_contact(slug)` | RPC baca-saja untuk mengambil nomor usaha aktif berdasarkan slug. Ini memungkinkan halaman booking menghubungi usaha tanpa memberi akses langsung publik ke kolom telepon. |

### Migrasi dan SQL pendukung tanpa fungsi aplikasi

- `dashboard-realtime.sql` menambahkan `dibuat_pada` bila belum ada dan
  mendaftarkan tabel yang diperlukan ke publication Realtime.
- `register-platform-admin.sql` menjalankan blok migrasi untuk menghubungkan
  satu akun Auth dengan tabel `platform_admins`, lalu menampilkan hasil
  pemeriksaan. Email pada file harus disesuaikan dengan akun admin proyek.
- `clear-demo-data.sql` adalah perintah penghapusan opsional berdasarkan slug;
  jangan dijalankan tanpa meninjau daftar slug yang ditargetkan.

## 8. Keamanan dan batasan prototipe

### Hal yang sudah dilakukan

- Semua query Supabase dari halaman diarahkan lewat `js/api.js`.
- Browser menggunakan Publishable key; jangan pernah memasukkan Secret key,
  service-role key, atau password database ke file frontend.
- RLS dan grants membatasi pembacaan/pengubahan berdasarkan role dan pemilik.
- Nomor publik mitra tidak dibaca langsung oleh user anonim setelah
  `security-hardening.sql`; halaman booking memakai RPC khusus.
- `create_booking()` mengulang validasi dan pemeriksaan slot di database serta
  mengunci baris mitra sebelum menyimpan untuk mencegah double booking.
- Nilai dinamis yang dimasukkan ke HTML umumnya melewati `escapeHtml()`.
- Login menggunakan Supabase Auth, bukan password buatan sendiri di browser.
- Script aplikasi tidak membaca/menulis `localStorage` secara langsung.
  Persistensi sesi Auth dikelola oleh Supabase client.

### Batas prototipe

- Booking pelanggan publik belum memakai CAPTCHA, rate limiting, atau
  verifikasi nomor HP.
- Tidak ada pembayaran online, refund, notifikasi otomatis, atau pengiriman
  WhatsApp di latar belakang.
- Status booking perlu ditindaklanjuti oleh mitra.
- Booking rombongan hanya memakai satu layanan dan dilakukan berurutan, bukan
  paralel oleh beberapa pekerja.
- Keamanan akhir juga bergantung pada migrasi yang benar-benar sudah dijalankan
  pada Supabase dan kebijakan yang aktif di proyek itu.
- Nomor usaha yang ditampilkan sebagai kontak memang bisa diketahui pelanggan;
  RPC hanya menghindari akses langsung ke seluruh tabel mitra.

## 9. Istilah penting

| Istilah | Arti dalam proyek |
|---|---|
| **Slug** | Potongan URL yang mudah dibaca, dipakai untuk menemukan halaman usaha. |
| **UUID / `mitra_id`** | ID database yang menghubungkan mitra dengan layanan, jadwal, booking, dan penutupan. |
| **RLS** | Row Level Security; aturan PostgreSQL untuk menentukan row mana yang dapat dibaca/diubah oleh role tertentu. |
| **RPC** | Pemanggilan fungsi PostgreSQL melalui Supabase, misalnya `create_booking()`. |
| **Publishable key** | Kunci client-side Supabase. Aman untuk berada di browser jika RLS/grants benar; bukan pengganti kebijakan akses. |
| **Realtime** | Langganan event perubahan database agar dashboard dapat memuat ulang informasi. |
| **IIFE** | Fungsi yang langsung dieksekusi saat file dimuat; dipakai untuk membungkus scope script klasik. |
| **Debounce** | Menunggu jeda sebelum menjalankan refresh, sehingga banyak perubahan cepat tidak memicu permintaan berulang. |
| **Callback** | Fungsi yang diberikan ke event listener atau fungsi lain untuk dijalankan kemudian. |

## 10. Cara belajar dan menelusuri masalah

Urutan belajar yang disarankan:

1. Baca halaman `index.html`, `booking.html`, dan
   `mitra/dashboard.html` untuk memahami elemen UI dan ID yang dipakai JavaScript.
2. Baca file JS khusus halaman untuk melihat interaksi pengguna.
3. Setiap kali menemukan `api.<nama>()`, cari metode tersebut di `js/api.js`.
4. Jika metode API memanggil `.rpc("<nama>")`, cari fungsi SQL bernama sama di
   `supabase/*.sql`.
5. Jika data tidak terlihat, periksa urutan script, koneksi jaringan,
   error console, hak RLS/grants, policy, dan apakah migrasi yang diperlukan
   sudah dijalankan pada proyek Supabase yang benar.
6. Jika dashboard Realtime tidak berubah, periksa status koneksi dan
   `supabase/dashboard-realtime.sql`.
7. Jika halaman booking tidak menemukan usaha, pastikan slug di URL sama
   persis dengan `mitra.slug` dan usaha berstatus aktif.

Contoh menelusuri nama usaha:

```text
booking.html?mitra=barber-jamal
  -> booking.js membaca "barber-jamal"
  -> api.getMitraBySlug(slug)
  -> tabel mitra memberi profil dan mitra.id
  -> api.listLayanan(mitra.id), api.getJadwalMingguan(mitra.id)
  -> api.getSlotTersedia(...) saat pelanggan memilih layanan/tanggal
  -> api.buatBooking(...) saat pelanggan mengonfirmasi
  -> RPC create_booking(...) memvalidasi dan menyimpan di PostgreSQL
```

Untuk pemeriksaan sintaks JavaScript tanpa build:

```powershell
Get-ChildItem js -Filter *.js | ForEach-Object { node --check $_.FullName }
```

`node --check` hanya memeriksa sintaks; ia tidak membuktikan koneksi Supabase,
RLS, fungsi SQL, atau keseluruhan alur UI sudah benar. Uji alur tersebut di
browser dengan proyek Supabase yang dikonfigurasi.

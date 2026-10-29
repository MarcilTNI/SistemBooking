# Penjelasan Sistem Booking Usaha Lokal

## 1. Gambaran umum

**BookingYukk!** adalah prototipe web untuk membantu usaha jasa lokal menerima dan mengelola janji temu secara online. Contoh usaha yang dapat menggunakannya adalah barbershop, salon, laundry, dan bengkel.

Setiap usaha memiliki halaman booking sendiri yang dapat dibagikan sebagai tautan. Pelanggan membuka tautan tersebut, memilih layanan, tanggal dan waktu, lalu mengirim permintaan booking tanpa membuat akun. Pemilik usaha masuk ke dashboard untuk memeriksa booking, mengubah statusnya, mengatur layanan, serta menyesuaikan jadwal.

Identitas di bagian logo header mengikuti konteks halaman: halaman admin menampilkan **Admin**, dashboard mitra menampilkan nama usaha pemilik yang sedang masuk, dan halaman pelanggan menampilkan nama usaha pada link booking tersebut. Nama platform **BookingYukk!** tetap ditampilkan pada halaman utama dan sebagai identitas layanan di bagian footer/metadata.

Tujuan sistem ini adalah membuat informasi layanan dan ketersediaan jadwal lebih mudah diakses, mengurangi pemesanan yang hanya dilakukan melalui percakapan manual, serta memberi mitra tempat terpusat untuk mengelola booking.

## 2. Siapa yang menggunakan sistem?

Sistem memiliki tiga area penggunaan. Dua area pertama digunakan untuk mengelola data; pelanggan menggunakan halaman booking publik, bukan dashboard login.

### A. Pengelola platform

Pengelola platform adalah pihak yang mengoperasikan BookingYukk!, bukan pemilik usaha mitra. Pengelola masuk melalui `/admin/index.html` untuk:

- mendaftarkan usaha baru dan menghubungkannya dengan akun pemilik;
- mengisi nama, kategori, alamat, tautan khusus, dan nomor WhatsApp usaha;
- mengatur jam operasional awal dan menambahkan layanan awal;
- melihat usaha yang sudah terdaftar dan memperbarui nomor WhatsApp usaha;
- mengatur nomor WhatsApp pengelola yang digunakan mitra untuk meminta bantuan.

Nomor WhatsApp pengelola berbeda dari nomor WhatsApp usaha. Pelanggan diarahkan ke nomor usaha, sedangkan pemilik mitra yang sudah login dapat menggunakan tombol kontak pengelola di dashboard.

### B. Pemilik usaha atau mitra

Pemilik masuk melalui `/mitra/login.html` menggunakan akun yang terdaftar di Supabase Auth dan sudah dihubungkan dengan data usahanya. Di `/mitra/dashboard.html`, pemilik dapat:

- melihat booking pada tanggal yang dipilih dan memfilter status;
- menerima atau membatalkan booking;
- menghubungi pelanggan melalui WhatsApp;
- melihat jadwal harian serta menutup atau membuka waktu tertentu;
- mengatur jam buka dan waktu istirahat untuk setiap hari dalam seminggu;
- menambah, mengubah, dan menghapus layanan;
- membuka halaman booking publik usahanya dan menghubungi pengelola platform.

### C. Pelanggan

Pelanggan tidak perlu membuat akun. Pelanggan membuka link booking usaha yang dibagikan, misalnya `booking.html?mitra=barber-jamal`, lalu:

1. melihat profil usaha, alamat, dan jam operasional;
2. memilih layanan;
3. memilih jumlah orang, tanggal, dan slot waktu yang tersedia;
4. mengisi nama serta nomor HP/WhatsApp;
5. meninjau ringkasan dan mengonfirmasi booking;
6. mendapatkan kode booking dan dapat menghubungi usaha melalui WhatsApp.

Halaman booking juga memiliki tombol WhatsApp mitra di bagian atas. Sebelum booking dibuat, tombol membuka pesan umum. Setelah booking berhasil, pesan WhatsApp berisi detail booking dan kode booking. WhatsApp hanya dibuka dengan pesan yang sudah disiapkan; pelanggan tetap menekan tombol **Kirim** di aplikasi WhatsApp.

## 3. Cara kerja tautan dan data usaha

Setiap mitra memiliki `slug` yang unik, yaitu bagian singkat pada tautan yang mengidentifikasi usaha. Contohnya:

```text
booking.html?mitra=barber-jamal
```

Saat halaman dibuka, aplikasi membaca nilai `mitra` pada alamat tersebut dan meminta data usaha berdasarkan slug. Karena itu, link Barber Jamal langsung menampilkan Barber Jamal, bukan halaman booking gabungan beberapa usaha.

Halaman utama tetap dapat menampilkan direktori semua usaha aktif. Direktori tersebut membantu pelanggan menemukan usaha, sedangkan mitra dapat membagikan link langsungnya sendiri.

## 4. Mekanisme jadwal dan booking

### Slot waktu

- Slot dibuat dari jam operasional usaha dalam interval 30 menit.
- Waktu yang bertabrakan dengan booking aktif, jam istirahat, atau penutupan khusus ditandai tidak tersedia.
- Slot yang waktu mulainya sudah lewat tidak dapat dipilih.
- Pelanggan dapat memesan untuk hari ini atau memilih tanggal dalam 13 hari berikutnya.
- Saat pelanggan mengonfirmasi, fungsi database memeriksa kembali jadwal dan ketersediaan. Jika slot sudah diambil pelanggan lain, booking ditolak dan pelanggan diminta memilih waktu lain.

### Status booking

Booking yang baru dibuat berstatus **Menunggu**. Mitra dapat mengubahnya menjadi **Diterima** atau **Dibatalkan**. Booking berstatus Dibatalkan tidak lagi menghalangi pemesanan pada rentang waktu yang sama, kecuali waktu tersebut sudah lewat, ditutup, atau bertabrakan dengan booking aktif lain.

### Booking rombongan

Booking rombongan saat ini berarti beberapa orang memesan layanan yang sama dan dilayani **satu per satu secara berurutan oleh satu barber/kursi**. Sistem menghitung total durasi sebagai durasi layanan per orang dikalikan jumlah orang. Jumlah yang dapat dipilih adalah 1 sampai 12 orang.

Contoh: bila satu layanan berdurasi 30 menit, dua orang memerlukan rentang 60 menit. Maka suatu waktu mulai hanya tersedia bila seluruh rentang itu masih kosong, termasuk tidak melewati jam istirahat atau waktu tutup. Sistem ini belum membagi anggota rombongan ke beberapa barber atau kursi untuk dilayani secara bersamaan.

Satu booking rombongan disimpan sebagai satu catatan dengan jumlah orang dan rentang waktu keseluruhan. Perkiraan total harga juga dihitung dari harga layanan per orang dikalikan jumlah orang.

## 5. Peran WhatsApp

Sistem menggunakan dua jenis nomor dengan tujuan berbeda:

- **WhatsApp usaha/mitra**: nomor publik usaha. Pelanggan menggunakannya untuk bertanya atau mengirim detail booking dan kode booking.
- **WhatsApp pengelola platform**: nomor bantuan untuk pemilik mitra yang masuk ke dashboard. Nomor ini tidak ditampilkan sebagai kontak pelanggan.

Nomor usaha diisi saat usaha didaftarkan dan dapat diperbarui pada daftar usaha di halaman admin. Nomor WhatsApp pengelola diatur di bagian kontak pengelola pada halaman admin.

WhatsApp di sini berfungsi sebagai sarana komunikasi lanjutan, bukan sebagai sistem pengiriman pesan otomatis. Sistem tidak mengirim pesan WhatsApp di latar belakang.

## 6. Teknologi yang digunakan

- **HTML** menyusun halaman, form, tabel/kartu, serta elemen navigasi.
- **CSS** mengatur tampilan responsif untuk ponsel dan desktop.
- **JavaScript vanilla** mengatur interaksi halaman, validasi sederhana, pemuatan data, dan pengiriman permintaan booking. Script dimuat sebagai script klasik; antarmuka tidak menggunakan React atau framework frontend.
- **Supabase JavaScript client** dimuat dari CDN untuk menghubungkan frontend dengan proyek Supabase.
- **Supabase Auth** mengelola login admin dan mitra.
- **Supabase PostgreSQL** menyimpan data usaha, layanan, jadwal, booking, penutupan jadwal, dan pengaturan platform.
- **Row Level Security (RLS), grants, dan fungsi database/RPC** digunakan untuk membatasi operasi berdasarkan peran serta memeriksa dan menyimpan booking di database.

Lapisan akses data frontend berada di `js/api.js`, sehingga halaman menggunakan fungsi API yang sama untuk membaca atau mengubah data Supabase. Kode browser menggunakan **Publishable key**. Secret key atau `service_role` tidak boleh dimasukkan ke file frontend.

## 7. Data utama yang dikelola

Secara konsep, data sistem terbagi menjadi:

- **Mitra/usaha**: nama, slug, kategori, alamat, nomor WhatsApp usaha, jam dasar, dan akun pemilik yang terhubung.
- **Layanan**: nama, durasi, dan harga untuk suatu mitra.
- **Jadwal mingguan**: hari buka, jam mulai, jam selesai, serta rentang istirahat.
- **Booking**: kode, mitra, layanan, tanggal, rentang waktu, data pemesan, jumlah orang, dan status.
- **Penutupan jadwal**: rentang waktu tertentu pada tanggal tertentu yang tidak menerima booking.
- **Pengaturan platform**: nomor WhatsApp pengelola dan daftar akun yang berperan sebagai admin platform.

Setiap booking terhubung ke mitra dan layanan tertentu. Dengan demikian, dashboard mitra mengambil booking milik usahanya dan halaman booking publik menampilkan layanan serta slot untuk mitra pada link tersebut.

## 8. Pengelolaan akun dan setup

Akun pemilik tidak dibuat melalui form pendaftaran publik di website. Untuk prototipe ini, akun admin dan akun pemilik dibuat terlebih dahulu di **Supabase Authentication**. Akun admin kemudian diberi peran admin platform, sedangkan saat pendaftaran usaha, email pemilik digunakan untuk menghubungkan akun pemilik dengan data mitra.

Supabase harus dikonfigurasi terlebih dahulu dan skrip SQL migrasi terkait harus berhasil dijalankan. Khusus fitur kontak WhatsApp admin dan pengubahan nomor WhatsApp usaha yang sudah terdaftar, migrasi `supabase/platform-contact.sql` juga harus sudah dijalankan. Menjalankan file SQL di repository tidak otomatis mengubah database; SQL tersebut harus dijalankan di SQL Editor proyek Supabase yang digunakan.

Untuk pengujian lokal, halaman dapat dijalankan melalui Live Server. Karena aplikasi mengakses Supabase dan memuat client dari CDN, browser memerlukan koneksi internet serta URL dan Publishable key proyek yang benar.

## 9. Batasan prototipe dan pengembangan selanjutnya

Sistem ini merupakan prototipe fungsional untuk mendemonstrasikan alur booking usaha lokal, bukan platform produksi yang sudah diaudit sepenuhnya. Batasan saat ini:

- booking publik tidak memerlukan login, jadi perlindungan terhadap spam atau booking palsu masih perlu ditambahkan;
- belum ada CAPTCHA, pembatasan frekuensi permintaan, verifikasi nomor HP, atau konfirmasi booking otomatis;
- status awal booking adalah Menunggu dan mitra menindaklanjutinya dari dashboard atau melalui WhatsApp;
- belum tersedia pembayaran online, refund, notifikasi otomatis, atau sinkronisasi kalender eksternal;
- booking rombongan dilayani berurutan oleh satu barber/kursi, bukan secara paralel;
- akun pemilik dibuat dan dikelola secara manual melalui Supabase Auth;
- sebelum dipakai secara luas, konfigurasi RLS dan grants harus diuji di proyek Supabase, dan database perlu backup serta prosedur pemulihan.

## 10. Ringkasan untuk presentasi

> BookingYukk! adalah prototipe sistem booking online untuk usaha jasa lokal. Setiap mitra mempunyai link booking khusus yang dapat dibagikan kepada pelanggan. Pelanggan dapat melihat layanan dan jadwal yang tersedia, memilih waktu, lalu memesan tanpa login. Pemilik usaha mengelola booking, layanan, dan jadwal melalui dashboard mitra, sedangkan pengelola platform mendaftarkan usaha dan menghubungkan akun pemilik melalui dashboard admin. Sistem dibuat menggunakan HTML, CSS, dan JavaScript vanilla dengan Supabase sebagai layanan autentikasi dan database PostgreSQL. Pemeriksaan ketersediaan dilakukan kembali di database saat booking disimpan, dan WhatsApp digunakan untuk komunikasi lanjutan antara pelanggan dengan mitra maupun mitra dengan pengelola platform.

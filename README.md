# BookingYukk! — prototipe booking usaha lokal

Frontend HTML, CSS, dan JavaScript vanilla yang memakai Supabase untuk data mitra, layanan, booking, autentikasi, dan jadwal mingguan.

## Menjalankan

- Buka folder di VS Code dan jalankan `index.html` dengan Live Server.
- Browser harus terhubung ke internet untuk memuat Supabase JS dari CDN dan mengakses proyek Supabase.
- Hindari membuka melalui `file://`; origin Live Server lebih konsisten untuk Supabase Auth.

## Gaya JavaScript

Skrip aplikasi tetap memakai `<script>` klasik tanpa ES modules atau build tool. Gunakan `const` untuk binding yang tidak ditugaskan ulang, `let` untuk state yang berubah, dan arrow function untuk callback atau fungsi inline. Deklarasi fungsi bernama tetap digunakan pada helper yang perlu hoisting, sehingga dapat dipanggil sebelum lokasi definisinya.

## Penyiapan database dan akun

Urutan ini mengasumsikan tabel dasar sudah dibuat dari setup sebelumnya.

- Jalankan `supabase/tenant-scheduling.sql` di SQL Editor untuk menambahkan admin platform, jadwal per hari, dan pemesanan rombongan.
- Jalankan `supabase/platform-contact.sql` setelahnya. Masuk ke dashboard admin untuk mengisi nomor WhatsApp admin platform dan mengelola nomor WhatsApp tiap mitra. Nomor dukungan tidak disimpan di source code; hanya admin platform yang bisa mengubahnya.
- Jalankan `supabase/dashboard-realtime.sql` setelah migrasi jadwal dan kontak. Migrasi ini menambahkan waktu permintaan booking dan mengaktifkan Supabase Realtime untuk booking, layanan, serta jadwal; dashboard mitra menampilkan status koneksi jika Realtime belum aktif.
- Jalankan `supabase/security-hardening.sql` setelah migrasi akses, jadwal, dan kontak. Migrasi ini mencabut akses baca langsung publik ke nomor mitra; halaman booking mengambil nomor WhatsApp usaha aktif melalui RPC khusus. Jalankan lagi migrasi ini jika kemudian menjalankan ulang `booking-access.sql` atau `tenant-scheduling.sql`.
- Untuk mitra lama, migrasi mengisi jadwal awal dari jam operasional sebelumnya ke setiap hari. Periksa dan sesuaikan jadwal mingguan di dashboard sebelum membagikan link.
- Buat user Supabase Auth khusus admin platform di **Authentication → Users**.
- Ganti `ADMIN_EMAIL_HERE` pada `supabase/register-platform-admin.sql` dengan email admin, kemudian jalankan SQL itu di SQL Editor.
- Untuk mulai tanpa usaha contoh, tinjau `supabase/clear-demo-data.sql` dan jalankan jika memang ingin menghapus tiga mitra contoh beserta data terkait. Akun Auth demo yang tersisa tidak otomatis terhapus.
- Setiap pemilik baru perlu akun lebih dulu di **Authentication → Users**. Setelah itu admin dapat membuat data usaha di `admin/index.html` dan menghubungkan akun melalui email.
- Atur Project URL dan Publishable key di `js/supabase-client.js`. Publishable key boleh digunakan di frontend; jangan pernah menaruh Secret/service_role key atau password database di kode.

## Peran dan alur mitra

- `/admin/index.html` — pengelola platform masuk dengan akun admin terpisah dan mendaftarkan usaha, layanan, jadwal mingguan, serta email pemilik yang sudah ada di Supabase Auth.
- Nomor WhatsApp usaha di formulir admin dipakai pelanggan untuk menghubungi mitra setelah booking. Nomor mitra yang sudah terdaftar juga dapat diperbarui dari daftar usaha.
- Nomor WhatsApp usaha adalah kontak publik yang memang ditujukan untuk pelanggan. Akses langsung ke kolom tabel ditutup untuk pengguna anonim, tetapi nomor yang dibutuhkan pada halaman booking tidak dapat dianggap rahasia dari pengunjung halaman.
- `/booking.html?mitra=slug` — link yang dibagikan langsung membuka satu usaha, bukan direktori usaha lain.
- Pelanggan dapat memilih hari ini atau 13 hari berikutnya; slot hari ini yang waktu mulainya sudah lewat tidak dapat dipesan.
- Halaman booking menampilkan jam mingguan dalam kartu, form pelanggan, serta struk estimasi yang diperbarui saat pilihan berubah. Pada layar kecil, tombol bawah mengarahkan ke struk.
- `/mitra/login.html` — pemilik masuk dengan akun Supabase Auth yang terhubung ke mitranya.
- Dashboard mitra memiliki tab Dashboard, Manajemen Booking, Jadwal Harian, Pelanggan, dan Layanan & harga. Ringkasan, tren/status booking, daftar pelanggan, jadwal, dan layanan diperbarui melalui Supabase Realtime.
- Estimasi pendapatan hari ini hanya menghitung booking berstatus diterima, berdasarkan harga layanan saat ini dikalikan jumlah orang. Nilainya adalah perkiraan, bukan laporan pembayaran; perubahan harga layanan dapat memengaruhi estimasi.
- Dashboard mitra mengatur status booking, filter/cari booking, pengecualian jadwal per tanggal, layanan, jam buka per hari, dan istirahat.
- Dashboard mitra memiliki tombol WhatsApp untuk menghubungi pengelola platform; nomor bantuan hanya tersedia untuk pengguna admin dan pemilik mitra yang sudah login.
- Booking rombongan memakai satu layanan yang sama dan dikerjakan berurutan oleh satu barber/kursi. Maksimal 12 orang dalam satu pemesanan.
- Booking yang dibatalkan tidak lagi memblokir slot; slot kembali tersedia kecuali waktunya sudah lewat atau ditutup.

## Struktur file

- `index.html` — beranda pelanggan dengan panduan booking, pencarian/filter mitra, contoh testimoni berlabel ilustrasi, dan footer.
- `booking.html` — pemilihan layanan, tanggal, slot, dan pemesanan.
- `mitra/login.html` — login menggunakan Supabase Auth.
- `mitra/dashboard.html` — booking, jadwal, serta pengelolaan layanan.
- `admin/index.html` — pengelola platform untuk pendaftaran mitra.
- `css/` — gaya umum, booking, dan dashboard.
- `js/supabase-client.js` — inisialisasi Supabase client dengan URL dan Publishable key.
- `js/api.js` — lapisan akses data tunggal untuk seluruh halaman.
- `js/utils.js` — format tampilan dan utilitas UI.
- `js/booking.js`, `js/login.js`, `js/dashboard.js`, `js/landing.js` — interaksi tiap halaman.
- `css/landing.css` — tata letak, navigasi, direktori mitra, dan bagian khusus beranda.
- `js/admin.js` — pendaftaran mitra platform.
- `supabase/booking-access.sql`, `supabase/tenant-scheduling.sql`, `supabase/platform-contact.sql`, `supabase/dashboard-realtime.sql`, `supabase/security-hardening.sql` — kebijakan akses, fungsi database, pengaturan kontak WhatsApp, Realtime dashboard, dan pembatasan data kontak mitra.
- `supabase/register-platform-admin.sql` — memberi peran admin kepada akun Auth platform.
- `supabase/clear-demo-data.sql` — penghapusan opsional data mitra contoh.

## Batas prototipe

Pembuatan akun pemilik sengaja dilakukan manual dari Supabase Auth; browser tidak mendapat akses admin/secret key. RPC `create_booking` mengunci baris mitra saat memeriksa ketersediaan dan menyimpan booking. Sebelum dipakai untuk pelanggan sungguhan, tambahkan proteksi spam/rate limit, verifikasi kontak bila diperlukan, serta pengujian RLS dan backup database.

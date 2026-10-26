# KerjaKolektif

Aplikasi operasional untuk CRM, invoice, finance, HR, absensi, dan payroll.

## Jalankan lokal

Butuh **Node.js 22.13+**.

1. Install dependency: `npm install`
2. Atur password awal yang kuat di PowerShell:

   ```powershell
   $env:ADMIN_PASSWORD = "ganti-dengan-password-kuat-minimal-16-karakter"
   ```

3. Jalankan `npm start`, lalu buka http://localhost:3000.
4. Login dengan username `admin` dan password yang diatur. Ganti password melalui Audit Log setelah login.

Password awal hanya digunakan ketika database SQLite belum memiliki pengguna. Tidak ada lagi password bawaan. Untuk database yang sudah ada, password akun yang tersimpan tetap berlaku.

Data lokal disimpan di `data/app.db` dan foto bukti absensi di `data/attendance-proofs`. Cadangkan keduanya bersama-sama. Folder `data/` sengaja dikecualikan dari Git dan Vercel.

## Struktur kode

- `public/index.html`: struktur halaman.
- `public/css/app.css`: stylesheet.
- `public/js/app.js`: kerangka aplikasi dan navigasi.
- `public/js/auth.js`: autentikasi browser.
- `public/js/features/`: fitur Dashboard, CRM, invoice, operasional, finance, laporan, dan HR.
- `server.js`: server lokal berbasis SQLite.
- `api/`: endpoint Vercel, autentikasi dan sesi Postgres, serta bundle browser.
- `scripts/migrate-sqlite-to-neon.js`: migrasi data lokal ke Neon dan Blob privat.

File JavaScript browser digabungkan ketika `/js/app.js` diminta, agar variabel dan urutan fitur tetap kompatibel dengan aplikasi saat ini.

## Deploy ke Vercel

Deployment memakai **Neon Postgres** untuk state aplikasi, akun, sesi, dan audit log baru, serta **Vercel Blob Private Store** untuk bukti foto absensi. State bisnis saat ini dipertahankan sebagai satu kolom JSONB supaya UI dan API lama tetap kompatibel; akun/sesi/audit berada di tabel terpisah. Jangan gunakan Blob publik untuk foto absensi.

1. Buat database Neon, lalu hubungkan ke project Vercel melalui Marketplace atau siapkan `DATABASE_URL`.
2. Buat **private** Vercel Blob store dan hubungkan ke project. Atur `DATABASE_URL`, `ADMIN_USERNAME` (opsional, default `admin`), dan `ADMIN_PASSWORD` (minimal 16 karakter) di Environment Variables Vercel. Jangan kirim atau commit nilai rahasia.
3. Push kode ke repository, import repository tersebut di Vercel, dan gunakan root directory `kerjakolektif` jika repository berisi folder pembungkus. Framework preset `Other`; output directory `public`.
4. Deploy. API akan membuat tabel secara otomatis pada pemanggilan pertama. Jika database belum memiliki akun, `ADMIN_PASSWORD` dipakai hanya untuk membuat akun awal.
5. Untuk memindahkan data lokal, siapkan `.env.local` berisi `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN` dari private Blob store, `ADMIN_USERNAME`, dan `ADMIN_PASSWORD`. File ini di-ignore oleh Git. Jalankan:

   ```powershell
   npm run migrate:vercel
   ```

   Periksa pesan hasilnya sebelum membuka aplikasi. Script memindahkan payload state dan foto bukti yang ditemukan. Ia tidak memindahkan hash akun maupun audit log lokal (yang berisi IP); akun cloud baru dibuat dari environment variables. Jika Neon sudah memiliki payload yang berbeda, migrasi berhenti tanpa menimpanya. `npm run migrate:vercel -- --force` mengganti payload cloud dengan data lokal; pakai hanya setelah membuat backup.

6. Setelah migrasi, uji login, data dashboard/HR, dan foto bukti absensi. Ubah password awal setelah login.

Environment variables dan secret hanya diatur lewat dashboard Vercel atau file lokal yang di-ignore. Database lokal dan bukti foto tidak boleh masuk repository publik. Repo publik berisi source code saja; jangan push sebelum memastikan tidak ada data/secrets lain di dalamnya.

## Absensi dan payroll

Dashboard menampilkan absensi tim hari ini. Catatan absensi memerlukan foto bukti; gambar dikompres ke JPEG maksimal 500 KB. Foto privat tidak tersedia sebagai URL publik dan hanya dapat dibaca lewat endpoint aplikasi setelah autentikasi.

Payroll dibuat sebagai draft per periode. Karyawan menerima gaji bulanan dikurangi potongan alpha (gaji bulanan dibagi 22 hari kerja), ditambah lembur (gaji bulanan dibagi 173 jam, dikali 1,5). Freelancer dibayar dari hari hadir/terlambat dikali tarif harian, ditambah lembur (tarif harian dibagi 8 jam, dikali 1,5). Payroll adalah snapshot; perubahan absensi/gaji setelah dibuat tidak mengubah draft yang sudah ada. Saat ditandai dibayar, biaya payroll otomatis masuk ke Finance sebagai pengeluaran gaji. Ekspor payroll tersedia dalam format sheet.

## Keamanan

Password di-hash dengan scrypt, sesi disimpan di Postgres, cookie HttpOnly/SameSite, request perubahan dilindungi token CSRF dan pemeriksaan Origin. Bukti absensi menggunakan private Blob dan proxy autentikasi. Lihat `PENTEST.md` untuk pengujian keamanan endpoint foto.

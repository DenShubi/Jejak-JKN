# Panduan Demo JEJAK JKN

Demo berisi **40 episode sintetis** untuk memeriksa kesesuaian tagihan sesi fisioterapi dengan catatan layanan RME. Mesin menjalankan aturan deterministik (`JEJAK-RULES-0.1.0`) secara nyata pada data buatan. Demo tidak terhubung ke BPJS Kesehatan atau RME produksi. Riwayat dan perubahan hanya bertahan selama halaman dibuka; muat ulang halaman atau klik tombol **Ulangi Demo** mengembalikan keadaan awal.

## Membuka Demo (Online & Offline)

1. **Versi Web (GitHub Pages)**: Buka tautan repositori GitHub Pages yang disertakan pada pengumpulan karya. Seluruh pemrosesan tetap berjalan di sisi klien (browser) tanpa ketergantungan layanan backend eksternal.
2. **Versi Mandiri Tanpa Internet (Offline)**: Buka berkas **`JEJAK-JKN-Demo-Offline.html`** langsung di Google Chrome, Microsoft Edge, atau Mozilla Firefox. Berkas tunggal ini telah memuat seluruh tampilan, data generator, diagram SVG, dan mesin aturan tanpa memerlukan koneksi internet maupun instalasi.
3. **Menjalankan Proyek Vite Secara Lokal (Opsional untuk Pengembang)**:
   ```bash
   npm install
   npm run dev     # Menjalankan server pengembangan lokal
   npm test        # Menjalankan 18 pengujian otomatis (termasuk 16 uji fungsi JEJAK-RULES-0.1.0)
   npm run build   # Membangun dist/ (GitHub Pages) sekaligus memperbarui JEJAK-JKN-Demo-Offline.html
   ```

## Fitur Utama Dashboard

- **Mode Presentasi Juri (4 Menit)**: Klik tombol **▶ Panduan Presentasi (4 Menit)** di bilah navigasi atas untuk menampilkan pemandu 7 langkah sesuai alur presentasi (navigasi cepat dengan tombol `← Sebelumnya` / `Berikutnya →` atau pintasan `Alt + Panah Kiri/Kanan`).
- **Inspeksi Sesi & RME Berdampingan**: Klik kotak **Sesi 1 s.d. Sesi 12** pada matriks jejak sesi (atau baris pada tabel daftar bukti) untuk membandingkan baris tagihan (`Claim / ChargeItem`) dengan catatan klinis (`RME / Procedure`), lengkap dengan jeda waktu penerimaan (`created_at` vs `received_at`) dan pemisahan **`template_text` (dikecualikan R2)** dari **`patient_specific_text` (diperiksa R2 ≥60 karakter)**.
- **Analitik Faskes & Portofolio**: Tab ringkasan eksekutif untuk meninjau cakupan sesi aktif, perbandingan antar tiga rumah sakit simulasi (`RS Simulasi Aruna`, `RS Simulasi Bima`, `RS Simulasi Cakra`), peta sinyal aturan (`R0`, `R1`, `R2`, pembatalan `v2`), serta diagram alur arsitektur target & standar SATUSEHAT FHIR.
- **Tiket Klarifikasi Faskes (Siap Cetak / Salin)**: Klik **Tiket Klarifikasi Faskes** pada episode mana pun untuk menampilkan pratinjau lembar permintaan pelengkapan data (`R0`) atau klarifikasi bukti sesi (`R1/R2`) berbahasa netral sesuai tata kelola Permenkes No. 16 Tahun 2019 dan UU PDP No. 27 Tahun 2022.

## Alur Presentasi Sekitar 4 Menit

| Waktu | Tindakan | Pesan yang Disampaikan |
|---|---|---|
| 0:00 sampai 0:30 | Tampilkan ringkasan awal / tab Analitik | “Kami memeriksa 40 episode buatan. Empat belas membutuhkan klarifikasi, enam membutuhkan pelengkapan data, dan dua puluh memiliki bukti konsisten.” |
| 0:30 sampai 1:10 | Buka `EP-002` & klik `Sesi 9` | “Episode ini memiliki 12 sesi tagihan aktif dan delapan catatan cocok. Sesi 9 sampai 12 perlu ditelusuri. Sistem menunjukkan ID sumber dan alasan R1; petugas masih harus memeriksa penjelasannya.” |
| 1:10 sampai 1:50 | Buka `EP-001` lalu klik **Sinkronkan 2 catatan terlambat** | “Awalnya sumber belum lengkap, sehingga sistem menahan selisih di gerbang R0 (*Lengkapi data*). Setelah dua catatan masuk dan batch lengkap, bukti cocok menjadi sepuluh. Dua sesi masih perlu klarifikasi.” |
| 1:50 sampai 2:20 | Buka `EP-010` dan sinkronkan dua catatannya | “Di kasus ini semua enam sesi akhirnya memiliki bukti cocok. Status berubah menjadi *Bukti konsisten*. Keterlambatan sumber tidak langsung dianggap kecurangan.” |
| 2:20 sampai 3:00 | Buka `EP-015` (`Sesi 2`) dan hubungan ke `EP-016` | “Jumlah sesi cocok 6 dari 6, tetapi isi personal Sesi 2 identik dengan episode peserta berbeda (`EP-016`). Formulir umum tidak dibandingkan. Kemiripan memicu pertanyaan, bukan vonis.” |
| 3:00 sampai 3:25 | Buka `EP-039` (`Sesi 5`) | “Dua sesi yang dibatalkan resmi (revisi v2 / `not-done`) dikecualikan. Empat sesi aktif memiliki empat bukti cocok.” |
| 3:25 sampai 4:00 | Kembali ke `EP-002`, klik chip contoh tindak lanjut & buka **Tiket Klarifikasi Faskes** | “Verifikator mencatat hasil pemeriksaan, mencetak tiket klarifikasi untuk faskes, atau mengekspor kartu bukti JSON. Hasil manusia terpisah dari sinyal mesin. Penghematan baru diakui setelah keputusan dan realisasi pembayaran.” |

Contoh catatan tindak lanjut untuk latihan (tersedia sebagai tombol isi cepat di formulir):
> **Meminta konfirmasi petugas RME mengenai sesi 9 sampai 12 dan bukti registrasi kunjungan. Referensi demo: CLM-002-S9 sampai CLM-002-S12.**

Gunakan hasil **“Perlu bukti tambahan”**. Jangan memasukkan nama, NIK, atau dokumen pasien nyata.

## Keadaan Awal dan Perubahan yang Diharapkan

| Episode | Awal | Setelah Tindakan |
|---|---|---|
| `EP-002` | 12 sesi aktif, 8 cocok, *Perlu klarifikasi* | Tidak berubah sampai data atau tagihan berubah |
| `EP-001` | 12 sesi aktif, 8 cocok, *Lengkapi data* | Sinkronisasi: 10 cocok, 2 belum cocok, *Perlu klarifikasi* |
| `EP-010` | 6 sesi aktif, 4 cocok, *Lengkapi data* | Sinkronisasi: 6 cocok, *Bukti konsisten* |
| `EP-015` dan `EP-016` | 6 sesi aktif, 6 cocok, isi personal sama | Kedua episode menampilkan sinyal `R2` |
| `EP-039` | 6 sesi awal, 2 dibatalkan, 4 aktif dan cocok | *Bukti konsisten* dengan pembatalan diperhitungkan |

Setelah `EP-001` dan `EP-010` disinkronkan, ringkasan menjadi **15 Perlu klarifikasi, 4 Lengkapi data, dan 21 Bukti konsisten** (total tetap 40). Menyimpan tindak lanjut tidak mengubah kategori aturan agar keputusan manusia tidak menghapus alasan pemeriksaan mesin.

## Berkas Utama dalam Paket

- **`JEJAK-JKN-Demo-Offline.html`**: Aplikasi lengkap satu berkas yang dapat dibuka langsung tanpa internet.
- **`index.html` & `src/`**: Kode sumber aplikasi web modular berbasis Vite untuk hosting GitHub Pages.
- **`JEJAK-JKN-Data-Sintetis.json`**: Dataset 40 episode sintetis (tagihan sesi, catatan RME, pembatalan, dan catatan terlambat).
- **`JEJAK-JKN-Hasil-Uji.json`**: Hasil 16 pengujian deterministik `JEJAK-RULES-0.1.0` dan status validasi antarmuka.
- **`JEJAK-JKN-Panduan-Demo.md`**: Petunjuk penggunaan dan skrip presentasi ini.
- **`JEJAK-JKN-Arsitektur.png`**: Diagram arsitektur target dan gerbang kelengkapan sumber.

## Jawaban Singkat untuk Pertanyaan Juri

**Apa yang membedakan dari pengecekan jumlah sederhana?**
Sistem menautkan sesi ke ID sumber spesifik, memisahkan sumber yang belum lengkap melalui gerbang `R0`, memperhitungkan pembatalan resmi dan versi catatan terbaru (`R1`), serta menemukan kesamaan isi personal lintas episode ketika jumlah sesi justru cocok (`R2`). Nilai tambah terhadap proses mitra yang berjalan tetap perlu diuji pada pilot.

**Apakah tidak ada rekam medis berarti fraud?**
Tidak. Hal tersebut dapat disebabkan data belum terkirim, salah pemetaan identitas, dokumentasi yang belum lengkap, atau ketidaksesuaian yang memang perlu ditelusuri. Sistem meminta pelengkapan data atau klarifikasi, bukan menetapkan vonis fraud.

**Di mana AI yang digunakan?**
Prototipe ini sengaja menggunakan mesin aturan deterministik yang dapat dijelaskan (`JEJAK-RULES-0.1.0`). OCR, kemiripan semantik, atau pemodelan mesin merupakan opsi pengembangan lanjutan hanya setelah tersedia data berlabel yang sah dan bukti manfaat tambahan. Demo tidak mengklaim memakai GNN atau LLM.

**Bagaimana jika seluruh bukti dipalsukan secara konsisten?**
Kecocokan antarsumber dapat tetap terlihat konsisten. Karena itu, pemeriksaan sampel acak, konfirmasi independen, dan audit lapangan oleh pihak berwenang tetap diperlukan.

**Apakah selisih empat sesi otomatis menjadi penghematan rupiah?**
Tidak. Dampak finansial mengikuti keputusan ajudikasi dan realisasi pembayaran resmi. Pada skema pembayaran paket, pengurangan jumlah sesi tidak otomatis mengurangi kas BPJS Kesehatan.

**Apakah prototipe ini sudah siap menerima data pasien asli?**
Belum. Demo memproses data sintetis di browser dan belum menerapkan autentikasi per peran, enkripsi terkelola, serta log audit tahan perubahan. Pemrosesan data nyata hanya boleh dilakukan di lingkungan berizin sesuai UU PDP No. 27 Tahun 2022 dan Permenkes No. 24 Tahun 2022.

# JEJAK JKN — *Setiap Klaim, Ada Jejaknya*

**Sistem Penelusuran Bukti Layanan untuk Deteksi Dini Klaim Fiktif pada Program JKN**  
Disusun oleh Tim **TranspemGo** (*M Sultan Syarief Awang, Ridho Denindra Shobirin Cholil Soenarno, Sultan Rafi*) untuk **BPJS Kesehatan Healthkathon 2026**.

---

## Ringkasan Solusi

**JEJAK JKN** adalah prototipe ruang kerja pemeriksaan bukti sesi layanan berulang (studi kasus awal: **fisioterapi**) yang menghubungkan baris tagihan klaim dengan catatan pelaksanaan tindakan (RME) menggunakan mesin aturan yang dapat dijelaskan (**`JEJAK-RULES-0.1.0`**):

1. **Gerbang `R0` (Kelengkapan Sumber & Identitas)**: Memisahkan keterlambatan pengiriman batch data RME atau kendala pemetaan identitas (*Lengkapi data*) agar kasus sah yang terlambat sinkronisasi tidak langsung ditandai sebagai ketidaksesuaian.
2. **Aturan `R1` (Pencocokan Sesi Aktif)**: Mencocokkan setiap sesi tagihan aktif dengan catatan RME berstatus `completed` pada episode, token peserta, fasilitas, indeks sesi, dan tanggal layanan yang sama—sekaligus mengecualikan sesi yang dibatalkan resmi (`cancelled` / `not-done`) dan mengacu pada versi catatan terbaru.
3. **Sinyal `R2` (Kesamaan Isi Personal Lintas Episode)**: Mendeteksi duplikasi identik pada teks tindak lanjut individual (`patient_specific_text` ≥ 60 karakter ternormalisasi) antar peserta berbeda walaupun jumlah sesi cocok penuh, dengan mengecualikan teks formulir standar (`template_text`).

> **Prinsip Tata Kelola**: Prototipe menggunakan data 100% sintetis (`40` episode), menggunakan bahasa pemeriksaan netral (*Bukti konsisten*, *Perlu klarifikasi*, *Lengkapi data*), **tidak** mengeluarkan skor probabilitas fraud atau mengklaim penggunaan AI yang belum dibangun, **tidak** mengklaim selisih sesi sebagai penghematan rupiah otomatis, dan menyimpan keputusan tindak lanjut verifikator secara terpisah dari sinyal mesin.

---

## Fitur Utama Dashboard

- **Ruang Kerja Verifikator**: Antrean prioritas dengan pencarian & filter multi-kriteria (status, fasilitas kesehatan, sinyal `R0`/`R1`/`R2`, pembatalan, status tinjauan), alur gerbang aturan visual, serta formulir tindak lanjut *human-in-the-loop* dengan templat isi cepat.
- **Inspeksi Sesi & RME Berdampingan**: Klik sesi mana pun (`Sesi 1`–`Sesi 12`) untuk meninjau perbandingan rinci antara baris `Claim / ChargeItem` dan catatan `RME / Procedure`, waktu penerimaan (`created_at` vs `received_at`), serta pemisahan `template_text` vs `patient_specific_text`.
- **Analitik Faskes & Portofolio**: Visualisasi cakupan bukti sesi aktif, perbandingan 3 rumah sakit simulasi (`RS Simulasi Aruna`, `RS Simulasi Bima`, `RS Simulasi Cakra`), peta sinyal aturan interaktif, simulasi sinkronisasi batch terlambat, dan rujukan arsitektur interoperabilitas **SATUSEHAT FHIR** (`Encounter`, `Procedure`, `ChargeItem`, `Claim`, `ClaimResponse`).
- **Panduan Presentasi Juri (4 Menit)**: Pemandu interaktif 7 langkah sesuai alur demo resmi di `JEJAK-JKN-Panduan-Demo.md`.
- **Tiket Klarifikasi Faskes (Cetak / PDF / Salin Teks)**: Pratinjau dokumen permintaan pelengkapan data atau klarifikasi sesi untuk petugas fasilitas kesehatan.

---

## Menjalankan Secara Lokal

Prasyarat: **Node.js ≥ 18** (tanpa ketergantungan layanan eksternal).

```bash
# 1. Instal dependensi pembangun (Vite)
npm install

# 2. Jalankan server pengembangan lokal
npm run dev

# 3. Jalankan 18 pengujian otomatis (16 uji deterministik JEJAK-RULES-0.1.0 + paritas data)
npm test

# 4. Bangun bundel web (dist/) sekaligus perbarui berkas mandiri JEJAK-JKN-Demo-Offline.html
npm run build
```

Untuk penggunaan **tanpa internet sama sekali** dan tanpa server lokal, cukup buka berkas **[`JEJAK-JKN-Demo-Offline.html`](./JEJAK-JKN-Demo-Offline.html)** langsung di Chrome, Edge, atau Firefox.

---

## Cara Hosting ke GitHub Pages

Proyek ini sudah dilengkapi konfigurasi `base: './'` pada `vite.config.js` dan workflow otomatis di `.github/workflows/deploy.yml`:

1. Buat repositori baru di GitHub dan unggah seluruh isi folder proyek ini ke branch `main`:
   ```bash
   git init
   git add .
   git commit -m "feat: finalize JEJAK JKN dashboard for BPJS Healthkathon 2026"
   git branch -M main
   git remote add origin https://github.com/<username>/<repo-name>.git
   git push -u origin main
   ```
2. Buka repositori di GitHub → **Settings** → **Pages**.
3. Pada bagian **Build and deployment** → **Source**, pilih **GitHub Actions**.
4. Workflow **Deploy JEJAK JKN to GitHub Pages** akan otomatis menjalankan 16 pengujian fungsi, membangun `dist/`, dan menayangkan situs di `https://<username>.github.io/<repo-name>/`.

export const PITCH_STEPS = [
  {
    step: 1,
    timeRange: '0:00 – 0:30',
    title: 'Ringkasan Portofolio Awal (40 Episode)',
    view: 'analytics',
    episodeId: 'EP-002',
    actionLabel: null,
    script:
      '“Kami memeriksa 40 episode fisioterapi buatan: 14 membutuhkan klarifikasi, 6 membutuhkan pelengkapan data sumber, dan 20 memiliki bukti konsisten.”',
    highlight: 'Pisahkan keterlambatan data sumber (R0) dari selisih yang layak diklarifikasi (R1/R2).'
  },
  {
    step: 2,
    timeRange: '0:30 – 1:10',
    title: 'Selisih Sesi Aktif — Buka EP-002 (R1)',
    view: 'workspace',
    episodeId: 'EP-002',
    sessionIndex: 9,
    actionLabel: null,
    script:
      '“Episode EP-002 memiliki 12 sesi tagihan aktif dan 8 catatan cocok. Sesi 9 sampai 12 perlu ditelusuri. Sistem menampilkan ID sumber dan alasan R1; petugas tetap memeriksa penjelasannya.”',
    highlight: 'Klik kotak Sesi 9–12 untuk membandingkan baris tagihan dengan kekosongan catatan RME.'
  },
  {
    step: 3,
    timeRange: '1:10 – 1:50',
    title: 'Gerbang R0 & Sinkronisasi Parsial — EP-001',
    view: 'workspace',
    episodeId: 'EP-001',
    sessionIndex: 9,
    actionType: 'sync',
    actionLabel: 'Sinkronkan 2 catatan EP-001',
    script:
      '“Awalnya sumber EP-001 belum lengkap sehingga berstatus Lengkapi data. Setelah 2 catatan terlambat masuk dan batch lengkap, bukti cocok menjadi 10; 2 sesi sisanya beralih ke Perlu klarifikasi.”',
    highlight: 'Mencegah tuduhan prematur saat pengiriman data RME rumah sakit belum selesai.'
  },
  {
    step: 4,
    timeRange: '1:50 – 2:20',
    title: 'Keterlambatan Sah Terselesaikan — EP-010',
    view: 'workspace',
    episodeId: 'EP-010',
    sessionIndex: 5,
    actionType: 'sync',
    actionLabel: 'Sinkronkan 2 catatan EP-010',
    script:
      '“Pada EP-010, setelah 2 catatan susulan diterima, seluruh 6 sesi memiliki bukti cocok dan status berubah menjadi Bukti konsisten. Keterlambatan sumber tidak langsung dianggap kecurangan.”',
    highlight: 'Menurunkan beban klarifikasi pada kasus sah yang hanya mengalami jeda sinkronisasi.'
  },
  {
    step: 5,
    timeRange: '2:20 – 3:00',
    title: 'Sinyal R2 Isi Personal Identik — EP-015 ↔ EP-016',
    view: 'workspace',
    episodeId: 'EP-015',
    sessionIndex: 2,
    actionLabel: 'Lompat ke pasangan EP-016',
    actionType: 'open-related',
    relatedEpisodeId: 'EP-016',
    script:
      '“Pada EP-015, jumlah sesi cocok 6 dari 6, tetapi isi catatan personal Sesi 2 identik dengan EP-016 milik peserta berbeda. Formulir standar dikecualikan. Kemiripan memicu pertanyaan, bukan vonis.”',
    highlight: 'Mendeteksi potensi cloning catatan ketika pengecekan jumlah sesi biasa terlihat normal.'
  },
  {
    step: 6,
    timeRange: '3:00 – 3:25',
    title: 'Pembatalan Resmi & Versi Catatan — EP-039',
    view: 'workspace',
    episodeId: 'EP-039',
    sessionIndex: 5,
    actionLabel: null,
    script:
      '“Pada EP-039, dua sesi terakhir yang dibatalkan resmi (revisi v2 / not-done) dikecualikan otomatis. Empat sesi aktif memiliki empat bukti cocok sehingga berstatus Bukti konsisten.”',
    highlight: 'Memperhitungkan koreksi tagihan dan versi catatan terbaru tanpa salah menandai selisih.'
  },
  {
    step: 7,
    timeRange: '3:25 – 4:00',
    title: 'Tindak Lanjut Verifikator & Tiket Klarifikasi — EP-002',
    view: 'workspace',
    episodeId: 'EP-002',
    sessionIndex: 9,
    actionType: 'demo-review',
    actionLabel: 'Isi contoh tindak lanjut & buka tiket',
    script:
      '“Verifikator mencatat keputusan pemeriksaan serta mencetak tiket klarifikasi faskes atau kartu bukti JSON. Keputusan manusia disimpan terpisah dari sinyal mesin; penghematan hanya diakui setelah ajudikasi resmi.”',
    highlight: 'Tata kelola manusia (human-in-the-loop) menjaga jejak audit tanpa menghapus alasan aturan.'
  }
];

export const REVIEW_TEMPLATES = [
  {
    id: 'demo-ep002',
    label: 'Request Evidence (EP-002)',
    outcome: 'pending',
    note: 'Request EMR officer confirmation regarding Sessions 9-12 and clinical encounter logs. Ref: CLM-002-S9 to CLM-002-S12.'
  },
  {
    id: 'r0-sync',
    label: 'Request Batch Sync (R0)',
    outcome: 'pending',
    note: 'Contact healthcare facility data manager to complete pending EMR batch transmission before final discrepancy evaluation.'
  },
  {
    id: 'r2-clinical',
    label: 'Clarify Duplicate Text (R2)',
    outcome: 'pending',
    note: 'Request attending physiotherapist confirmation regarding identical clinical progress notes across different patients.'
  },
  {
    id: 'legitimate-doc',
    label: 'Accept Provider Explanation',
    outcome: 'legitimate',
    note: 'Encounter and physiotherapy evaluation verified through provider clinical records. Administrative variance resolved.'
  }
];

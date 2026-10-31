import { computePortfolioAnalytics, VERSION } from '../engine/jejakEngine.js';
import { safe } from '../utils/dom.js';

function buildDonutSvg(consistent, review, incomplete) {
  const total = Math.max(consistent + review + incomplete, 1);
  const r = 52;
  const c = 2 * Math.PI * r;

  const segs = [
    { val: consistent, color: '#158060', label: 'Bukti konsisten' },
    { val: review, color: '#d97706', label: 'Perlu klarifikasi' },
    { val: incomplete, color: '#2573b8', label: 'Lengkapi data' }
  ];

  let offset = 0;
  const circles = segs
    .filter((s) => s.val > 0)
    .map((s) => {
      const len = (s.val / total) * c;
      const dash = `${len} ${c - len}`;
      const dashOffset = -offset;
      offset += len;
      return `<circle cx="68" cy="68" r="${r}" fill="none" stroke="${s.color}" stroke-width="16" stroke-dasharray="${dash}" stroke-dashoffset="${dashOffset}" transform="rotate(-90 68 68)" />`;
    })
    .join('');

  return `
    <svg class="donut-svg" viewBox="0 0 136 136" role="img" aria-label="Komposisi status 40 episode">
      <circle cx="68" cy="68" r="${r}" fill="none" stroke="#e8eff6" stroke-width="16" />
      ${circles}
      <text x="68" y="64" text-anchor="middle" class="donut-big">${total}</text>
      <text x="68" y="81" text-anchor="middle" class="donut-sub">episode</text>
    </svg>
  `;
}

export function renderAnalyticsView(container, state, handlers) {
  container.dataset.mounted = 'analytics';
  const analytics = computePortfolioAnalytics(state.dataset.episodes);
  const { totals, facilities, rules, reviewOutcomes } = analytics;

  const totalAllClaimLines = totals.claimedSessions + totals.cancelledSessions;
  const pctMatched = totalAllClaimLines ? (totals.matchedSessions / totalAllClaimLines) * 100 : 0;
  const pctClarify = totalAllClaimLines
    ? (totals.missingClarificationSessions / totalAllClaimLines) * 100
    : 0;
  const pctWaiting = totalAllClaimLines ? (totals.waitingDataSessions / totalAllClaimLines) * 100 : 0;
  const pctCancelled = totalAllClaimLines ? (totals.cancelledSessions / totalAllClaimLines) * 100 : 0;

  container.innerHTML = `
    <section class="analytics-view" aria-label="Analitik fasilitas kesehatan dan portofolio">
      <div class="analytics-grid-top">
        <div class="card portfolio-card">
          <div class="card-head">
            <div>
              <span class="eyebrow-sm">DISTRIBUSI PORTOFOLIO EPISODE &amp; SESI</span>
              <h2>Ringkasan Kesiapan Bukti Layanan Fisioterapi</h2>
            </div>
            ${
              totals.pendingSyncEpisodes > 0
                ? `<button type="button" class="button accent small" id="sync-all-btn">↻ Sinkronkan Semua Batch Terlambat (${totals.pendingSyncEpisodes} Episode)</button>`
                : `<span class="synced-all-badge">✓ Seluruh batch terlambat telah disinkronkan</span>`
            }
          </div>

          <div class="portfolio-visual-row">
            <div class="donut-wrap">
              ${buildDonutSvg(totals.consistent, totals.review, totals.incomplete)}
              <div class="donut-legend">
                <div><i class="dot-consistent"></i><span>Bukti konsisten</span><b>${totals.consistent} ep (${Math.round((totals.consistent / totals.episodes) * 100)}%)</b></div>
                <div><i class="dot-review"></i><span>Perlu klarifikasi</span><b>${totals.review} ep (${Math.round((totals.review / totals.episodes) * 100)}%)</b></div>
                <div><i class="dot-incomplete"></i><span>Lengkapi data</span><b>${totals.incomplete} ep (${Math.round((totals.incomplete / totals.episodes) * 100)}%)</b></div>
              </div>
            </div>

            <div class="session-coverage-box">
              <div class="coverage-top">
                <div>
                  <span class="muted">Cakupan Bukti Tingkat Sesi Aktif</span>
                  <strong class="coverage-big">${totals.matchedSessions} / ${totals.claimedSessions} <span>sesi cocok (${totals.matchRate}%)</span></strong>
                </div>
                <span class="muted">${totalAllClaimLines} total baris klaim (${totals.cancelledSessions} batal resmi)</span>
              </div>

              <div class="stacked-bar" role="img" aria-label="Proporsi pencocokan seluruh sesi">
                <span class="seg-matched" style="width:${pctMatched}%" title="Catatan cocok: ${totals.matchedSessions}"></span>
                <span class="seg-clarify" style="width:${pctClarify}%" title="Perlu klarifikasi: ${totals.missingClarificationSessions}"></span>
                <span class="seg-waiting" style="width:${pctWaiting}%" title="Menunggu data R0: ${totals.waitingDataSessions}"></span>
                <span class="seg-cancelled" style="width:${pctCancelled}%" title="Dibatalkan resmi: ${totals.cancelledSessions}"></span>
              </div>

              <div class="session-stat-chips">
                <div class="s-chip ok"><b>${totals.matchedSessions}</b><span>Sesi aktif cocok</span></div>
                <div class="s-chip warn"><b>${totals.missingClarificationSessions}</b><span>Selisih sesi (R1)</span></div>
                <div class="s-chip info"><b>${totals.waitingDataSessions}</b><span>Menunggu batch (R0)</span></div>
                <div class="s-chip neutral"><b>${totals.cancelledSessions}</b><span>Dibatalkan resmi (v2)</span></div>
              </div>
            </div>
          </div>
        </div>

        <div class="card governance-card">
          <span class="eyebrow-sm">TATA KELOLA MANUSIA (BAB 8.4)</span>
          <h2>Progres Tindak Lanjut Verifikator</h2>
          <p class="muted">Keputusan pemeriksa dicatat terpisah dari status aturan ${safe(VERSION)}.</p>

          <div class="gov-progress-num">
            <strong>${totals.reviewedCount}<span>/${totals.episodes}</span></strong>
            <small>episode telah diberi catatan tindak lanjut pada sesi ini</small>
          </div>

          <div class="gov-list">
            <div class="gov-row">
              <span>Perlu bukti tambahan</span>
              <b>${reviewOutcomes.pending}</b>
            </div>
            <div class="gov-row">
              <span>Penjelasan sah diterima</span>
              <b>${reviewOutcomes.legitimate}</b>
            </div>
            <div class="gov-row">
              <span>Ketidaksesuaian terkonfirmasi</span>
              <b>${reviewOutcomes.confirmed}</b>
            </div>
            <div class="gov-row muted-row">
              <span>Belum ditindaklanjuti</span>
              <b>${reviewOutcomes.unreviewed}</b>
            </div>
          </div>

          <button type="button" class="button secondary full-btn" id="open-priority-queue">
            Buka Antrean Prioritas Klarifikasi (${totals.review}) →
          </button>
        </div>
      </div>

      <div class="section-heading">
        <div>
          <h2>Perbandingan Antar Fasilitas Kesehatan Simulasi</h2>
          <span class="sub-caption">Klik fasilitas untuk memfilter antrean ruang kerja verifikator</span>
        </div>
      </div>

      <div class="facility-grid">
        ${facilities
          .map((f) => {
            const pCons = (f.consistent / f.episodes) * 100;
            const pRev = (f.review / f.episodes) * 100;
            const pInc = (f.incomplete / f.episodes) * 100;
            return `
              <div class="card facility-card">
                <div class="facility-head">
                  <div>
                    <span class="fac-code">${safe(f.facility_id)}</span>
                    <h3>${safe(f.facility_name)}</h3>
                  </div>
                  <span class="fac-rate">${f.matchRate}% <span>sesi cocok</span></span>
                </div>

                <div class="stacked-bar compact-bar" title="Konsisten ${f.consistent}, Klarifikasi ${f.review}, Data ${f.incomplete}">
                  <span class="seg-matched" style="width:${pCons}%"></span>
                  <span class="seg-clarify" style="width:${pRev}%"></span>
                  <span class="seg-waiting" style="width:${pInc}%"></span>
                </div>

                <div class="fac-metrics">
                  <div><span>Total Episode</span><strong>${f.episodes}</strong></div>
                  <div><span>Klarifikasi</span><strong class="text-warn">${f.review}</strong></div>
                  <div><span>Lengkapi Data</span><strong class="text-info">${f.incomplete}</strong></div>
                  <div><span>Konsisten</span><strong class="text-green">${f.consistent}</strong></div>
                </div>

                <div class="fac-foot-meta">
                  <span>Sesi aktif cocok: <b>${f.matchedSessions}/${f.claimedSessions}</b></span>
                  <span>${f.pendingSyncEpisodes ? `${f.pendingSyncEpisodes} batch tunda` : 'Batch lengkap'}</span>
                </div>

                <button type="button" class="button secondary small full-btn" data-open-facility="${safe(f.facility_name)}">
                  Buka Antrean ${safe(f.facility_name)} →
                </button>
              </div>
            `;
          })
          .join('')}
      </div>

      <div class="section-heading">
        <div>
          <h2>Peta Sinyal Aturan yang Dapat Dijelaskan (${safe(VERSION)})</h2>
          <span class="sub-caption">Klik chip episode untuk langsung membuka rincian bukti sesi terkait</span>
        </div>
      </div>

      <div class="rules-analytics-grid">
        <div class="card rule-stat-card border-r0">
          <div class="rule-stat-top">
            <span class="rule-code code-r0">R0</span>
            <strong>Gerbang Kelengkapan Sumber</strong>
            <span class="rule-count-pill">${rules.r0Episodes.length} episode</span>
          </div>
          <p>Menahan penarikan kesimpulan selisih sesi apabila batch pengiriman RME belum lengkap atau terdapat salah pemetaan identitas.</p>
          <div class="ep-chip-list">
            ${
              rules.r0Episodes.length
                ? rules.r0Episodes
                    .map((id) => `<button type="button" class="ep-chip" data-jump-episode="${safe(id)}">${safe(id)}</button>`)
                    .join('')
                : '<span class="muted">Seluruh episode telah melewati gerbang R0.</span>'
            }
          </div>
        </div>

        <div class="card rule-stat-card border-r1">
          <div class="rule-stat-top">
            <span class="rule-code">R1</span>
            <strong>Selisih Pencocokan Sesi Aktif</strong>
            <span class="rule-count-pill">${rules.r1Episodes.length} episode</span>
          </div>
          <p>Mencocokkan setiap sesi tagihan aktif dengan catatan RME berstatus selesai pada tanggal &amp; identitas yang sama setelah sumber lengkap.</p>
          <div class="ep-chip-list">
            ${rules.r1Episodes
              .map((id) => `<button type="button" class="ep-chip" data-jump-episode="${safe(id)}">${safe(id)}</button>`)
              .join('')}
          </div>
        </div>

        <div class="card rule-stat-card border-r2">
          <div class="rule-stat-top">
            <span class="rule-code">R2</span>
            <strong>Kesamaan Isi Personal Lintas Episode</strong>
            <span class="rule-count-pill">${rules.r2Episodes.length} episode (${rules.r2Pairs.length} pasang)</span>
          </div>
          <p>Mendeteksi teks progres individual identik (≥60 karakter ternormalisasi) antar peserta berbeda walaupun jumlah sesi cocok penuh.</p>
          <div class="ep-chip-list">
            ${rules.r2Pairs
              .map(
                (pair) =>
                  `<button type="button" class="ep-chip pair-chip" data-jump-episode="${safe(pair.leftEpisode)}" data-jump-session="2">${safe(pair.leftEpisode)} ↔ ${safe(pair.rightEpisode)}</button>`
              )
              .join('')}
          </div>
        </div>

        <div class="card rule-stat-card border-ok">
          <div class="rule-stat-top">
            <span class="rule-code code-ok">v2</span>
            <strong>Koreksi Pembatalan &amp; Versi Catatan</strong>
            <span class="rule-count-pill">${rules.cancelledEpisodes.length} episode</span>
          </div>
          <p>Mengecualikan sesi tagihan yang dibatalkan resmi serta mengacu pada versi catatan terbaru sehingga tidak salah ditandai sebagai selisih.</p>
          <div class="ep-chip-list">
            ${rules.cancelledEpisodes
              .map(
                (id) =>
                  `<button type="button" class="ep-chip ok-chip" data-jump-episode="${safe(id)}" data-jump-session="5">${safe(id)} (2 batal dikecualikan)</button>`
              )
              .join('')}
          </div>
        </div>
      </div>

      <div class="card arch-card">
        <div class="card-head">
          <div>
            <span class="eyebrow-sm">ARSITEKTUR TARGET &amp; PEMETAAN INTEROPERABILITAS (BAB 4.2 – 4.3)</span>
            <h2>Alur Pemrosesan JEJAK JKN &amp; Rujukan Standar SATUSEHAT FHIR</h2>
          </div>
          <span class="arch-note-pill">Prototipe memproses data sintetis di browser · Konektor pilot direncanakan</span>
        </div>

        <div class="arch-flow-diagram" role="img" aria-label="Diagram alur pemrosesan dari sumber data ke gerbang R0, aturan R1 dan R2, hingga kartu bukti verifikator">
          <div class="arch-stage">
            <span class="stage-num">1. Sumber Data Berizin</span>
            <strong>Tagihan, Kunjungan &amp; Catatan Tindakan</strong>
            <small>Termasuk koreksi pembatalan &amp; penanda waktu terima</small>
            <div class="fhir-pills"><span>Encounter</span><span>Procedure</span><span>ChargeItem</span><span>Claim</span></div>
          </div>
          <div class="arch-arrow" aria-hidden="true">→</div>
          <div class="arch-stage">
            <span class="stage-num">2. Pemetaan &amp; Tokenisasi</span>
            <strong>Episode &amp; Identitas Bertoken</strong>
            <small>Tanpa menampilkan NIK/nama asli di ruang analitik umum (UU PDP)</small>
          </div>
          <div class="arch-arrow" aria-hidden="true">→</div>
          <div class="arch-stage highlight-r0">
            <span class="stage-num">3. Gerbang R0</span>
            <strong>Pemeriksaan Kelengkapan Sumber</strong>
            <small>Belum lengkap → <em>Lengkapi data</em> &amp; hitung ulang saat sinkron</small>
          </div>
          <div class="arch-arrow" aria-hidden="true">→</div>
          <div class="arch-stage highlight-r12">
            <span class="stage-num">4. Mesin Aturan R1 &amp; R2</span>
            <strong>Pencocokan Sesi &amp; Isi Personal</strong>
            <small>Mengecualikan sesi batal &amp; teks formulir standar</small>
          </div>
          <div class="arch-arrow" aria-hidden="true">→</div>
          <div class="arch-stage highlight-gov">
            <span class="stage-num">5. Ruang Kerja &amp; Tata Kelola</span>
            <strong>Kartu Bukti, Tiket Faskes &amp; Verifikator</strong>
            <small>Keputusan pembayaran mengikuti proses ajudikasi resmi</small>
            <div class="fhir-pills"><span>ClaimResponse</span></div>
          </div>
        </div>
      </div>
    </section>
  `;

  const syncAllBtn = container.querySelector('#sync-all-btn');
  if (syncAllBtn) {
    syncAllBtn.addEventListener('click', () => handlers.onSyncAllLate());
  }

  container.querySelector('#open-priority-queue').addEventListener('click', () => {
    handlers.onJumpToFilter({ filter: 'review', facilityFilter: 'all', signalFilter: 'all' });
  });

  container.querySelectorAll('[data-open-facility]').forEach((btn) => {
    btn.addEventListener('click', () => {
      handlers.onJumpToFilter({
        filter: 'all',
        facilityFilter: btn.dataset.openFacility,
        signalFilter: 'all'
      });
    });
  });

  container.querySelectorAll('[data-jump-episode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sessionIdx = btn.dataset.jumpSession ? Number(btn.dataset.jumpSession) : undefined;
      handlers.onOpenEpisode(btn.dataset.jumpEpisode, sessionIdx);
    });
  });
}

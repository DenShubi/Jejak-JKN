import { inspectEpisode, outcomeLabels, VERSION } from '../engine/jejakEngine.js';
import { REVIEW_TEMPLATES } from '../data/pitchSteps.js';
import { safe, formatShortDayMonth, formatShortDate, formatTimestamp } from '../utils/dom.js';

const STATUS_SORT = { review: 0, incomplete: 1, consistent: 2 };

export function ensureWorkspaceShell(container, state, handlers) {
  if (container.dataset.mounted === 'workspace') return;
  container.dataset.mounted = 'workspace';

  container.innerHTML = `
    <section class="workspace" aria-label="Ruang pemeriksaan verifikator">
      <aside class="queue-panel" aria-label="Antrean episode">
        <div class="panel-heading">
          <div>
            <h2>Antrean Episode</h2>
          </div>
          <span id="queue-count" class="count-pill"></span>
        </div>

        <div class="queue-controls">
          <label class="search-label">
            <span class="sr-only">Cari episode, klaim, peserta, atau fasilitas</span>
            <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="m15.5 15.5 5 5"></path></svg>
            <input id="search" type="search" placeholder="Cari episode, klaim, atau faskes…" value="${safe(state.query)}">
          </label>

          <div class="filters" id="filters" role="group" aria-label="Filter status pemeriksaan"></div>

          <div class="sub-filters">
            <label class="compact-select">
              <span class="sr-only">Filter fasilitas kesehatan</span>
              <select id="facility-filter" aria-label="Filter fasilitas kesehatan">
                <option value="all">Semua Faskes (3 RS)</option>
                <option value="RS Simulasi Aruna">RS Simulasi Aruna</option>
                <option value="RS Simulasi Bima">RS Simulasi Bima</option>
                <option value="RS Simulasi Cakra">RS Simulasi Cakra</option>
              </select>
            </label>
            <label class="compact-select">
              <span class="sr-only">Filter aturan atau sinyal</span>
              <select id="signal-filter" aria-label="Filter sinyal aturan">
                <option value="all">Semua Sinyal</option>
                <option value="R0">R0 · Sumber Belum Lengkap</option>
                <option value="R1">R1 · Selisih Sesi Aktif</option>
                <option value="R2">R2 · Isi Personal Sama</option>
                <option value="cancelled">Ada Sesi Dibatalkan</option>
                <option value="reviewed">Sudah Ditindaklanjuti</option>
                <option value="unreviewed">Belum Ditindaklanjuti</option>
              </select>
            </label>
          </div>
          <div id="active-filter-bar" class="active-filter-bar" hidden></div>
        </div>

        <div class="queue-list" id="queue-list" role="list"></div>
        <p class="queue-foot">40 episode · Periode simulasi September 2026</p>
      </aside>

      <article class="detail-panel" id="detail" aria-label="Detail penelusuran bukti episode"></article>
    </section>
  `;

  const searchInput = container.querySelector('#search');
  const facilitySelect = container.querySelector('#facility-filter');
  const signalSelect = container.querySelector('#signal-filter');

  searchInput.addEventListener('input', (e) => {
    handlers.onFilterChange({ query: e.target.value }, { queueOnly: true });
  });

  facilitySelect.addEventListener('change', (e) => {
    handlers.onFilterChange({ facilityFilter: e.target.value }, { queueOnly: true });
  });

  signalSelect.addEventListener('change', (e) => {
    handlers.onFilterChange({ signalFilter: e.target.value }, { queueOnly: true });
  });
}

function matchesSignalFilter(ep, r, signalFilter) {
  if (signalFilter === 'all') return true;
  if (signalFilter === 'R0') return !r.complete;
  if (signalFilter === 'R1') return r.reasons.some((x) => x.code === 'R1');
  if (signalFilter === 'R2') return r.reused.length > 0;
  if (signalFilter === 'cancelled') return r.cancelled > 0;
  if (signalFilter === 'reviewed') return Boolean(ep.review);
  if (signalFilter === 'unreviewed') return !ep.review;
  return true;
}

export function renderQueuePanel(container, evaluations, state, handlers) {
  const searchInput = container.querySelector('#search');
  if (searchInput && searchInput.value !== state.query) {
    searchInput.value = state.query;
  }
  const facilitySelect = container.querySelector('#facility-filter');
  if (facilitySelect) facilitySelect.value = state.facilityFilter;
  const signalSelect = container.querySelector('#signal-filter');
  if (signalSelect) signalSelect.value = state.signalFilter;

  const statusCounts = {
    all: evaluations.length,
    review: evaluations.filter((x) => x.r.status === 'review').length,
    incomplete: evaluations.filter((x) => x.r.status === 'incomplete').length,
    consistent: evaluations.filter((x) => x.r.status === 'consistent').length
  };

  const filtersEl = container.querySelector('#filters');
  const filterDefs = [
    ['all', 'Semua', statusCounts.all],
    ['review', 'Klarifikasi', statusCounts.review],
    ['incomplete', 'Menunggu Data', statusCounts.incomplete],
    ['consistent', 'Konsisten', statusCounts.consistent]
  ];
  filtersEl.innerHTML = filterDefs
    .map(
      ([key, label, count]) => `
        <button
          type="button"
          data-filter="${key}"
          class="filter ${state.filter === key ? 'active' : ''}"
          aria-pressed="${state.filter === key}"
        >${label} <span>${count}</span></button>
      `
    )
    .join('');

  filtersEl.querySelectorAll('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      handlers.onFilterChange({ filter: btn.dataset.filter }, { queueOnly: true });
    });
  });

  const hasExtraFilter =
    state.filter !== 'all' ||
    state.facilityFilter !== 'all' ||
    state.signalFilter !== 'all' ||
    state.query.trim().length > 0;

  const activeFilterBar = container.querySelector('#active-filter-bar');
  if (hasExtraFilter) {
    activeFilterBar.hidden = false;
    activeFilterBar.innerHTML = `
      <span>Filter aktif diterapkan</span>
      <button type="button" class="link-btn" id="clear-filters">Reset filter</button>
    `;
    activeFilterBar.querySelector('#clear-filters').addEventListener('click', () => {
      handlers.onFilterChange(
        { filter: 'all', facilityFilter: 'all', signalFilter: 'all', query: '' },
        { queueOnly: true }
      );
    });
  } else {
    activeFilterBar.hidden = true;
    activeFilterBar.innerHTML = '';
  }

  const q = state.query.trim().toLowerCase();
  const shown = evaluations
    .filter(({ ep, r }) => {
      const statusOk = state.filter === 'all' || r.status === state.filter;
      const facOk = state.facilityFilter === 'all' || ep.facility_name === state.facilityFilter;
      const sigOk = matchesSignalFilter(ep, r, state.signalFilter);
      const queryOk =
        !q ||
        [ep.episode_id, ep.claim_id, ep.patient_token, ep.facility_name]
          .join(' ')
          .toLowerCase()
          .includes(q);
      return statusOk && facOk && sigOk && queryOk;
    })
    .sort(
      (a, b) =>
        STATUS_SORT[a.r.status] - STATUS_SORT[b.r.status] ||
        a.ep.episode_id.localeCompare(b.ep.episode_id)
    );

  container.querySelector('#queue-count').textContent = `${shown.length}/${evaluations.length}`;

  const listEl = container.querySelector('#queue-list');
  if (!shown.length) {
    listEl.innerHTML = `
      <div class="empty">
        <strong>Tidak ada episode yang cocok.</strong>
        <p>Ubah kata kunci pencarian atau reset filter untuk melihat kembali antrean.</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = shown
    .map(({ ep, r }) => {
      const pct = r.claimed ? Math.round((r.matched / r.claimed) * 100) : 100;
      const ruleCodes = r.reasons.map((x) => x.code);
      return `
        <button
          type="button"
          class="queue-item ${ep.episode_id === state.selected ? 'selected' : ''}"
          data-episode="${ep.episode_id}"
          aria-pressed="${ep.episode_id === state.selected}"
        >
          <span class="queue-item-top">
            <span class="queue-id-wrap">
              <strong>${safe(ep.episode_id)}</strong>
              ${ep.review ? '<span class="reviewed-dot" title="Sudah ditindaklanjuti verifikator">✓ Ditinjau</span>' : ''}
            </span>
            <span class="badge ${r.status}">${safe(r.label)}</span>
          </span>
          <span class="queue-facility">${safe(ep.facility_name)} · ${safe(ep.patient_token)}</span>
          <span class="queue-progress-row">
            <span class="mini-bar"><i class="fill-${r.status}" style="width:${pct}%"></i></span>
            <span class="queue-ratio"><b>${r.matched}/${r.claimed}</b> sesi</span>
          </span>
          <span class="queue-tags">
            ${ruleCodes.map((c) => `<span class="q-tag tag-${c.toLowerCase()}">${c}</span>`).join('')}
            ${r.cancelled ? `<span class="q-tag tag-neutral">${r.cancelled} batal</span>` : ''}
            ${ep.late_records.length ? `<span class="q-tag tag-sync">+${ep.late_records.length} tunda</span>` : ''}
          </span>
        </button>
      `;
    })
    .join('');

  listEl.querySelectorAll('[data-episode]').forEach((btn) => {
    btn.addEventListener('click', () => handlers.onOpenEpisode(btn.dataset.episode));
  });
}

function renderSelectedSessionInspector(ep, inspection, selectedSessionIndex) {
  const session =
    inspection.sessions.find((s) => s.sessionIndex === selectedSessionIndex) ||
    inspection.sessions[0];
  if (!session) return '';

  const { claim, record, queuedLateRecord, reusedPairs, latency, normalizedPersonalLength } = session;
  const totalSessions = inspection.sessions.length;

  return `
    <div class="inspector-card" id="session-inspector">
      <div class="inspector-header">
        <div class="inspector-title">
          <span class="inspector-badge">Sesi ${session.sessionIndex} dari ${totalSessions}</span>
          <h4>Rekonsiliasi Sesi · ${safe(formatShortDate(claim.service_date))}</h4>
        </div>
        <div class="inspector-nav">
          <span class="session-state-pill pill-${session.state}">${safe(session.stateLabel)}</span>
          <button type="button" class="button ghost tiny" data-session-step="-1" ${session.sessionIndex <= 1 ? 'disabled' : ''} aria-label="Sesi sebelumnya">← Sesi</button>
          <button type="button" class="button ghost tiny" data-session-step="1" ${session.sessionIndex >= totalSessions ? 'disabled' : ''} aria-label="Sesi berikutnya">Sesi →</button>
        </div>
      </div>

      <div class="inspector-grid">
        <div class="source-pane claim-pane">
          <div class="pane-head">
            <span class="pane-tag">Tagihan Klaim (Claim)</span>
            <span class="rev-chip">Revisi v${claim.revision}</span>
          </div>
          <dl class="kv-grid">
            <div><dt>ID Baris Tagihan</dt><dd><code>${safe(claim.line_id)}</code></dd></div>
            <div><dt>Status Tagihan</dt><dd><strong class="${claim.status === 'cancelled' ? 'text-muted' : 'text-ink'}">${claim.status === 'cancelled' ? 'Cancelled (Dibatalkan resmi)' : 'Active (Ditagihkan)'}</strong></dd></div>
            <div><dt>Tanggal Layanan</dt><dd>${safe(claim.service_date)}</dd></div>
            <div><dt>Episode &amp; Peserta</dt><dd>${safe(ep.episode_id)} · ${safe(ep.patient_token)}</dd></div>
          </dl>
          ${
            claim.status === 'cancelled'
              ? `<p class="pane-callout neutral">Baris tagihan ini dibatalkan pada revisi klaim v${claim.revision}, sehingga dikecualikan dari perhitungan sesi aktif oleh aturan <b>R1</b>.</p>`
              : `<p class="pane-callout">Baris tagihan aktif memerlukan catatan tindakan RME berstatus <code>completed</code> pada tanggal layanan dan identitas yang sama.</p>`
          }
        </div>

        <div class="source-pane rme-pane">
          <div class="pane-head">
            <span class="pane-tag">Catatan Layanan (RME Procedure)</span>
            ${record ? `<span class="rev-chip">Versi v${record.version}</span>` : `<span class="rev-chip missing-chip">0 Catatan Cocok</span>`}
          </div>
          ${
            record
              ? `
                <dl class="kv-grid">
                  <div><dt>ID Catatan Sumber</dt><dd><code>${safe(record.record_id)}</code></dd></div>
                  <div><dt>Status Tindakan</dt><dd><strong class="${record.status === 'completed' ? 'text-green' : 'text-muted'}">${safe(record.status)}${record.status === 'not-done' ? ' (Tidak jadi dilaksanakan)' : ''}</strong></dd></div>
                  <div><dt>Pelaksana &amp; Sistem</dt><dd>${safe(record.therapist_token)} · ${safe(record.source_system)}</dd></div>
                  <div><dt>Jeda Penerimaan</dt><dd><span class="latency-chip ${latency?.isDelayed ? 'delayed' : ''}">${safe(latency?.label || '-')}</span></dd></div>
                </dl>
                <div class="timestamp-bar">
                  <span>Dibuat RME: <code>${safe(formatTimestamp(record.created_at))}</code></span>
                  <span>Diterima: <code>${safe(formatTimestamp(record.received_at))}</code></span>
                </div>
                <div class="clinical-notes-split">
                  <div class="note-block template-block">
                    <div class="note-block-head">
                      <strong>Formulir Standar (template_text)</strong>
                      <span class="note-rule-chip excluded">Dikecualikan R2</span>
                    </div>
                    <p>${safe(record.template_text)}</p>
                  </div>
                  <div class="note-block personal-block ${reusedPairs.length ? 'reused-highlight' : ''}">
                    <div class="note-block-head">
                      <strong>Asesmen Individual (patient_specific_text)</strong>
                      <span class="note-rule-chip ${reusedPairs.length ? 'flagged' : 'checked'}">
                        ${normalizedPersonalLength} kar. · ${reusedPairs.length ? 'Identik lintas episode (R2)' : 'Diperiksa R2 (≥60 kar.)'}
                      </span>
                    </div>
                    <p>${safe(record.patient_specific_text)}</p>
                  </div>
                </div>
              `
              : `
                <div class="missing-record-state ${inspection.result.complete ? 'state-r1' : 'state-r0'}">
                  <strong>${
                    inspection.result.complete
                      ? 'Tidak ditemukan catatan tindakan RME yang cocok (Sinyal R1)'
                      : 'Menunggu kelengkapan pengiriman batch RME (Gerbang R0)'
                  }</strong>
                  <p>${
                    inspection.result.complete
                      ? `Cakupan sumber dari ${safe(ep.facility_name)} telah dinyatakan lengkap, tetapi belum ada catatan berstatus completed untuk Sesi ${session.sessionIndex} (${safe(claim.service_date)}).`
                      : `Batch pengiriman sumber untuk ${safe(ep.episode_id)} belum dinyatakan lengkap. Selisih pada Sesi ${session.sessionIndex} masih berstatus sementara.`
                  }</p>
                  ${
                    queuedLateRecord
                      ? `<div class="late-preview-hint">Simulasi konektor: tersedia catatan susulan <code>${safe(queuedLateRecord.record_id)}</code> di antrean terlambat. Klik tombol <b>Sinkronkan</b> di atas untuk menguji perhitungan ulang.</div>`
                      : !inspection.result.complete
                        ? `<div class="late-preview-hint muted-hint">Catatan: Sesi ${session.sessionIndex} ini juga belum ada di paket susulan konektor; jika batch dinyatakan lengkap tanpa catatan ini, status akan beralih ke klarifikasi R1.</div>`
                        : ''
                  }
                </div>
              `
          }
        </div>
      </div>
    </div>
  `;
}

export function renderEpisodeDetail(container, state, handlers) {
  const detailEl = container.querySelector('#detail');
  const ep = state.dataset.episodes.find((x) => x.episode_id === state.selected);
  if (!ep) return;

  const inspection = inspectEpisode(ep, state.dataset.episodes);
  const { result: r, sessions, gates } = inspection;

  const activeSessionIndex =
    state.selectedSessionByEpisode[ep.episode_id] || inspection.recommendedSessionIndex;

  const draft = state.reviewDrafts[ep.episode_id] || {
    outcome: ep.review?.outcome || 'pending',
    note: ''
  };

  detailEl.innerHTML = `
    <div class="detail-header">
      <div class="detail-top-row">
        <div>
          <div class="detail-title-line">
            <h2>${safe(ep.episode_id)} <span class="muted">/ ${safe(ep.claim_id)}</span></h2>
            <span class="badge ${r.status}">${safe(r.label)}</span>
            ${
              ep.review
                ? `<span class="human-pill outcome-${safe(ep.review.outcome)}">Tindak Lanjut: ${safe(outcomeLabels[ep.review.outcome])}</span>`
                : ''
            }
          </div>
          <p class="detail-meta">
            <strong>${safe(ep.facility_name)}</strong> (${safe(ep.facility_id)}) · Peserta <code>${safe(ep.patient_token)}</code> · ${safe(ep.period)}
          </p>
        </div>

        <div class="detail-actions">
          ${
            ep.late_records.length
              ? `<button type="button" id="sync" class="button accent">Sinkronkan ${ep.late_records.length} Catatan Terlambat</button>`
              : ''
          }
          <button type="button" id="open-ticket" class="button secondary">Tiket Klarifikasi</button>
          <button type="button" id="export-case" class="button secondary">Ekspor JSON</button>
        </div>
      </div>

      <div class="detail-snapshot">
        <span>Mesin Aturan: <b>${safe(VERSION)}</b></span>
        <span>Revisi Klaim: <b>v${ep.claim_version}</b></span>
        <span>Cakupan Sumber: <b>${r.complete ? 'Lengkap' : 'Menunggu Data'}</b></span>
        <span>Snapshot Diterima: <b>${safe(formatTimestamp(ep.source_received_at))}</b></span>
      </div>
    </div>

    <div class="content-pad">
      <div class="gate-pipeline" aria-label="Alur pemeriksaan tiga tahap">
        ${gates
          .map(
            (g) => `
            <div class="gate-step gate-${g.status}">
              <div class="gate-step-top">
                <span class="gate-code">${safe(g.code)}</span>
                <span class="gate-badge">${safe(g.badge)}</span>
              </div>
              <strong>${safe(g.name)}</strong>
              <p>${safe(g.summary)}</p>
            </div>
          `
          )
          .join('')}
      </div>

      ${r.reasons
        .map(
          (reason) => `
          <div class="reason ${reason.code === 'R0' ? 'data' : reason.code === 'R2' ? 'reuse-reason' : ''}">
            <div class="reason-top">
              <span class="rule-code">${safe(reason.code)}</span>
              <span>${safe(reason.title)}</span>
            </div>
            <p>${safe(reason.detail)}</p>
          </div>
        `
        )
        .join('')}

      ${
        r.status === 'consistent'
          ? `<div class="consistent-note">
               <strong>Bukti sesi yang diterima saling bersesuaian.</strong>
               <span>Seluruh tagihan sesi aktif memiliki catatan tindakan selesai tanpa duplikasi isi personal lintas episode.</span>
             </div>`
          : ''
      }

      <div class="evidence-metrics">
        <div class="mini-metric">
          <span>Sesi tagihan aktif</span>
          <strong>${r.claimed}</strong>
          <small>${r.cancelled ? `${r.cancelled} sesi dibatalkan dikecualikan` : 'Unit pemeriksaan'}</small>
        </div>
        <div class="mini-metric metric-ok">
          <span>Catatan sesi cocok</span>
          <strong>${r.matched}</strong>
          <small>${r.claimed ? Math.round((r.matched / r.claimed) * 100) : 100}% sesi aktif berpasangan RME</small>
        </div>
        <div class="mini-metric ${r.missing ? (r.complete ? 'metric-warn' : 'metric-info') : ''}">
          <span>${r.complete ? 'Belum cocok (klarifikasi)' : 'Belum cocok sementara'}</span>
          <strong>${r.missing}</strong>
          <small>${r.missing_indexes.length ? `Sesi: ${r.missing_indexes.join(', ')}` : 'Tidak ada selisih sesi aktif'}</small>
        </div>
      </div>

      <div class="section-heading">
        <div>
          <h3>Jejak Sesi Layanan</h3>
        </div>
        <div class="legend">
          <span class="leg-has">Cocok</span>
          <span class="leg-missing">Klarifikasi</span>
          <span class="leg-waiting">Menunggu Data</span>
          <span class="leg-reused">Teks Identik (R2)</span>
          <span class="leg-cancelled">Dibatalkan</span>
        </div>
      </div>

      <div class="session-grid" role="listbox" aria-label="Pilih sesi fisioterapi untuk diinspeksi">
        ${sessions
          .map(
            (s) => `
            <button
              type="button"
              role="option"
              aria-selected="${s.sessionIndex === activeSessionIndex}"
              class="session ${s.state} ${s.sessionIndex === activeSessionIndex ? 'selected-session' : ''}"
              data-select-session="${s.sessionIndex}"
              title="${safe(s.claim.line_id)} · ${safe(s.stateLabel)}"
            >
              <span class="session-num">Sesi ${s.sessionIndex}</span>
              <small class="session-date">${safe(formatShortDayMonth(s.claim.service_date))}</small>
              <small class="session-status">${safe(s.shortStatus)}</small>
              <code class="session-rec">${s.cancelled ? 'v2 batal' : s.record ? safe(s.record.record_id) : '—'}</code>
            </button>
          `
          )
          .join('')}
      </div>

      ${renderSelectedSessionInspector(ep, inspection, activeSessionIndex)}

      ${
        r.reused.length
          ? `
            <div class="section-heading">
              <div>
                <h3>Keterkaitan Teks Personal Lintas Episode (Sinyal R2)</h3>
              </div>
            </div>
            <div class="r2-diff-list">
              ${r.reused
                .map(
                  (pair) => `
                  <div class="r2-diff-card">
                    <div class="r2-diff-columns">
                      <div class="r2-col">
                        <span class="r2-col-label">Episode Saat Ini</span>
                        <strong>${safe(ep.episode_id)} · ${safe(ep.patient_token)}</strong>
                        <small>${safe(ep.facility_name)} · Catatan <code>${safe(pair.record_id)}</code> (Sesi ${pair.session_index || 2})</small>
                      </div>
                      <div class="r2-connector" aria-hidden="true"><span class="r2-badge">Teks Identik (R2)</span></div>
                      <div class="r2-col linked">
                        <span class="r2-col-label">Episode Pasangan Berbeda</span>
                        <strong>${safe(pair.other_episode_id)} · ${safe(pair.other_patient_token)}</strong>
                        <small>${safe(pair.other_facility_name || 'RS Simulasi')} · Catatan <code>${safe(pair.other_record_id)}</code></small>
                        <button type="button" class="button secondary tiny r2-jump" data-related="${safe(pair.other_episode_id)}">Buka ${safe(pair.other_episode_id)} →</button>
                      </div>
                    </div>
                    <div class="r2-shared-text">
                      <span>Teks personal identik yang terdeteksi:</span>
                      <blockquote>“${safe(pair.text)}”</blockquote>
                    </div>
                  </div>
                `
                )
                .join('')}
            </div>
          `
          : ''
      }

      <details class="table-accordion" open>
        <summary>
          <span>Daftar Bukti Seluruh Sesi (${sessions.length} baris)</span>
        </summary>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Sesi</th>
                <th scope="col">ID Baris Klaim</th>
                <th scope="col">Tgl Layanan</th>
                <th scope="col">ID Catatan RME</th>
                <th scope="col">Pelaksana &amp; Versi</th>
                <th scope="col">Hasil Pencocokan</th>
              </tr>
            </thead>
            <tbody>
              ${sessions
                .map(
                  (s) => `
                  <tr
                    class="clickable-row ${s.cancelled ? 'row-muted' : ''} ${s.sessionIndex === activeSessionIndex ? 'active-table-row' : ''}"
                    data-select-session="${s.sessionIndex}"
                  >
                    <td><b>Sesi ${s.sessionIndex}</b></td>
                    <td><code>${safe(s.claim.line_id)}</code></td>
                    <td>${safe(s.claim.service_date)}</td>
                    <td>${s.cancelled ? 'Dikecualikan' : s.record ? `<code>${safe(s.record.record_id)}</code>` : '<span class="muted">Belum tersedia</span>'}</td>
                    <td>${s.record ? `${safe(s.record.therapist_token)} · v${s.record.version}` : '—'}</td>
                    <td><span class="table-state state-${s.state}">${safe(s.stateLabel)}</span></td>
                  </tr>
                `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </details>

      <div class="review-box" id="review-section">
        <div class="review-box-head">
          <div>
            <h3>Tindak Lanjut Verifikator</h3>
          </div>
        </div>

        ${
          ep.review
            ? `
              <div class="review-saved outcome-box-${safe(ep.review.outcome)}">
                <div class="review-saved-top">
                  <strong>${safe(outcomeLabels[ep.review.outcome])}</strong>
                  <span>${safe(ep.review.actor)} · ${safe(formatTimestamp(ep.review.at))}</span>
                </div>
                <p>${safe(ep.review.note)}</p>
              </div>
            `
            : ''
        }

        <div class="quick-templates">
          <span class="template-caption">Template Catatan:</span>
          ${REVIEW_TEMPLATES.map(
            (tpl) => `
              <button type="button" class="chip-btn" data-tpl="${safe(tpl.id)}">${safe(tpl.label)}</button>
            `
          ).join('')}
        </div>

        <form id="review-form">
          <div class="review-controls">
            <label>
              Hasil verifikasi
              <select id="outcome">
                <option value="pending" ${draft.outcome === 'pending' ? 'selected' : ''}>Perlu bukti tambahan</option>
                <option value="legitimate" ${draft.outcome === 'legitimate' ? 'selected' : ''}>Penjelasan sah diterima</option>
                <option value="confirmed" ${draft.outcome === 'confirmed' ? 'selected' : ''}>Ketidaksesuaian terkonfirmasi</option>
              </select>
            </label>
            <label>
              Catatan verifikator &amp; rujukan ID bukti
              <textarea
                id="review-note"
                required
                maxlength="600"
                placeholder="Contoh: Meminta konfirmasi petugas RME mengenai sesi 9 sampai 12 dan bukti registrasi kunjungan…"
              >${safe(draft.note)}</textarea>
            </label>
          </div>
          <div class="review-form-actions">
            <button type="submit" class="button primary">Simpan Keputusan</button>
          </div>
        </form>
      </div>

      <div class="section-heading">
        <div>
          <h3>Riwayat Pemeriksaan</h3>
        </div>
      </div>
      <ul class="audit">
        ${ep.events
          .slice()
          .reverse()
          .map(
            (event) => `
            <li>
              <b>${safe(event.action)}</b>
              <span>${safe(event.actor)} · ${safe(formatTimestamp(event.at))}</span>
              <p>${safe(event.detail)}</p>
            </li>
          `
          )
          .join('')}
      </ul>
    </div>
  `;

  const syncBtn = detailEl.querySelector('#sync');
  if (syncBtn) syncBtn.addEventListener('click', () => handlers.onSyncEpisode(ep.episode_id));

  detailEl.querySelector('#open-ticket').addEventListener('click', () => {
    handlers.onOpenTicket(ep.episode_id);
  });

  detailEl.querySelector('#export-case').addEventListener('click', () => {
    handlers.onExportEvidence(ep);
  });

  detailEl.querySelectorAll('[data-select-session]').forEach((el) => {
    el.addEventListener('click', () => {
      handlers.onSelectSession(ep.episode_id, Number(el.dataset.selectSession));
    });
  });

  detailEl.querySelectorAll('[data-session-step]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextIdx = activeSessionIndex + Number(btn.dataset.sessionStep);
      if (nextIdx >= 1 && nextIdx <= sessions.length) {
        handlers.onSelectSession(ep.episode_id, nextIdx);
      }
    });
  });

  detailEl.querySelectorAll('[data-related]').forEach((btn) => {
    btn.addEventListener('click', () => handlers.onOpenEpisode(btn.dataset.related, 2));
  });

  const outcomeSelect = detailEl.querySelector('#outcome');
  const noteTextarea = detailEl.querySelector('#review-note');

  const syncDraft = () => {
    handlers.onUpdateDraft(ep.episode_id, outcomeSelect.value, noteTextarea.value);
  };
  outcomeSelect.addEventListener('change', syncDraft);
  noteTextarea.addEventListener('input', syncDraft);

  detailEl.querySelectorAll('[data-tpl]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tpl = REVIEW_TEMPLATES.find((t) => t.id === btn.dataset.tpl);
      if (!tpl) return;
      outcomeSelect.value = tpl.outcome;
      noteTextarea.value = tpl.note;
      syncDraft();
      noteTextarea.focus();
    });
  });

  detailEl.querySelector('#review-form').addEventListener('submit', (e) => {
    e.preventDefault();
    handlers.onSaveReview(ep.episode_id, outcomeSelect.value, noteTextarea.value);
  });
}

import { buildClarificationTicket, outcomeLabels, VERSION } from '../engine/jejakEngine.js';
import { safe, formatTimestamp } from '../utils/dom.js';

export function renderTicketModal(container, state, handlers) {
  if (!state.ticketEpisodeId) {
    container.hidden = true;
    container.innerHTML = '';
    return;
  }

  const ep = state.dataset.episodes.find((e) => e.episode_id === state.ticketEpisodeId);
  if (!ep) {
    container.hidden = true;
    container.innerHTML = '';
    return;
  }

  const ticket = buildClarificationTicket(ep, state.dataset.episodes);
  const { result, sessions } = ticket;

  container.hidden = false;
  container.innerHTML = `
    <div class="modal-backdrop" id="ticket-backdrop">
      <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="ticket-modal-title">
        <div class="modal-toolbar no-print">
          <div class="modal-toolbar-left">
            <span class="badge ${result.status}">${safe(result.label)}</span>
            <span class="muted">Pratinjau Dokumen Koordinasi Faskes (Simulasi)</span>
          </div>
          <div class="modal-toolbar-actions">
            <button type="button" class="button secondary small" id="ticket-copy">Salin Teks</button>
            <button type="button" class="button secondary small" id="ticket-json">Unduh JSON</button>
            <button type="button" class="button primary small" id="ticket-print">Cetak / Simpan PDF</button>
            <button type="button" class="button ghost small" id="ticket-close" aria-label="Tutup jendela tiket">✕</button>
          </div>
        </div>

        <div class="ticket-sheet" id="printable-ticket">
          <div class="ticket-sheet-header">
            <div>
              <p class="ticket-kicker">JEJAK JKN · DUKUNGAN VERIFIKASI KLAIM FISIOTERAPI (DATA SINTETIS)</p>
              <h2 id="ticket-modal-title">${safe(ticket.categoryTitle)}</h2>
              <p class="ticket-ref">No. Referensi: <strong>${safe(ticket.ticketNumber)}</strong> · Dibuat: ${safe(formatTimestamp(ticket.generatedAt))}</p>
            </div>
            <div class="ticket-stamp">
              <span>SIMULASI DEMO</span>
              <small>${safe(VERSION)}</small>
            </div>
          </div>

          <div class="ticket-meta-grid">
            <div>
              <span>Fasilitas Tujuan</span>
              <strong>${safe(ep.facility_name)} (${safe(ep.facility_id)})</strong>
            </div>
            <div>
              <span>ID Episode &amp; Klaim</span>
              <strong>${safe(ep.episode_id)} / ${safe(ep.claim_id)} (Rev. v${ep.claim_version})</strong>
            </div>
            <div>
              <span>Token Peserta</span>
              <strong>${safe(ep.patient_token)}</strong>
            </div>
            <div>
              <span>Periode &amp; Cakupan Sumber</span>
              <strong>${safe(ep.period)} · ${result.complete ? 'Batch Lengkap' : 'Batch Belum Lengkap'}</strong>
            </div>
          </div>

          <div class="ticket-section">
            <h3>1. Rincian Poin Permintaan Data / Klarifikasi</h3>
            <div class="ticket-items">
              ${ticket.items
                .map(
                  (item) => `
                  <div class="ticket-item">
                    <div class="ticket-item-head">
                      <span class="rule-code ${item.code === 'R0' ? 'code-r0' : item.code === 'OK' || item.code === 'INFO' ? 'code-ok' : ''}">${safe(item.code)}</span>
                      <strong>${safe(item.heading)}</strong>
                    </div>
                    <p>${safe(item.description)}</p>
                  </div>
                `
                )
                .join('')}
            </div>
          </div>

          <div class="ticket-section">
            <h3>2. Matriks Rujukan Sesi &amp; Bukti Sumber (${result.matched}/${result.claimed} Sesi Aktif Cocok)</h3>
            <table class="ticket-table">
              <thead>
                <tr>
                  <th>Sesi</th>
                  <th>ID Baris Klaim</th>
                  <th>Tgl Layanan</th>
                  <th>ID Catatan RME</th>
                  <th>Status Pencocokan</th>
                </tr>
              </thead>
              <tbody>
                ${sessions
                  .map(
                    (s) => `
                    <tr class="${s.cancelled ? 'row-muted' : ''}">
                      <td>Sesi ${s.sessionIndex}</td>
                      <td><code>${safe(s.claim.line_id)}</code></td>
                      <td>${safe(s.claim.service_date)}</td>
                      <td>${s.cancelled ? 'Dikecualikan (v2)' : s.record ? `<code>${safe(s.record.record_id)}</code>` : '<em>Belum tersedia</em>'}</td>
                      <td>${safe(s.stateLabel)}</td>
                    </tr>
                  `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>

          <div class="ticket-section">
            <h3>3. Catatan Tindak Lanjut Verifikator</h3>
            ${
              ep.review
                ? `
                  <div class="ticket-review-box">
                    <strong>Keputusan Pemeriksaan: ${safe(outcomeLabels[ep.review.outcome])}</strong>
                    <p>${safe(ep.review.note)}</p>
                    <small>Dicatat oleh ${safe(ep.review.actor)} pada ${safe(formatTimestamp(ep.review.at))}</small>
                  </div>
                `
                : `<p class="muted">Belum ada catatan tindak lanjut manual yang disimpan verifikator pada sesi demo ini.</p>`
            }
          </div>

          <div class="ticket-governance">
            <strong>Keterangan Tata Kelola &amp; Pelindungan Data:</strong>
            <ul>
              ${ticket.governanceNotes.map((note) => `<li>${safe(note)}</li>`).join('')}
            </ul>
          </div>
        </div>
      </div>
    </div>
  `;

  const close = () => handlers.onCloseTicket();
  container.querySelector('#ticket-close').addEventListener('click', close);
  container.querySelector('#ticket-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'ticket-backdrop') close();
  });

  container.querySelector('#ticket-copy').addEventListener('click', async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(ticket.plainText);
        handlers.onToast('Teks tiket klarifikasi disalin ke papan klip.');
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      handlers.onDownload(`${ep.episode_id}-tiket-klarifikasi.txt`, ticket.plainText, 'text/plain;charset=utf-8');
    }
  });

  container.querySelector('#ticket-json').addEventListener('click', () => {
    handlers.onExportEvidence(ep);
  });

  container.querySelector('#ticket-print').addEventListener('click', () => {
    window.print();
  });
}

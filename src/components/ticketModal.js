// @ts-check
import { buildClarificationTicket, outcomeLabels, VERSION } from '../engine/jejakEngine.js';
import { safe, formatTimestamp } from '../utils/dom.js';
import { realtimeDb } from '../services/realtimeDb.js';
import { authService } from '../services/authService.js';

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

  // Check if this ticket was already published to the room
  const roomEvents = realtimeDb.getRoomEvents();
  const isDispatched = roomEvents.some(
    (e) => e.type === 'ticket' && e.payload?.ticket_id === ticket.ticketNumber
  );

  // Check incoming replies for this ticket or episode
  const replies = roomEvents.filter(
    (e) =>
      e.type === 'ticket_reply' &&
      (e.payload?.ticket_id === ticket.ticketNumber || e.payload?.episode_id === ep.episode_id)
  );

  container.hidden = false;
  container.innerHTML = `
    <div class="modal-backdrop" id="ticket-backdrop">
      <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="ticket-modal-title">
        <div class="modal-toolbar no-print">
          <div class="modal-toolbar-left">
            <span class="badge ${result.status}">${safe(result.label)}</span>
            <span class="muted">Provider Coordination Document (Real-time)</span>
          </div>
          <div class="modal-toolbar-actions">
            <button type="button" class="button ${isDispatched ? 'secondary' : 'primary'} small" id="ticket-dispatch">
              ${isDispatched ? 'Resend to Provider' : 'Dispatch to Provider (Real-time)'}
            </button>
            <button type="button" class="button secondary small" id="ticket-copy">Copy Text</button>
            <button type="button" class="button secondary small" id="ticket-json">Export JSON</button>
            <button type="button" class="button secondary small" id="ticket-print">Print / PDF</button>
            <button type="button" class="button ghost small" id="ticket-close" aria-label="Tutup jendela tiket">✕</button>
          </div>
        </div>

        <div class="ticket-sheet" id="printable-ticket">
          <div class="ticket-sheet-header">
            <div>
              <p class="ticket-kicker">JEJAK JKN · CLAIM VERIFICATION AUDIT EVIDENCE</p>
              <h2 id="ticket-modal-title">${safe(ticket.categoryTitle)}</h2>
              <p class="ticket-ref">Reference No: <strong>${safe(ticket.ticketNumber)}</strong> · Generated: ${safe(
    formatTimestamp(ticket.generatedAt)
  )}</p>
            </div>
            <div class="ticket-stamp">
              <span>DEMO WORKBENCH</span>
              <small>${safe(VERSION)}</small>
            </div>
          </div>

          <div class="ticket-meta-grid">
            <div>
              <span>Target Facility</span>
              <strong>${safe(ep.facility_name)} (${safe(ep.facility_id)})</strong>
            </div>
            <div>
              <span>ID Episode &amp; Klaim</span>
              <strong>${safe(ep.episode_id)} / ${safe(ep.claim_id)} (Rev. v${ep.claim_version})</strong>
            </div>
            <div>
              <span>Patient Token</span>
              <strong>${safe(ep.patient_token)}</strong>
            </div>
            <div>
              <span>Periode &amp; Cakupan Sumber</span>
              <strong>${safe(ep.period)} · ${result.complete ? 'Complete Batch' : 'Incomplete Batch'}</strong>
            </div>
          </div>

          <div class="ticket-section">
            <h3>1. Clarification & Ingestion Inquiry Items</h3>
            <div class="ticket-items">
              ${ticket.items
                .map(
                  (item) => `
                  <div class="ticket-item">
                    <div class="ticket-item-head">
                      <span class="rule-code ${
                        item.code === 'R0'
                          ? 'code-r0'
                          : item.code === 'OK' || item.code === 'INFO'
                          ? 'code-ok'
                          : ''
                      }">${safe(item.code)}</span>
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
            <h3>2. Matriks Rujukan Sesi &amp; Bukti Sumber (${result.matched}/${result.claimed} Active Sessions Matched)</h3>
            <table class="ticket-table">
              <thead>
                <tr>
                  <th>Sesi</th>
                  <th>ID Baris Klaim</th>
                  <th>Service Date</th>
                  <th>EMR Record ID</th>
                  <th>Match Result</th>
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
                      <td>${
                        s.cancelled
                          ? 'Excluded (v2)'
                          : s.record
                          ? `<code>${safe(s.record.record_id)}</code>`
                          : '<em>Missing</em>'
                      }</td>
                      <td>${safe(s.stateLabel)}</td>
                    </tr>
                  `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>

          <div class="ticket-section">
            <h3>3. Auditor Review Decision Notes</h3>
            ${
              ep.review
                ? `
                  <div class="ticket-review-box">
                    <strong>Review Outcome: ${safe(outcomeLabels[ep.review.outcome])}</strong>
                    <p>${safe(ep.review.note)}</p>
                    <small>Recorded by ${safe(ep.review.actor)} on ${safe(formatTimestamp(ep.review.at))}</small>
                  </div>
                `
                : `<p class="muted">Belum ada catatan tindak lanjut manual yang disimpan verifikator on sesi demo ini.</p>`
            }
          </div>

          <div class="ticket-section">
            <h3>4. Komunikasi Dua Arah &amp; Tanggapan Petugas Faskes (Realtime)</h3>
            ${
              replies.length > 0
                ? `
                  <div class="ticket-reply-list">
                    ${replies
                      .map(
                        (r) => `
                        <div class="ticket-reply-item">
                          <div class="reply-header">
                            <strong>${safe(r.sender?.label || 'Petugas Faskes')}</strong>
                            <span class="muted text-xs">${safe(formatTimestamp(r.timestamp))}</span>
                          </div>
                          <p class="reply-text">${safe(r.payload?.reply_text || '')}</p>
                        </div>
                      `
                      )
                      .join('')}
                  </div>
                `
                : `
                  <div class="ticket-waiting-box">
                    <p class="muted">
                      ${
                        isDispatched
                          ? 'Ticket dispatched to provider portal. Awaiting hospital explanation or submission...'
                          : 'Click <strong>"Dispatch to Provider (Real-time)"</strong> in toolbar to send ticket to hospital staff.'
                      }
                    </p>
                  </div>
                `
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

  // Realtime Dispatch Button
  const dispatchBtn = container.querySelector('#ticket-dispatch');
  if (dispatchBtn) {
    dispatchBtn.addEventListener('click', async () => {
      const currentUser = authService.getCurrentUser();
      const payload = {
        ticket_id: ticket.ticketNumber,
        episode_id: ep.episode_id,
        facility_id: ep.facility_id,
        facility_name: ep.facility_name,
        patient_token: ep.patient_token,
        claim_count: result.claimed,
        matched_records: result.matched,
        missing_count: result.missing,
        category: ticket.categoryTitle,
        reason: ticket.items.map((i) => `[${i.code}] ${i.heading}: ${i.description}`).join(' | '),
        recommended_action: ticket.items[0]?.description || 'Mohon kirimkan bukti pendukung catatan pelayanan.',
        created_at: new Date().toISOString()
      };

      await realtimeDb.publish('ticket', payload, currentUser);
      handlers.onToast(
        `Ticket ${ticket.ticketNumber} dispatched to ${ep.facility_name} in real-time!`
      );
      renderTicketModal(container, state, handlers);
    });
  }

  container.querySelector('#ticket-copy').addEventListener('click', async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(ticket.plainText);
        handlers.onToast('Clarification ticket text copied to clipboard.');
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      handlers.onDownload(
        `${ep.episode_id}-tiket-klarifikasi.txt`,
        ticket.plainText,
        'text/plain;charset=utf-8'
      );
    }
  });

  container.querySelector('#ticket-json').addEventListener('click', () => {
    handlers.onExportEvidence(ep);
  });

  container.querySelector('#ticket-print').addEventListener('click', () => {
    window.print();
  });
}

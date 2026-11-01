import { inspectEpisode, outcomeLabels, VERSION } from '../engine/jejakEngine.js';
import { REVIEW_TEMPLATES } from '../data/pitchSteps.js';
import { safe, formatShortDayMonth, formatShortDate, formatTimestamp } from '../utils/dom.js';

const STATUS_SORT = { review: 0, incomplete: 1, consistent: 2 };

export function ensureWorkspaceShell(container, state, handlers) {
  if (container.dataset.mounted === 'workspace') return;
  container.dataset.mounted = 'workspace';

  container.innerHTML = `
    <section class="workspace" aria-label="Claims Verification Workbench">
      <aside class="queue-panel" aria-label="Claims Queue">
        <div class="panel-heading">
          <div>
            <h2>Claims Queue</h2>
          </div>
          <span id="queue-count" class="count-pill"></span>
        </div>

        <div class="queue-controls">
          <label class="search-label">
            <span class="sr-only">Search claims, patient, or facility</span>
            <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="m15.5 15.5 5 5"></path></svg>
            <input id="search" type="search" placeholder="Search claims, facilities..." value="${safe(state.query)}">
          </label>

          <div class="filters" id="filters" role="group" aria-label="Filter verification status"></div>

          <div class="sub-filters">
            <label class="compact-select">
              <span class="sr-only">Filter healthcare facility</span>
              <select id="facility-filter" aria-label="Filter healthcare facility">
                <option value="all">All Facilities (3 Hospitals)</option>
                <option value="RS Simulasi Aruna">RS Simulasi Aruna</option>
                <option value="RS Simulasi Bima">RS Simulasi Bima</option>
                <option value="RS Simulasi Cakra">RS Simulasi Cakra</option>
              </select>
            </label>
            <label class="compact-select">
              <span class="sr-only">Filter rule signals</span>
              <select id="signal-filter" aria-label="Filter rule signals">
                <option value="all">All Signals</option>
                <option value="R0">R0 · Incomplete Source</option>
                <option value="R1">R1 · Session Discrepancy</option>
                <option value="R2">R2 · Duplicate Clinical Text</option>
                <option value="cancelled">Cancelled Sessions (v2)</option>
                <option value="reviewed">Reviewed</option>
                <option value="unreviewed">Unreviewed</option>
              </select>
            </label>
          </div>
          <div id="active-filter-bar" class="active-filter-bar" hidden></div>
        </div>

        <div class="queue-list" id="queue-list" role="list"></div>
        <p class="queue-foot">40 claims · September 2026 audit period</p>
      </aside>

      <article class="detail-panel" id="detail" aria-label="Claim detail inspection"></article>
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
    ['all', 'All', statusCounts.all],
    ['review', 'Needs Review', statusCounts.review],
    ['incomplete', 'Missing Records', statusCounts.incomplete],
    ['consistent', 'Verified', statusCounts.consistent]
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
      <span>Active filters applied</span>
      <button type="button" class="link-btn" id="clear-filters">Reset filters</button>
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
        <strong>No matching claims found.</strong>
        <p>Adjust your search query or reset filters to display claims.</p>
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
              <span class="queue-status-dot dot-${r.status}" aria-hidden="true"></span>
              <strong class="queue-id">${safe(ep.episode_id)}</strong>
              ${ep.review ? '<span class="reviewed-dot" title="Review decision recorded">✓</span>' : ''}
            </span>
            <span class="badge ${r.status}">${safe(r.label)}</span>
          </span>
          <span class="queue-facility">${safe(ep.facility_name)} · <code>${safe(ep.patient_token)}</code></span>
          <span class="queue-progress-row">
            <span class="mini-bar"><i class="fill-${r.status}" style="width:${pct}%"></i></span>
            <span class="queue-ratio"><b>${r.matched}/${r.claimed}</b> sessions</span>
          </span>
          <span class="queue-tags">
            ${ruleCodes.map((c) => `<span class="q-tag tag-${c.toLowerCase()}">[${c}]</span>`).join('')}
            ${r.cancelled ? `<span class="q-tag tag-neutral">${r.cancelled} cancelled</span>` : ''}
            ${ep.late_records.length ? `<span class="q-tag tag-sync">+${ep.late_records.length} pending</span>` : ''}
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
          <span class="inspector-badge">Session ${session.sessionIndex} of ${totalSessions}</span>
          <h4>Reconciliation Ledger · ${safe(formatShortDate(claim.service_date))}</h4>
        </div>
        <div class="inspector-nav">
          <span class="session-state-pill pill-${session.state}">${safe(session.stateLabel)}</span>
          <button type="button" class="button ghost tiny" data-session-step="-1" ${session.sessionIndex <= 1 ? 'disabled' : ''} aria-label="Previous session">← Prev</button>
          <button type="button" class="button ghost tiny" data-session-step="1" ${session.sessionIndex >= totalSessions ? 'disabled' : ''} aria-label="Next session">Next →</button>
        </div>
      </div>

      <div class="inspector-grid">
        <div class="source-pane claim-pane">
          <div class="pane-head">
            <span class="pane-tag">Billed Claim</span>
            <span class="rev-chip">Revision v${claim.revision}</span>
          </div>
          <dl class="kv-grid">
            <div><dt>Claim Line ID</dt><dd><code>${safe(claim.line_id)}</code></dd></div>
            <div><dt>Billing Status</dt><dd><strong class="${claim.status === 'cancelled' ? 'text-muted' : 'text-ink'}">${claim.status === 'cancelled' ? 'Cancelled (Excluded)' : 'Active (Billed)'}</strong></dd></div>
            <div><dt>Service Date</dt><dd>${safe(claim.service_date)}</dd></div>
            <div><dt>Episode &amp; Patient</dt><dd>${safe(ep.episode_id)} · ${safe(ep.patient_token)}</dd></div>
          </dl>
          ${
            claim.status === 'cancelled'
              ? `<p class="pane-callout neutral">Officially cancelled in claim revision v${claim.revision}. Excluded from active session audit.</p>`
              : `<p class="pane-callout">Active billed session requires a completed clinical procedure record on the matching service date.</p>`
          }
        </div>

        <div class="source-pane rme-pane">
          <div class="pane-head">
            <span class="pane-tag">Clinical Record (EMR Procedure)</span>
            ${record ? `<span class="rev-chip">Version v${record.version}</span>` : `<span class="rev-chip missing-chip">No Matching Record</span>`}
          </div>
          ${
            record
              ? `
                <dl class="kv-grid">
                  <div><dt>EMR Record ID</dt><dd><code>${safe(record.record_id)}</code></dd></div>
                  <div><dt>Clinical Status</dt><dd><strong class="${record.status === 'completed' ? 'text-green' : 'text-muted'}">${safe(record.status)}${record.status === 'not-done' ? ' (Not completed)' : ''}</strong></dd></div>
                  <div><dt>Therapist &amp; System</dt><dd>${safe(record.therapist_token)} · ${safe(record.source_system)}</dd></div>
                  <div><dt>Ingestion Latency</dt><dd><span class="latency-chip ${latency?.isDelayed ? 'delayed' : ''}">${safe(latency?.label || '-')}</span></dd></div>
                </dl>
                <div class="timestamp-bar">
                  <span>Created: <code>${safe(formatTimestamp(record.created_at))}</code></span>
                  <span>Received: <code>${safe(formatTimestamp(record.received_at))}</code></span>
                </div>
                <div class="clinical-notes-split">
                  <div class="note-block template-block">
                    <div class="note-block-head">
                      <strong>Standard Protocol Template</strong>
                      <span class="note-rule-chip excluded">Standard Form</span>
                    </div>
                    <p>${safe(record.template_text)}</p>
                  </div>
                  <div class="note-block personal-block ${reusedPairs.length ? 'reused-highlight' : ''}">
                    <div class="note-block-head">
                      <strong>Individual Progress Assessment</strong>
                      <span class="note-rule-chip ${reusedPairs.length ? 'flagged' : 'checked'}">
                        ${normalizedPersonalLength} chars · ${reusedPairs.length ? 'Duplicate Flag (R2)' : 'Unique (R2)'}
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
                      ? 'No matching completed clinical record found (Session Discrepancy)'
                      : 'Pending delayed EMR batch transmission'
                  }</strong>
                  <p>${
                    inspection.result.complete
                      ? `Source batch from ${safe(ep.facility_name)} is complete, but no completed clinical record exists for Session ${session.sessionIndex} (${safe(claim.service_date)}).`
                      : `Transmission batch for ${safe(ep.episode_id)} is incomplete. Session ${session.sessionIndex} discrepancy is pending.`
                  }</p>
                  ${
                    queuedLateRecord
                      ? `<div class="late-preview-hint">Delayed record <code>${safe(queuedLateRecord.record_id)}</code> available in simulation connector. Click <b>Sync</b> above to ingest.</div>`
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
                ? `<span class="human-pill outcome-${safe(ep.review.outcome)}">Review: ${safe(outcomeLabels[ep.review.outcome])}</span>`
                : ''
            }
          </div>
          <p class="detail-meta">
            <strong>${safe(ep.facility_name)}</strong> (${safe(ep.facility_id)}) · Patient <code>${safe(ep.patient_token)}</code> · ${safe(ep.period)}
          </p>
        </div>

        <div class="detail-actions">
          ${
            ep.late_records.length
              ? `<button type="button" id="sync" class="button accent">Sync ${ep.late_records.length} Delayed Records</button>`
              : ''
          }
          <button type="button" id="open-ticket" class="button secondary">Clarification Ticket</button>
          <button type="button" id="export-case" class="button secondary">Export JSON</button>
        </div>
      </div>

      <div class="detail-snapshot">
        <span>Rule Engine: <b>${safe(VERSION)}</b></span>
        <span>Claim Revision: <b>v${ep.claim_version}</b></span>
        <span>Source Status: <b>${r.complete ? 'Complete' : 'Missing Data'}</b></span>
        <span>Received: <b>${safe(formatTimestamp(ep.source_received_at))}</b></span>
      </div>
    </div>

    <div class="content-pad">
      <!-- 3-Column Verification Checkpoints (R0, R1, R2) -->
      <div class="gate-pipeline" aria-label="Rule verification stages">
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

      ${
        r.status === 'consistent'
          ? `<div class="consistent-note">
               <strong>Verified: All claim sessions match hospital clinical records.</strong>
               <span>All active billed sessions have completed clinical records with no cross-patient text duplication.</span>
             </div>`
          : ''
      }

      <div class="evidence-metrics">
        <div class="mini-metric">
          <span>Active Billed Sessions</span>
          <strong>${r.claimed}</strong>
          <small>${r.cancelled ? `${r.cancelled} cancelled excluded` : 'Audit units'}</small>
        </div>
        <div class="mini-metric metric-ok">
          <span>Matched EMR Records</span>
          <strong>${r.matched}</strong>
          <small>${r.claimed ? Math.round((r.matched / r.claimed) * 100) : 100}% paired with EMR</small>
        </div>
        <div class="mini-metric ${r.missing ? (r.complete ? 'metric-warn' : 'metric-info') : ''}">
          <span>${r.complete ? 'Discrepant Sessions' : 'Pending Sessions'}</span>
          <strong>${r.missing}</strong>
          <small>${r.missing_indexes.length ? `Sessions: ${r.missing_indexes.join(', ')}` : 'No active discrepancies'}</small>
        </div>
      </div>

      <div class="section-heading">
        <div>
          <h3>Session Timeline</h3>
        </div>
        <div class="legend">
          <span class="leg-has">Matched</span>
          <span class="leg-missing">Clarification</span>
          <span class="leg-waiting">Missing Data</span>
          <span class="leg-reused">Duplicate (R2)</span>
          <span class="leg-cancelled">Cancelled</span>
        </div>
      </div>

      <div class="session-grid" role="listbox" aria-label="Select therapy session to inspect">
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
              <span class="session-num">Session ${s.sessionIndex}</span>
              <small class="session-date">${safe(formatShortDayMonth(s.claim.service_date))}</small>
              <small class="session-status">${safe(s.shortStatus)}</small>
              <code class="session-rec">${s.cancelled ? 'v2 cancelled' : s.record ? safe(s.record.record_id) : '—'}</code>
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
                <h3>Cross-Episode Duplicate Clinical Notes (R2)</h3>
              </div>
            </div>
            <div class="r2-diff-list">
              ${r.reused
                .map(
                  (pair) => `
                  <div class="r2-diff-card">
                    <div class="r2-diff-columns">
                      <div class="r2-col">
                        <span class="r2-col-label">Current Claim</span>
                        <strong>${safe(ep.episode_id)} · ${safe(ep.patient_token)}</strong>
                        <small>${safe(ep.facility_name)} · Record <code>${safe(pair.record_id)}</code> (Session ${pair.session_index || 2})</small>
                      </div>
                      <div class="r2-connector" aria-hidden="true"><span class="r2-badge">Duplicate Match (R2)</span></div>
                      <div class="r2-col linked">
                        <span class="r2-col-label">Disparate Patient Record</span>
                        <strong>${safe(pair.other_episode_id)} · ${safe(pair.other_patient_token)}</strong>
                        <small>${safe(pair.other_facility_name || 'Hospital')} · Record <code>${safe(pair.other_record_id)}</code></small>
                        <button type="button" class="button secondary tiny r2-jump" data-related="${safe(pair.other_episode_id)}">Open ${safe(pair.other_episode_id)} →</button>
                      </div>
                    </div>
                    <div class="r2-shared-text">
                      <span>Identical clinical progress text detected:</span>
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
          <span>All Sessions Audit Ledger (${sessions.length} rows)</span>
        </summary>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Session</th>
                <th scope="col">Claim Line ID</th>
                <th scope="col">Service Date</th>
                <th scope="col">EMR Record ID</th>
                <th scope="col">Therapist &amp; Version</th>
                <th scope="col">Match Status</th>
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
                    <td><b>Session ${s.sessionIndex}</b></td>
                    <td><code>${safe(s.claim.line_id)}</code></td>
                    <td>${safe(s.claim.service_date)}</td>
                    <td>${s.cancelled ? 'Excluded' : s.record ? `<code>${safe(s.record.record_id)}</code>` : '<span class="muted">Missing</span>'}</td>
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
            <h3>Auditor Review Decision</h3>
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
          <span class="template-caption">Quick Templates:</span>
          ${REVIEW_TEMPLATES.map(
            (tpl) => `
              <button type="button" class="chip-btn" data-tpl="${safe(tpl.id)}">${safe(tpl.label)}</button>
            `
          ).join('')}
        </div>

        <form id="review-form">
          <div class="review-controls">
            <label>
              Review Outcome
              <select id="outcome">
                <option value="pending" ${draft.outcome === 'pending' ? 'selected' : ''}>Request additional evidence</option>
                <option value="legitimate" ${draft.outcome === 'legitimate' ? 'selected' : ''}>Accept provider explanation</option>
                <option value="confirmed" ${draft.outcome === 'confirmed' ? 'selected' : ''}>Confirm discrepancy (reject claim)</option>
              </select>
            </label>
            <label>
              Auditor notes &amp; evidence rationale
              <textarea
                id="review-note"
                required
                maxlength="600"
                placeholder="Enter audit review findings and reference claim session IDs..."
              >${safe(draft.note)}</textarea>
            </label>
          </div>
          <div class="review-form-actions">
            <button type="submit" class="button primary">Save Decision</button>
          </div>
        </form>
      </div>

      <div class="section-heading">
        <div>
          <h3>Audit History &amp; Event Log</h3>
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

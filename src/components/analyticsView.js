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
    <section class="analytics-view" aria-label="Healthcare provider and portfolio analytics">
      <div class="analytics-grid-top">
        <div class="card portfolio-card">
          <div class="card-head">
            <div>
              <span class="eyebrow-sm">PORTFOLIO DISTRIBUTION</span>
              <h2>Claim Evidence Readiness Summary</h2>
            </div>
            ${
              totals.pendingSyncEpisodes > 0
                ? `<button type="button" class="button accent small" id="sync-all-btn">Sync Delayed Records (${totals.pendingSyncEpisodes} Claims)</button>`
                : `<span class="synced-all-badge">All Records Synced</span>`
            }
          </div>

          <div class="portfolio-visual-row">
            <div class="donut-wrap">
              ${buildDonutSvg(totals.consistent, totals.review, totals.incomplete)}
              <div class="donut-legend">
                <div><i class="dot-consistent"></i><span>Verified valid</span><b>${totals.consistent} claims (${Math.round((totals.consistent / totals.episodes) * 100)}%)</b></div>
                <div><i class="dot-review"></i><span>Needs review</span><b>${totals.review} claims (${Math.round((totals.review / totals.episodes) * 100)}%)</b></div>
                <div><i class="dot-incomplete"></i><span>Missing records</span><b>${totals.incomplete} claims (${Math.round((totals.incomplete / totals.episodes) * 100)}%)</b></div>
              </div>
            </div>

            <div class="session-coverage-box">
              <div class="coverage-top">
                <div>
                  <span class="muted">Active Session Coverage</span>
                  <strong class="coverage-big">${totals.matchedSessions} / ${totals.claimedSessions} <span>matched (${totals.matchRate}%)</span></strong>
                </div>
                <span class="muted">${totalAllClaimLines} total claim lines (${totals.cancelledSessions} cancelled)</span>
              </div>

              <div class="stacked-bar" role="img" aria-label="Session match distribution">
                <span class="seg-matched" style="width:${pctMatched}%" title="Matched: ${totals.matchedSessions}"></span>
                <span class="seg-clarify" style="width:${pctClarify}%" title="Needs review: ${totals.missingClarificationSessions}"></span>
                <span class="seg-waiting" style="width:${pctWaiting}%" title="Pending records (R0): ${totals.waitingDataSessions}"></span>
                <span class="seg-cancelled" style="width:${pctCancelled}%" title="Cancelled (v2): ${totals.cancelledSessions}"></span>
              </div>

              <div class="session-stat-chips">
                <div class="s-chip ok"><b>${totals.matchedSessions}</b><span>Matched active sessions</span></div>
                <div class="s-chip warn"><b>${totals.missingClarificationSessions}</b><span>Discrepant sessions (R1)</span></div>
                <div class="s-chip info"><b>${totals.waitingDataSessions}</b><span>Pending records (R0)</span></div>
                <div class="s-chip neutral"><b>${totals.cancelledSessions}</b><span>Cancelled (v2)</span></div>
              </div>
            </div>
          </div>
        </div>

        <div class="card governance-card">
          <span class="eyebrow-sm">AUDITOR REVIEW PROGRESS</span>
          <h2>Review Decisions</h2>
          <p class="muted">Human adjudication decisions stored separately from rule engine status.</p>

          <div class="gov-progress-num">
            <strong>${totals.reviewedCount}<span>/${totals.episodes}</span></strong>
            <small>claims reviewed in current session</small>
          </div>

          <div class="gov-list">
            <div class="gov-row">
              <span>Request additional evidence</span>
              <b>${reviewOutcomes.pending}</b>
            </div>
            <div class="gov-row">
              <span>Accept provider explanation</span>
              <b>${reviewOutcomes.legitimate}</b>
            </div>
            <div class="gov-row">
              <span>Confirm discrepancy</span>
              <b>${reviewOutcomes.confirmed}</b>
            </div>
            <div class="gov-row muted-row">
              <span>Pending review</span>
              <b>${reviewOutcomes.unreviewed}</b>
            </div>
          </div>

          <button type="button" class="button secondary full-btn" id="open-priority-queue">
            Open Clarification Queue (${totals.review}) →
          </button>
        </div>
      </div>

      <div class="section-heading">
        <div>
          <h2>Healthcare Provider Performance</h2>
          <span class="sub-caption">Click a facility to filter claims in the verification queue</span>
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
                  <span class="fac-rate">${f.matchRate}% <span>matched</span></span>
                </div>

                <div class="stacked-bar compact-bar" title="Consistent ${f.consistent}, Review ${f.review}, Data ${f.incomplete}">
                  <span class="seg-matched" style="width:${pCons}%"></span>
                  <span class="seg-clarify" style="width:${pRev}%"></span>
                  <span class="seg-waiting" style="width:${pInc}%"></span>
                </div>

                <div class="fac-metrics">
                  <div><span>Total Claims</span><strong>${f.episodes}</strong></div>
                  <div><span>Needs Review</span><strong class="text-warn">${f.review}</strong></div>
                  <div><span>Missing Data</span><strong class="text-info">${f.incomplete}</strong></div>
                  <div><span>Verified</span><strong class="text-green">${f.consistent}</strong></div>
                </div>

                <div class="fac-foot-meta">
                  <span>Active matched sessions: <b>${f.matchedSessions}/${f.claimedSessions}</b></span>
                  <span>${f.pendingSyncEpisodes ? `${f.pendingSyncEpisodes} pending batches` : 'Complete batches'}</span>
                </div>

                <button type="button" class="button secondary small full-btn" data-open-facility="${safe(f.facility_name)}">
                  View ${safe(f.facility_name)} Queue →
                </button>
              </div>
            `;
          })
          .join('')}
      </div>

      <div class="section-heading">
        <div>
          <h2>Rule Engine Evaluation Signals (${safe(VERSION)})</h2>
          <span class="sub-caption">Click any claim chip to inspect session evidence</span>
        </div>
      </div>

      <div class="rules-analytics-grid">
        <div class="card rule-stat-card border-r0">
          <div class="rule-stat-top">
            <span class="rule-code code-r0">R0</span>
            <strong>Source Records Integrity</strong>
            <span class="rule-count-pill">${rules.r0Episodes.length} claims</span>
          </div>
          <p>Flags delayed transmission batches or identity token errors before final session discrepancy evaluation.</p>
          <div class="ep-chip-list">
            ${
              rules.r0Episodes.length
                ? rules.r0Episodes
                    .map((id) => `<button type="button" class="ep-chip" data-jump-episode="${safe(id)}">${safe(id)}</button>`)
                    .join('')
                : '<span class="muted">All claims passed source integrity checkpoint.</span>'
            }
          </div>
        </div>

        <div class="card rule-stat-card border-r1">
          <div class="rule-stat-top">
            <span class="rule-code">R1</span>
            <strong>Session Matching Discrepancies</strong>
            <span class="rule-count-pill">${rules.r1Episodes.length} claims</span>
          </div>
          <p>Matches active billed sessions against completed EMR procedure records on matching service dates.</p>
          <div class="ep-chip-list">
            ${rules.r1Episodes
              .map((id) => `<button type="button" class="ep-chip" data-jump-episode="${safe(id)}">${safe(id)}</button>`)
              .join('')}
          </div>
        </div>

        <div class="card rule-stat-card border-r2">
          <div class="rule-stat-top">
            <span class="rule-code">R2</span>
            <strong>Cross-Episode Duplicate Progress Notes</strong>
            <span class="rule-count-pill">${rules.r2Episodes.length} claims (${rules.r2Pairs.length} pairs)</span>
          </div>
          <p>Detects identical individual clinical progress text (≥60 normalized chars) across disparate patients.</p>
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
            <strong>Official Cancellations &amp; Versions</strong>
            <span class="rule-count-pill">${rules.cancelledEpisodes.length} claims</span>
          </div>
          <p>Correctly excludes officially cancelled sessions and references latest record revisions.</p>
          <div class="ep-chip-list">
            ${rules.cancelledEpisodes
              .map(
                (id) =>
                  `<button type="button" class="ep-chip ok-chip" data-jump-episode="${safe(id)}" data-jump-session="5">${safe(id)} (2 cancelled excluded)</button>`
              )
              .join('')}
          </div>
        </div>
      </div>

      <div class="card arch-card">
        <div class="card-head">
          <div>
            <span class="eyebrow-sm">TARGET ARCHITECTURE &amp; INTEROPERABILITY</span>
            <h2>JEJAK JKN Processing Pipeline &amp; SATUSEHAT FHIR Standards</h2>
          </div>
          <span class="arch-note-pill">Interactive In-Browser Simulation · Pilot EMR Connector</span>
        </div>

        <div class="arch-flow-diagram" role="img" aria-label="Processing pipeline diagram">
          <div class="arch-stage">
            <span class="stage-num">1. Authorized Data Sources</span>
            <strong>Claims, Encounters &amp; Procedures</strong>
            <small>Includes cancellations &amp; ingestion timestamps</small>
            <div class="fhir-pills"><span>Encounter</span><span>Procedure</span><span>ChargeItem</span><span>Claim</span></div>
          </div>
          <div class="arch-arrow" aria-hidden="true">→</div>
          <div class="arch-stage">
            <span class="stage-num">2. Tokenization &amp; Privacy</span>
            <strong>Tokenized Patient Identifiers</strong>
            <small>Complies with data privacy regulations (UU PDP)</small>
          </div>
          <div class="arch-arrow" aria-hidden="true">→</div>
          <div class="arch-stage highlight-r0">
            <span class="stage-num">3. Source Integrity (R0)</span>
            <strong>Source Completeness Check</strong>
            <small>Pending batches hold discrepancy evaluation</small>
          </div>
          <div class="arch-arrow" aria-hidden="true">→</div>
          <div class="arch-stage highlight-r12">
            <span class="stage-num">4. Rule Evaluation (R1 &amp; R2)</span>
            <strong>Session Match &amp; Duplicate Check</strong>
            <small>Excludes cancelled sessions &amp; standard templates</small>
          </div>
          <div class="arch-arrow" aria-hidden="true">→</div>
          <div class="arch-stage highlight-gov">
            <span class="stage-num">5. Auditor Workbench</span>
            <strong>Reconciliation Ledger &amp; Review</strong>
            <small>Adjudication decisions recorded with full audit trail</small>
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

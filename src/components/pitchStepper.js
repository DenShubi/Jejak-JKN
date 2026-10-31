import { PITCH_STEPS } from '../data/pitchSteps.js';
import { safe } from '../utils/dom.js';

export function renderPitchStepper(container, state, handlers) {
  if (!state.pitchOpen) {
    container.hidden = true;
    container.innerHTML = '';
    return;
  }

  container.hidden = false;
  const current = PITCH_STEPS[state.pitchIndex] || PITCH_STEPS[0];
  const ep = state.dataset.episodes.find((e) => e.episode_id === current.episodeId);

  let canRunStepAction = false;
  let stepActionDoneText = '';

  if (current.actionType === 'sync' && ep) {
    canRunStepAction = ep.late_records.length > 0;
    if (!canRunStepAction) stepActionDoneText = 'Catatan terlambat sudah disinkronkan';
  } else if (current.actionType === 'open-related' || current.actionType === 'demo-review') {
    canRunStepAction = true;
  }

  container.innerHTML = `
    <div class="pitch-bar" role="region" aria-label="Panduan alur presentasi 4 menit">
      <div class="pitch-top">
        <div class="pitch-title-group">
          <span class="pitch-pill">MODE PRESENTASI JURI · ${safe(current.timeRange)}</span>
          <strong class="pitch-step-title">Langkah ${current.step}/7 — ${safe(current.title)}</strong>
        </div>
        <div class="pitch-dots" role="tablist" aria-label="Pilih langkah presentasi">
          ${PITCH_STEPS.map(
            (s, idx) => `
              <button
                type="button"
                class="pitch-dot ${idx === state.pitchIndex ? 'active' : ''}"
                data-pitch-step="${idx}"
                aria-label="Langkah ${s.step}: ${safe(s.title)}"
                aria-selected="${idx === state.pitchIndex}"
                title="${safe(s.timeRange)} · ${safe(s.title)}"
              >${s.step}</button>
            `
          ).join('')}
        </div>
        <button type="button" class="pitch-close" id="pitch-close" aria-label="Tutup panduan presentasi">Tutup ✕</button>
      </div>

      <div class="pitch-body">
        <div class="pitch-copy">
          <p class="pitch-script">${safe(current.script)}</p>
          <p class="pitch-hint"><span>Fokus pesan:</span> ${safe(current.highlight)}</p>
        </div>
        <div class="pitch-controls">
          ${
            current.actionLabel
              ? canRunStepAction
                ? `<button type="button" class="button accent small" id="pitch-run-action">${safe(current.actionLabel)}</button>`
                : `<span class="pitch-done-chip">✓ ${safe(stepActionDoneText)}</span>`
              : ''
          }
          <div class="pitch-nav-btns">
            <button type="button" class="button secondary small" id="pitch-prev" ${state.pitchIndex === 0 ? 'disabled' : ''}>← Sebelumnya</button>
            <button type="button" class="button primary small" id="pitch-next" ${state.pitchIndex === PITCH_STEPS.length - 1 ? 'disabled' : ''}>Berikutnya →</button>
          </div>
        </div>
      </div>
    </div>
  `;

  container.querySelectorAll('[data-pitch-step]').forEach((btn) => {
    btn.addEventListener('click', () => handlers.onGoStep(Number(btn.dataset.pitchStep)));
  });

  const prevBtn = container.querySelector('#pitch-prev');
  const nextBtn = container.querySelector('#pitch-next');
  const closeBtn = container.querySelector('#pitch-close');
  const actionBtn = container.querySelector('#pitch-run-action');

  if (prevBtn) prevBtn.addEventListener('click', () => handlers.onGoStep(state.pitchIndex - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => handlers.onGoStep(state.pitchIndex + 1));
  if (closeBtn) closeBtn.addEventListener('click', () => handlers.onClosePitch());
  if (actionBtn) actionBtn.addEventListener('click', () => handlers.onStepAction(current));
}

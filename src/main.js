// @ts-check
import './styles/main.css';
import { JejakEngine } from './engine/jejakEngine.js';
import { PITCH_STEPS, REVIEW_TEMPLATES } from './data/pitchSteps.js';
import { renderPitchStepper } from './components/pitchStepper.js';
import { renderTicketModal } from './components/ticketModal.js';
import {
  ensureWorkspaceShell,
  renderQueuePanel,
  renderEpisodeDetail
} from './components/workspaceView.js';
import { renderAnalyticsView } from './components/analyticsView.js';
import { createFaskesPortal } from './components/faskesPortal.js';
import { openConnectionModal } from './components/connectionModal.js';
import { liveAlert } from './components/liveAlert.js';
import { authService } from './services/authService.js';
import { realtimeDb } from './services/realtimeDb.js';
import { applySubmission, applyReview } from './engine/ingest.js';
import { safe } from './utils/dom.js';

function initJejakApp() {
  const E = JejakEngine;

  // 1. Initialize Auth and Room
  const initialUser = authService.init();
  const initialRoom = authService.getCurrentRoom();

  const state = {
    dataset: E.makeDataset(),
    view: initialUser.role === 'faskes' ? 'faskes' : 'workspace',
    selected: 'EP-002',
    selectedSessionByEpisode: {},
    reviewDrafts: {},
    filter: 'all',
    facilityFilter: 'all',
    signalFilter: 'all',
    query: '',
    pitchOpen: false,
    pitchIndex: 0,
    ticketEpisodeId: null
  };

  let activeFaskesPortal = null;
  let toastTimer = null;
  const $ = (id) => document.getElementById(id);

  function evaluations() {
    return state.dataset.episodes.map((ep) => ({
      ep,
      r: E.evaluate(ep, state.dataset.episodes)
    }));
  }

  function toast(msg) {
    const el = $('toast');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.hidden = true;
    }, 4000);
  }

  function download(name, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
    toast(`Berkas ${name} berhasil disiapkan.`);
  }

  function caseEvidence(ep) {
    return {
      synthetic: true,
      exported_at: new Date().toISOString(),
      rule_version: E.VERSION,
      episode: {
        ...ep,
        late_records: undefined,
        scenario_label: undefined
      },
      result: E.evaluate(ep, state.dataset.episodes),
      limitations:
        'Kartu ini berisi data sintetis dan log sesi browser. Ini bukan bukti audit produksi atau keputusan fraud.'
    };
  }

  function exportCaseEvidence(ep) {
    download(
      `${ep.episode_id}-kartu-bukti.json`,
      JSON.stringify(caseEvidence(ep), null, 2),
      'application/json'
    );
  }

  function renderStats(items) {
    const statsContainer = $('stats');
    if (!statsContainer) return;

    if (state.view === 'faskes') {
      statsContainer.style.display = 'none';
      return;
    }
    statsContainer.style.display = 'grid';

    const count = (status) => items.filter((x) => x.r.status === status).length;
    const reviewedCount = items.filter((x) => Boolean(x.ep.review)).length;
    const pendingLateCount = items.filter((x) => x.ep.late_records.length > 0).length;
    const total = items.length;

    const cards = [
      {
        key: 'all',
        cls: '',
        title: 'Episode diperiksa',
        value: total,
        pct: `${reviewedCount}/${total} ditinjau`,
        sub: 'Klik untuk tampilkan seluruh episode'
      },
      {
        key: 'review',
        cls: 'review',
        title: 'Perlu klarifikasi',
        value: count('review'),
        pct: `${Math.round((count('review') / total) * 100)}%`,
        sub: 'Sumber lengkap, ada selisih R1 / sinyal R2'
      },
      {
        key: 'incomplete',
        cls: 'incomplete',
        title: 'Lengkapi data',
        value: count('incomplete'),
        pct: pendingLateCount ? `${pendingLateCount} siap sinkron` : '0 tunda',
        sub: 'Gerbang R0: selisih masih sementara'
      },
      {
        key: 'consistent',
        cls: 'consistent',
        title: 'Bukti konsisten',
        value: count('consistent'),
        pct: `${Math.round((count('consistent') / total) * 100)}%`,
        sub: 'Tagihan aktif & catatan saling cocok'
      }
    ];

    statsContainer.innerHTML = cards
      .map(
        (c) => `
        <button
          type="button"
          class="stat ${c.cls} ${state.view === 'workspace' && state.filter === c.key ? 'active-kpi' : ''}"
          data-kpi-filter="${c.key}"
        >
          <div class="stat-top">
            <span class="stat-label">${safe(c.title)}</span>
            <span class="stat-pct">${safe(c.pct)}</span>
          </div>
          <div class="stat-value">${c.value}</div>
          <div class="stat-foot">${safe(c.sub)}</div>
        </button>
      `
      )
      .join('');

    statsContainer.querySelectorAll('[data-kpi-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.view = 'workspace';
        state.filter = btn.dataset.kpiFilter;
        render();
      });
    });

    const badgeEl = $('tab-queue-badge');
    if (badgeEl) badgeEl.textContent = String(count('review') + count('incomplete'));
  }

  function updateHeaderAndNav() {
    const user = authService.getCurrentUser();
    const connState = realtimeDb.getConnectionState();

    // User Profile Chip
    const userAvatar = $('user-avatar');
    const userName = $('user-name');
    if (userAvatar && userName) {
      if (user.role === 'verifikator') {
        userAvatar.textContent = 'VB';
        userName.textContent = user.fullName || 'Verifikator BPJS';
      } else {
        userAvatar.textContent = 'RS';
        userName.textContent = user.facilityName || user.fullName || 'Petugas Faskes';
      }
    }

    // Connection Pill
    const connPill = $('btn-conn-settings');
    const connText = $('conn-status-text');
    if (connText && connPill) {
      if (connState.connected) {
        if (connState.mode === 'supabase') {
          connText.textContent = `Cloud: ${connState.room}`;
          connPill.className = 'conn-pill conn-pill-supabase';
        } else {
          connText.textContent = `Lokal: ${connState.room}`;
          connPill.className = 'conn-pill conn-pill-local';
        }
      } else {
        connText.textContent = `Terputus: ${connState.room}`;
        connPill.className = 'conn-pill conn-pill-off';
      }
    }

    // Tab buttons
    document.querySelectorAll('[data-view]').forEach((btn) => {
      const active = btn.dataset.view === state.view;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });

    // Pitch button
    const pitchBtn = $('toggle-pitch');
    if (pitchBtn) {
      pitchBtn.classList.toggle('active', state.pitchOpen);
      pitchBtn.setAttribute('aria-pressed', String(state.pitchOpen));
      pitchBtn.textContent = state.pitchOpen
        ? '▾ Tutup Panduan Presentasi'
        : '▶ Panduan Presentasi (4 Menit)';
    }

    // Hide/show page banner for Faskes view to give clean mobile feel
    const banner = document.querySelector('.page-banner');
    if (banner) {
      banner.style.display = state.view === 'faskes' ? 'none' : 'grid';
    }
  }

  const handlers = {
    onFilterChange(patch, opts = {}) {
      Object.assign(state, patch);
      if (opts.queueOnly && state.view === 'workspace') {
        const items = evaluations();
        renderStats(items);
        renderQueuePanel($('view-root'), items, state, handlers);
      } else {
        render();
      }
    },
    onOpenEpisode(id, sessionIndex) {
      openEpisode(id, sessionIndex);
    },
    onSelectSession(episodeId, sessionIndex) {
      state.selectedSessionByEpisode[episodeId] = sessionIndex;
      if (state.view === 'workspace') {
        renderEpisodeDetail($('view-root'), state, handlers);
      }
    },
    onSyncEpisode(id) {
      syncEpisode(id);
    },
    onSyncAllLate() {
      syncAllLate();
    },
    onUpdateDraft(episodeId, outcome, note) {
      state.reviewDrafts[episodeId] = { outcome, note };
    },
    onSaveReview(episodeId, outcome, note) {
      saveReview(episodeId, outcome, note);
    },
    onOpenTicket(episodeId) {
      state.ticketEpisodeId = episodeId;
      renderTicketModal($('ticket-modal-root'), state, handlers);
    },
    onCloseTicket() {
      state.ticketEpisodeId = null;
      renderTicketModal($('ticket-modal-root'), state, handlers);
    },
    onExportEvidence(ep) {
      exportCaseEvidence(ep);
    },
    onJumpToFilter(filterPatch) {
      state.view = 'workspace';
      Object.assign(state, filterPatch);
      render();
    },
    onGoStep(nextIdx) {
      goToPitchStep(nextIdx);
    },
    onClosePitch() {
      state.pitchOpen = false;
      updateHeaderAndNav();
      renderPitchStepper($('pitch-root'), state, handlers);
    },
    onStepAction(stepDef) {
      if (stepDef.actionType === 'sync') {
        syncEpisode(stepDef.episodeId);
      } else if (stepDef.actionType === 'open-related' && stepDef.relatedEpisodeId) {
        openEpisode(stepDef.relatedEpisodeId, 2);
      } else if (stepDef.actionType === 'demo-review') {
        const tpl = REVIEW_TEMPLATES[0];
        const ep = state.dataset.episodes.find((e) => e.episode_id === stepDef.episodeId);
        if (ep && !ep.review) {
          saveReview(stepDef.episodeId, tpl.outcome, tpl.note);
        }
        state.ticketEpisodeId = stepDef.episodeId;
        renderTicketModal($('ticket-modal-root'), state, handlers);
      }
    },
    onToast: toast,
    onDownload: download
  };

  function render() {
    const items = evaluations();
    updateHeaderAndNav();
    renderPitchStepper($('pitch-root'), state, handlers);
    renderStats(items);

    const viewRoot = $('view-root');

    // Clean up active portal if switching away
    if (state.view !== 'faskes' && activeFaskesPortal) {
      activeFaskesPortal.destroy();
      activeFaskesPortal = null;
    }

    if (state.view === 'faskes') {
      viewRoot.innerHTML = '';
      activeFaskesPortal = createFaskesPortal({
        dataset: state.dataset,
        onDatasetUpdated: () => {
          render();
        },
        onOpenConnectionModal: () => {
          openConnectionModal({
            onResetRoom: () => resetToBaseline(),
            onReloadApp: () => render()
          });
        },
        onSwitchToVerifikator: () => {
          authService.loginAs('verifikator');
          state.view = 'workspace';
          render();
        }
      });
      viewRoot.appendChild(activeFaskesPortal.element);
    } else if (state.view === 'analytics') {
      renderAnalyticsView(viewRoot, state, handlers);
    } else {
      ensureWorkspaceShell(viewRoot, state, handlers);
      renderQueuePanel(viewRoot, items, state, handlers);
      renderEpisodeDetail(viewRoot, state, handlers);
    }

    renderTicketModal($('ticket-modal-root'), state, handlers);
  }

  function openEpisode(id, sessionIndex) {
    const ep = state.dataset.episodes.find((item) => item.episode_id === id);
    if (!ep) throw new Error('Episode tidak ditemukan.');
    state.selected = id;
    state.view = 'workspace';
    if (typeof sessionIndex === 'number') {
      state.selectedSessionByEpisode[id] = sessionIndex;
    }
    render();
    return {
      episode_id: id,
      result: E.evaluate(ep, state.dataset.episodes)
    };
  }

  function syncEpisode(id) {
    const ep = state.dataset.episodes.find((item) => item.episode_id === id);
    if (!ep) throw new Error('Episode tidak ditemukan.');
    if (!E.sync(ep)) throw new Error('Tidak ada catatan terlambat.');
    state.selected = id;
    delete state.selectedSessionByEpisode[id];
    render();
    toast(`Catatan terlambat ${id} disinkronkan. Hasil aturan telah dihitung ulang.`);
    return {
      episode_id: id,
      result: E.evaluate(ep, state.dataset.episodes)
    };
  }

  function syncAllLate() {
    let syncedEpisodes = 0;
    state.dataset.episodes.forEach((ep) => {
      if (E.sync(ep)) {
        syncedEpisodes += 1;
        delete state.selectedSessionByEpisode[ep.episode_id];
      }
    });
    render();
    toast(
      syncedEpisodes
        ? `${syncedEpisodes} episode terlambat disinkronkan. Portofolio telah dihitung ulang.`
        : 'Seluruh batch terlambat sudah disinkronkan sebelumnya.'
    );
    return syncedEpisodes;
  }

  function saveReview(id, outcome, note) {
    const ep = state.dataset.episodes.find((item) => item.episode_id === id);
    const clean = String(note || '').trim();
    if (!ep || !Object.hasOwn(E.outcomeLabels, outcome) || !clean || clean.length > 600) {
      throw new Error('Episode, hasil, atau catatan tidak valid.');
    }
    const at = new Date().toISOString();
    const currentUser = authService.getCurrentUser();
    const actor = currentUser?.fullName || 'Verifikator demo';

    ep.review = { outcome, note: clean, actor, at };
    ep.events.push({
      at,
      actor,
      action: 'Tindak lanjut dicatat',
      detail: `${E.outcomeLabels[outcome]}: ${clean}`
    });

    // Broadcast review event across room
    realtimeDb.publish(
      'review',
      {
        episode_id: id,
        outcome,
        note: clean,
        actor_name: actor,
        updated_at: at
      },
      currentUser
    );

    state.selected = id;
    state.reviewDrafts[id] = { outcome, note: '' };
    render();
    toast(`Tindak lanjut ${id} dicatat pada sesi demo ini.`);
    return { episode_id: id, review: ep.review };
  }

  function goToPitchStep(index) {
    const bounded = Math.max(0, Math.min(PITCH_STEPS.length - 1, index));
    state.pitchIndex = bounded;
    const step = PITCH_STEPS[bounded];
    state.view = step.view;
    state.filter = 'all';
    state.facilityFilter = 'all';
    state.signalFilter = 'all';
    state.query = '';
    if (step.episodeId) {
      state.selected = step.episodeId;
      if (step.sessionIndex) {
        state.selectedSessionByEpisode[step.episodeId] = step.sessionIndex;
      }
    }
    render();
  }

  function resetToBaseline() {
    state.dataset = E.makeDataset();
    state.selected = 'EP-002';
    state.selectedSessionByEpisode = {};
    state.reviewDrafts = {};
    state.filter = 'all';
    state.facilityFilter = 'all';
    state.signalFilter = 'all';
    state.query = '';
    state.ticketEpisodeId = null;
    if (state.pitchOpen) {
      state.pitchIndex = 0;
      state.view = PITCH_STEPS[0].view;
    }
    render();
    toast('Data ruang direset kembali ke 40 episode awal.');
  }

  // 2. Wire Header Interactive Buttons
  const btnConn = $('btn-conn-settings');
  if (btnConn) {
    btnConn.addEventListener('click', () => {
      openConnectionModal({
        onResetRoom: () => resetToBaseline(),
        onReloadApp: () => render()
      });
    });
  }

  const btnUser = $('btn-user-switch');
  if (btnUser) {
    btnUser.addEventListener('click', () => {
      openConnectionModal({
        onResetRoom: () => resetToBaseline(),
        onReloadApp: () => render()
      });
    });
  }

  // Wire global subbar view tabs
  document.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.view = btn.dataset.view;
      render();
    });
  });

  $('toggle-pitch').addEventListener('click', () => {
    state.pitchOpen = !state.pitchOpen;
    if (state.pitchOpen) {
      goToPitchStep(state.pitchIndex);
    } else {
      render();
    }
  });

  $('reset').addEventListener('click', () => {
    resetToBaseline();
  });

  $('export-csv').addEventListener('click', () => {
    const rows = [
      [
        'episode_id',
        'patient_token',
        'facility_id',
        'facility_name',
        'active_claim_sessions',
        'matched_sessions',
        'unmatched_sessions',
        'status',
        'rule_codes',
        'review_outcome',
        'rule_version',
        'synthetic'
      ]
    ];
    evaluations().forEach(({ ep, r }) =>
      rows.push([
        ep.episode_id,
        ep.patient_token,
        ep.facility_id,
        ep.facility_name,
        r.claimed,
        r.matched,
        r.missing,
        r.label,
        r.reasons.map((x) => x.code).join('|'),
        ep.review ? E.outcomeLabels[ep.review.outcome] : '',
        E.VERSION,
        'true'
      ])
    );
    const csvContent = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    download('JEJAK-JKN-ringkasan.csv', csvContent, 'text/csv;charset=utf-8');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.ticketEpisodeId) {
      handlers.onCloseTicket();
    } else if (state.pitchOpen && e.altKey && e.key === 'ArrowRight') {
      e.preventDefault();
      goToPitchStep(state.pitchIndex + 1);
    } else if (state.pitchOpen && e.altKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      goToPitchStep(state.pitchIndex - 1);
    }
  });

  // 3. Setup Realtime Ingestion & Replay Past Room Events
  function replayPastEvents() {
    const events = realtimeDb.getRoomEvents();
    events.forEach((evt) => {
      if (evt.type === 'submission') {
        applySubmission(state.dataset, evt.payload);
      } else if (evt.type === 'review') {
        applyReview(state.dataset, evt.payload);
      }
    });
  }

  realtimeDb.init(initialRoom).then(() => {
    replayPastEvents();
    render();
  });

  realtimeDb.onStatusChange(() => {
    updateHeaderAndNav();
  });

  // Handle incoming realtime push events
  realtimeDb.onEvent((event, isSelf) => {
    if (event.type === 'submission') {
      const res = applySubmission(state.dataset, event.payload);
      if (res.applied) {
        if (!isSelf) {
          liveAlert.playChime();
          const senderName = event.sender?.label || 'Faskes';
          const epId = event.payload.episode_id;
          const sText = res.sessions ? `Sesi ${res.sessions.join(', ')}` : 'Catatan';

          liveAlert.show({
            title: `Catatan Baru Masuk (${senderName})`,
            message: `${senderName} baru saja mengirimkan ${sText} untuk ${epId}.`,
            badge: 'Ingesti Live',
            icon: '🔔',
            actionLabel: `Periksa ${epId}`,
            onAction: () => {
              openEpisode(epId, res.sessions?.[0]);
            },
            duration: 8000
          });
        }
        render();
      }
    } else if (event.type === 'ticket') {
      if (!isSelf && authService.isFaskes()) {
        liveAlert.playChime();
        liveAlert.show({
          title: 'Tiket Klarifikasi Masuk!',
          message: `Verifikator BPJS menerbitkan ${event.payload.ticket_id} untuk ${event.payload.episode_id}.`,
          badge: 'Tiket Baru',
          icon: '📬',
          duration: 7000
        });
      }
      render();
    } else if (event.type === 'ticket_reply') {
      if (!isSelf && authService.isVerifikator()) {
        liveAlert.playChime();
        liveAlert.show({
          title: 'Tanggapan Faskes Diterima!',
          message: `${event.sender?.label || 'Faskes'} menanggapi tiket ${event.payload.ticket_id} (${event.payload.episode_id}).`,
          badge: 'Tanggapan',
          icon: '💬',
          actionLabel: 'Buka Tiket',
          onAction: () => {
            handlers.onOpenTicket(event.payload.episode_id);
          },
          duration: 8000
        });
      }
      render();
    } else if (event.type === 'review') {
      applyReview(state.dataset, event.payload);
      render();
    } else if (event.type === 'reset_room') {
      resetToBaseline();
      if (!isSelf) {
        liveAlert.show({
          title: 'Data Ruang Direset',
          message: 'Data kiriman demo telah dikembalikan ke baseline 40 episode oleh rekan Anda.',
          badge: 'Reset',
          icon: '🔄'
        });
      }
    }
  });

  authService.onAuthChange((newUser) => {
    if (newUser.role === 'faskes' && state.view === 'workspace') {
      state.view = 'faskes';
    } else if (newUser.role === 'verifikator' && state.view === 'faskes') {
      state.view = 'workspace';
    }
    render();
  });

  // Initial render
  render();

  window.JejakDemo = {
    openEpisode,
    syncEpisode,
    syncAllLate,
    saveReview,
    openTicket: (id) => handlers.onOpenTicket(id),
    setView: (v) => {
      if (v === 'workspace' || v === 'analytics' || v === 'faskes') {
        state.view = v;
        render();
      }
    },
    startPitch: (stepIdx = 0) => {
      state.pitchOpen = true;
      goToPitchStep(stepIdx);
    },
    getState: () => E.clone(state.dataset),
    getResult: (id) => {
      const ep = state.dataset.episodes.find((e) => e.episode_id === id);
      if (!ep) throw new Error('Episode tidak ditemukan.');
      return E.evaluate(ep, state.dataset.episodes);
    },
    auth: authService,
    realtime: realtimeDb
  };
}

initJejakApp();

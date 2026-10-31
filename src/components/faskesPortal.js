// @ts-check
import { el } from '../utils/dom.js';
import { authService } from '../services/authService.js';
import { realtimeDb } from '../services/realtimeDb.js';
import { liveAlert } from './liveAlert.js';
import {
  buildFaskesPresets,
  buildPresetSubmission,
  buildSessionRecord,
  applySubmission,
  facilityEpisodes,
  faskesEpisodeView,
  TEMPLATE_TEXT
} from '../engine/ingest.js';
import { evaluate } from '../engine/jejakEngine.js';
import { FACILITIES } from '../config.js';

/**
 * Petugas Faskes Portal component for live multi-user demonstration
 */
export function createFaskesPortal({
  dataset,
  onDatasetUpdated,
  onOpenConnectionModal,
  onSwitchToVerifikator
}) {
  const container = el('div', { class: 'faskes-portal fade-in' });

  // In-session submission history
  /** @type {Array<any>} */
  const sessionHistory = [];

  function render() {
    container.innerHTML = '';

    const currentUser = authService.getCurrentUser();
    const currentRoom = authService.getCurrentRoom();
    const connState = realtimeDb.getConnectionState();

    const facilityId = currentUser?.facilityId || 'F-DEMO-1';
    const facilityName = currentUser?.facilityName || 'RS Simulasi Aruna';
    const episodes = facilityEpisodes(dataset, facilityId);
    const presets = buildFaskesPresets(dataset, facilityId);

    // 1. Top Banner / Header
    const topBar = el('div', { class: 'faskes-topbar' }, [
      el('div', { class: 'faskes-identity' }, [
        el('div', { class: 'faskes-hospital-badge' }, [
          el('span', { class: 'badge-icon' }, ['🏥']),
          el('div', {}, [
            el('strong', { class: 'faskes-name-text' }, [facilityName]),
            el('div', { class: 'faskes-meta-text' }, [
              `ID: ${facilityId} · Pengguna: ${currentUser?.fullName || 'Petugas RME'} · `
            ])
          ])
        ])
      ]),
      el('div', { class: 'faskes-controls' }, [
        // Connection Pill
        el(
          'button',
          {
            class: `badge ${connState.connected ? (connState.mode === 'supabase' ? 'badge-ok' : 'badge-info') : 'badge-warn'} faskes-conn-btn`,
            type: 'button',
            onclick: onOpenConnectionModal,
            title: 'Klik untuk ubah ruang atau sambungan cloud'
          },
          [
            connState.connected
              ? connState.mode === 'supabase'
                ? `🟢 Cloud Live: ${currentRoom}`
                : `🟡 Sync Lokal: ${currentRoom}`
              : `⚪ Terputus: ${currentRoom}`
          ]
        ),
        // Facility Switcher Dropdown
        el(
          'select',
          {
            class: 'input faskes-select-switch',
            onchange: (e) => {
              const targetFac = FACILITIES.find((f) => f.id === e.target.value);
              if (targetFac) {
                authService.loginAs(targetFac.key);
                render();
              }
            }
          },
          FACILITIES.map((f) =>
            el('option', { value: f.id, selected: f.id === facilityId }, [f.name])
          )
        ),
        // Switch to Verifikator
        el(
          'button',
          {
            class: 'btn btn-sm btn-outline',
            type: 'button',
            onclick: onSwitchToVerifikator,
            title: 'Beralih ke tampilan Verifikator BPJS'
          },
          ['👁 Layar Verifikator BPJS']
        )
      ])
    ]);

    // 2. Pitch Scenario Quick Presets
    const presetSection = el('section', { class: 'card faskes-card' }, [
      el('div', { class: 'card-header-flex' }, [
        el('div', {}, [
          el('h3', { class: 'card-title' }, ['⚡ Aksi Cepat Skenario Pitch (1-Klik)']),
          el('p', { class: 'card-subtitle' }, [
            'Simulasikan pengiriman catatan klinis dari faskes langsung ke layar Verifikator BPJS secara real-time.'
          ])
        ]),
        el('span', { class: 'badge badge-ok' }, ['Siap Uji'])
      ]),
      el(
        'div',
        { class: 'preset-grid' },
        presets.map((preset) => {
          const isAvailable = Boolean(preset.target);
          return el(
            'div',
            { class: `preset-card preset-${preset.tone} ${isAvailable ? '' : 'is-disabled'}` },
            [
              el('div', { class: 'preset-header' }, [
                el('span', { class: `badge badge-${preset.tone}` }, [preset.rule]),
                el('strong', { class: 'preset-title' }, [preset.title])
              ]),
              el('p', { class: 'preset-desc' }, [preset.description]),
              el('div', { class: 'preset-target-meta' }, [
                preset.target
                  ? `Target: ${preset.target.episodeId}${
                      preset.target.sessionIndex ? ` · Sesi ${preset.target.sessionIndex}` : ''
                    }${preset.target.count ? ` · ${preset.target.count} catatan` : ''}`
                  : 'Skenario sudah diterapkan atau tidak ada sesi kosong'
              ]),
              el('div', { class: 'preset-expectation' }, [
                el('small', { class: 'muted' }, [`Hasil Verifikator: ${preset.expectation}`])
              ]),
              el(
                'button',
                {
                  class: `btn btn-sm ${preset.tone === 'ok' ? 'btn-primary' : 'btn-outline'} preset-btn`,
                  type: 'button',
                  disabled: !isAvailable,
                  onclick: () => handlePresetSubmit(preset.id)
                },
                [isAvailable ? 'Kirim Sekarang 🚀' : 'Sudah Dikirim ✓']
              )
            ]
          );
        })
      )
    ]);

    // 3. Clarification Tickets Inbox
    const ticketInbox = renderTicketInbox(facilityId);

    // 4. Manual Submission Form (collapsible / accordion)
    const manualForm = renderManualForm(episodes, facilityId);

    // 5. Facility Episodes & Status Overview
    const episodesSection = renderEpisodesSection(episodes);

    // 6. Riwayat Pengiriman Sesi Ini
    const historySection = renderHistorySection();

    container.appendChild(topBar);
    container.appendChild(presetSection);
    container.appendChild(ticketInbox);
    container.appendChild(manualForm);
    container.appendChild(episodesSection);
    if (sessionHistory.length > 0) {
      container.appendChild(historySection);
    }
  }

  function handlePresetSubmit(presetId) {
    const currentUser = authService.getCurrentUser();
    const facilityId = currentUser?.facilityId || 'F-DEMO-1';
    const submission = buildPresetSubmission(dataset, presetId, facilityId);

    if (!submission) {
      alert('Skenario tidak dapat dijalankan (target sesi sudah lengkap atau tidak ditemukan).');
      return;
    }

    const payload = {
      ...submission,
      submitted_by_name: currentUser?.fullName || 'Petugas Faskes',
      created_at: new Date().toISOString()
    };

    // 1. Broadcast to room
    realtimeDb.publish('submission', payload, currentUser);

    // 2. Apply to local dataset
    const result = applySubmission(dataset, payload);

    // 3. Record to session history
    sessionHistory.unshift({
      time: new Date().toLocaleTimeString('id-ID'),
      type: submission.kind === 'claim_cancel' ? 'Koreksi Pembatalan' : 'Catatan Klinis',
      target: `${submission.episode_id} (${payload.payload.records?.length || 1} sesi)`,
      status: result.applied ? 'Terkirim ✓' : 'Gagal'
    });

    // 4. Play local chime & alert
    liveAlert.playChime();
    liveAlert.show({
      title: 'Catatan Terkirim!',
      message: `Terkirim ke Verifikator BPJS untuk ${submission.episode_id}. Periksa layar Verifikator.`,
      badge: 'Portal Faskes',
      icon: '🚀',
      duration: 4000
    });

    if (onDatasetUpdated) {
      onDatasetUpdated();
    }
    render();
  }

  function renderTicketInbox(facilityId) {
    const events = realtimeDb.getRoomEvents();
    // Filter tickets targeting episodes of this facility
    const facilityEpIds = new Set(facilityEpisodes(dataset, facilityId).map((e) => e.episode_id));
    const tickets = events
      .filter((e) => e.type === 'ticket' && facilityEpIds.has(e.payload?.episode_id))
      .reverse();

    const section = el('section', { class: 'card faskes-card' });
    const header = el('div', { class: 'card-header-flex' }, [
      el('div', {}, [
        el('h3', { class: 'card-title' }, ['📬 Kotak Masuk Permintaan Klarifikasi (Tiket BPJS)']),
        el('p', { class: 'card-subtitle' }, [
          'Tiket klarifikasi yang diterbitkan oleh Verifikator BPJS untuk dikonfirmasi oleh Faskes.'
        ])
      ]),
      el('span', { class: `badge ${tickets.length ? 'badge-warn' : 'badge-ok'}` }, [
        `${tickets.length} Tiket`
      ])
    ]);

    section.appendChild(header);

    if (!tickets.length) {
      section.appendChild(
        el('div', { class: 'empty-box' }, [
          el('span', { class: 'empty-icon' }, ['✓']),
          el('p', {}, [
            'Belum ada tiket klarifikasi untuk rumah sakit ini. Tiket yang dikirim Verifikator BPJS akan muncul di sini secara langsung.'
          ])
        ])
      );
      return section;
    }

    const list = el('div', { class: 'ticket-inbox-list' });
    tickets.forEach((ticketEvt) => {
      const t = ticketEvt.payload;
      const replies = events.filter(
        (e) => e.type === 'ticket_reply' && e.payload?.ticket_id === t.ticket_id
      );

      const ticketCard = el('div', { class: 'ticket-inbox-card' }, [
        el('div', { class: 'ticket-inbox-header' }, [
          el('div', {}, [
            el('strong', { class: 'ticket-inbox-num' }, [t.ticket_id || 'TIKET']),
            el('span', { class: 'badge badge-warn ml-2' }, [t.episode_id]),
            el('span', { class: 'text-muted ml-2' }, [`Peserta: ${t.patient_token}`])
          ]),
          el('span', { class: 'text-muted text-sm' }, [
            new Date(ticketEvt.timestamp).toLocaleTimeString('id-ID')
          ])
        ]),
        el('div', { class: 'ticket-inbox-body' }, [
          el('div', { class: 'ticket-stat-grid' }, [
            el('div', { class: 'stat-mini' }, [
              el('small', { class: 'muted' }, ['Sesi Ditagih']),
              el('strong', {}, [String(t.claim_count || 0)])
            ]),
            el('div', { class: 'stat-mini' }, [
              el('small', { class: 'muted' }, ['Catatan Cocok']),
              el('strong', {}, [String(t.matched_records || 0)])
            ]),
            el('div', { class: 'stat-mini' }, [
              el('small', { class: 'muted' }, ['Sesi Selisih']),
              el('strong', { class: 'text-warn' }, [String(t.missing_count || 0)])
            ])
          ]),
          el('p', { class: 'ticket-reason-box' }, [
            el('strong', {}, ['Fokus Penjelasan: ']),
            t.recommended_action || t.reason || 'Klarifikasi bukti pelayanan dan catatan asesmen fisioterapi.'
          ])
        ])
      ]);

      // Reply Thread
      if (replies.length > 0) {
        const thread = el('div', { class: 'ticket-reply-thread' }, [
          el('strong', { class: 'thread-title' }, ['Tanggapan Faskes Terkirim:'])
        ]);
        replies.forEach((rep) => {
          thread.appendChild(
            el('div', { class: 'reply-bubble' }, [
              el('div', { class: 'reply-meta' }, [
                el('strong', {}, [rep.sender?.label || 'Petugas Faskes']),
                el('span', { class: 'text-muted text-xs' }, [
                  new Date(rep.timestamp).toLocaleTimeString('id-ID')
                ])
              ]),
              el('p', { class: 'reply-text' }, [rep.payload?.reply_text || ''])
            ])
          );
        });
        ticketCard.appendChild(thread);
      }

      // Quick Reply Box
      const replyBox = el('div', { class: 'ticket-reply-form' });
      const textarea = el('textarea', {
        class: 'input ticket-reply-input',
        rows: 2,
        placeholder: 'Ketik tanggapan faskes (misal: "Catatan tindakan manual buku log sudah terkonfirmasi...")'
      });
      const submitReplyBtn = el(
        'button',
        {
          class: 'btn btn-sm btn-primary',
          type: 'button',
          onclick: () => {
            const text = textarea.value.trim();
            if (!text) {
              alert('Harap ketik tanggapan terlebih dahulu.');
              return;
            }
            const currentUser = authService.getCurrentUser();
            realtimeDb.publish(
              'ticket_reply',
              {
                ticket_id: t.ticket_id,
                episode_id: t.episode_id,
                reply_text: text,
                replied_at: new Date().toISOString()
              },
              currentUser
            );
            textarea.value = '';
            liveAlert.show({
              title: 'Tanggapan Terkirim!',
              message: `Tanggapan untuk ${t.ticket_id} telah dikirim ke Verifikator BPJS.`,
              badge: 'Klarifikasi',
              icon: '💬',
              duration: 3500
            });
            render();
          }
        },
        ['Kirim Tanggapan ke BPJS 📤']
      );

      replyBox.appendChild(textarea);
      replyBox.appendChild(el('div', { class: 'reply-btn-row' }, [submitReplyBtn]));
      ticketCard.appendChild(replyBox);

      list.appendChild(ticketCard);
    });

    section.appendChild(list);
    return section;
  }

  function renderManualForm(episodes, facilityId) {
    let isOpen = false;
    const section = el('section', { class: 'card faskes-card' });
    const toggleHeader = el('div', { class: 'card-header-flex cursor-pointer' }, [
      el('div', {}, [
        el('h3', { class: 'card-title' }, ['📝 Formulir Input Catatan Klinis Mandiri']),
        el('p', { class: 'card-subtitle' }, [
          'Kirimkan catatan sesi pelayanan spesifik secara manual (sesuai Tabel 4.1 Dokumen Proposal).'
        ])
      ]),
      el('button', { class: 'btn btn-sm btn-outline', type: 'button' }, ['Buka Formulir ▾'])
    ]);

    const formBody = el('div', { class: 'manual-form-body' });
    formBody.style.display = 'none';

    toggleHeader.onclick = () => {
      isOpen = !isOpen;
      formBody.style.display = isOpen ? 'block' : 'none';
      toggleHeader.querySelector('button').textContent = isOpen ? 'Tutup Formulir ▴' : 'Buka Formulir ▾';
    };

    if (episodes.length === 0) {
      formBody.appendChild(el('p', { class: 'text-muted' }, ['Tidak ada episode pada faskes ini.']));
      section.appendChild(toggleHeader);
      section.appendChild(formBody);
      return section;
    }

    // Episode Picker
    const epSelect = el(
      'select',
      { class: 'input' },
      episodes.map((ep) =>
        el('option', { value: ep.episode_id }, [
          `${ep.episode_id} — Peserta: ${ep.patient_token} (${ep.claims.length} sesi tagihan)`
        ])
      )
    );

    const sessionInput = el('input', {
      type: 'number',
      class: 'input',
      min: '1',
      max: '30',
      value: '1'
    });

    const dateInput = el('input', {
      type: 'date',
      class: 'input',
      value: new Date().toISOString().slice(0, 10)
    });

    const therapistInput = el('input', {
      type: 'text',
      class: 'input',
      value: `T-${facilityId.replace('F-DEMO-', '')}-01`
    });

    const painBeforeInput = el('input', {
      type: 'number',
      class: 'input',
      min: '0',
      max: '10',
      value: '6'
    });

    const painAfterInput = el('input', {
      type: 'number',
      class: 'input',
      min: '0',
      max: '10',
      value: '3'
    });

    const repsInput = el('input', {
      type: 'number',
      class: 'input',
      min: '1',
      max: '60',
      value: '15'
    });

    const templateInput = el('input', {
      type: 'text',
      class: 'input',
      value: TEMPLATE_TEXT
    });

    const personalInput = el('textarea', {
      class: 'input',
      rows: 3,
      placeholder: 'Keluhan spesifik pasien, evaluasi gerak, respons latihan mandiri...'
    });

    // Helper: auto-update session index based on selected episode's first missing session
    function updateDefaultsForEp(epId) {
      const targetEp = episodes.find((e) => e.episode_id === epId);
      if (!targetEp) return;
      const ev = evaluate(targetEp, dataset.episodes);
      if (ev.missing_indexes.length > 0) {
        sessionInput.value = String(ev.missing_indexes[0]);
        const claim = targetEp.claims.find((c) => c.session_index === ev.missing_indexes[0]);
        if (claim?.service_date) dateInput.value = claim.service_date;
      }
      personalInput.value = `Pasien sesi ${sessionInput.value}: Nyeri sendi berkurang, toleransi peregangan membaik. Diberikan edukasi ergonomi postur.`;
    }

    epSelect.onchange = (e) => updateDefaultsForEp(e.target.value);
    sessionInput.onchange = () => {
      personalInput.value = `Pasien sesi ${sessionInput.value}: Nyeri sendi berkurang, toleransi peregangan membaik. Diberikan edukasi ergonomi postur.`;
    };

    updateDefaultsForEp(epSelect.value);

    const submitBtn = el(
      'button',
      {
        class: 'btn btn-primary',
        type: 'button',
        onclick: () => {
          const ep = episodes.find((e) => e.episode_id === epSelect.value);
          if (!ep) return;
          const sIndex = Number(sessionInput.value) || 1;
          const currentUser = authService.getCurrentUser();

          const record = buildSessionRecord(ep, sIndex, {
            serviceDate: dateInput.value,
            therapistToken: therapistInput.value.trim() || 'T-DEMO-1',
            templateText: templateInput.value.trim() || TEMPLATE_TEXT,
            personalText:
              personalInput.value.trim() ||
              `Latihan sesi ${sIndex} selesai. Nyeri ${painBeforeInput.value}→${painAfterInput.value}. Target ${repsInput.value} repetisi tercapai.`
          });

          const payload = {
            episode_id: ep.episode_id,
            facility_id: ep.facility_id,
            kind: 'records',
            submitted_by_name: currentUser?.fullName || 'Petugas Faskes',
            created_at: new Date().toISOString(),
            payload: {
              records: [record],
              batch_complete: false,
              source: 'faskes-manual'
            }
          };

          // 1. Publish to room
          realtimeDb.publish('submission', payload, currentUser);

          // 2. Apply locally
          const res = applySubmission(dataset, payload);

          // 3. Track history
          sessionHistory.unshift({
            time: new Date().toLocaleTimeString('id-ID'),
            type: `Catatan Sesi ${sIndex}`,
            target: `${ep.episode_id}`,
            status: res.applied ? 'Terkirim ✓' : 'Gagal'
          });

          liveAlert.playChime();
          liveAlert.show({
            title: 'Catatan Manual Terkirim!',
            message: `Catatan Sesi ${sIndex} untuk ${ep.episode_id} berhasil dikirim ke Verifikator.`,
            badge: 'Portal Faskes',
            icon: '📄',
            duration: 4000
          });

          if (onDatasetUpdated) onDatasetUpdated();
          render();
        }
      },
      ['Kirim Catatan Klinis ke Verifikator BPJS 🚀']
    );

    const grid = el('div', { class: 'form-grid' }, [
      el('div', { class: 'form-group col-span-2' }, [
        el('label', { class: 'form-label' }, ['Target Episode Pelayanan']),
        epSelect
      ]),
      el('div', { class: 'form-group' }, [
        el('label', { class: 'form-label' }, ['Nomor Sesi (Index)']),
        sessionInput
      ]),
      el('div', { class: 'form-group' }, [
        el('label', { class: 'form-label' }, ['Tanggal Pelayanan']),
        dateInput
      ]),
      el('div', { class: 'form-group' }, [
        el('label', { class: 'form-label' }, ['Token Terapis / Dokter']),
        therapistInput
      ]),
      el('div', { class: 'form-group' }, [
        el('label', { class: 'form-label' }, ['VAS Nyeri Sebelum (0-10)']),
        painBeforeInput
      ]),
      el('div', { class: 'form-group' }, [
        el('label', { class: 'form-label' }, ['VAS Nyeri Sesudah (0-10)']),
        painAfterInput
      ]),
      el('div', { class: 'form-group' }, [
        el('label', { class: 'form-label' }, ['Target Repetisi']),
        repsInput
      ]),
      el('div', { class: 'form-group col-span-2' }, [
        el('label', { class: 'form-label' }, ['Teks Templat Standar (template_text)']),
        templateInput
      ]),
      el('div', { class: 'form-group col-span-2' }, [
        el('label', { class: 'form-label' }, ['Teks Catatan Individual Pasien (patient_specific_text)']),
        personalInput
      ]),
      el('div', { class: 'form-group col-span-2' }, [submitBtn])
    ]);

    formBody.appendChild(grid);
    section.appendChild(toggleHeader);
    section.appendChild(formBody);
    return section;
  }

  function renderEpisodesSection(episodes) {
    const section = el('section', { class: 'card faskes-card' });
    const header = el('div', { class: 'card-header-flex' }, [
      el('div', {}, [
        el('h3', { class: 'card-title' }, ['📋 Daftar Episode Pasien di Faskes Ini']),
        el('p', { class: 'card-subtitle' }, [
          'Pantau kelengkapan catatan tindakan dari sudut pandang RME rumah sakit.'
        ])
      ]),
      el('span', { class: 'badge badge-neutral' }, [`${episodes.length} Episode`])
    ]);

    section.appendChild(header);

    const grid = el('div', { class: 'faskes-ep-grid' });

    episodes.forEach((ep) => {
      const view = faskesEpisodeView(ep, dataset);
      const isComplete = view.sent === view.billed;

      const epCard = el('div', { class: 'faskes-ep-card' }, [
        el('div', { class: 'faskes-ep-header' }, [
          el('div', {}, [
            el('strong', { class: 'faskes-ep-id' }, [ep.episode_id]),
            el('span', { class: 'badge badge-neutral ml-2' }, [ep.patient_token])
          ]),
          el('span', { class: `badge ${isComplete ? 'badge-ok' : 'badge-warn'}` }, [
            `${view.sent}/${view.billed} Sesi Terkirim`
          ])
        ]),
        // Mini Session Indicator
        el(
          'div',
          { class: 'faskes-session-row' },
          view.sessions.map((s) => {
            const label = `Sesi ${s.sessionIndex} (${s.state})`;
            let cls = 'faskes-s-pill ';
            if (s.state === 'sent') cls += 's-sent';
            else if (s.state === 'outbox') cls += 's-outbox';
            else if (s.state === 'cancelled') cls += 's-cancelled';
            else cls += 's-missing';

            return el(
              'span',
              {
                class: cls,
                title: `${label}: ${s.serviceDate || ''}`
              },
              [String(s.sessionIndex)]
            );
          })
        ),
        el('div', { class: 'faskes-ep-footer' }, [
          el('small', { class: 'text-muted' }, [
            view.outbox > 0
              ? `⚠️ ${view.outbox} catatan tertahan di outbox`
              : isComplete
              ? '✓ Semua catatan tindakan lengkap'
              : 'Perlu pengiriman catatan klinis'
          ])
        ])
      ]);

      grid.appendChild(epCard);
    });

    section.appendChild(grid);
    return section;
  }

  function renderHistorySection() {
    const section = el('section', { class: 'card faskes-card' });
    const header = el('div', { class: 'card-header-flex' }, [
      el('h3', { class: 'card-title' }, ['⏱ Riwayat Kiriman Sesi Ini']),
      el('span', { class: 'badge badge-neutral' }, [`${sessionHistory.length} Aksi`])
    ]);
    section.appendChild(header);

    const table = el('table', { class: 'data-table faskes-hist-table' }, [
      el('thead', {}, [
        el('tr', {}, [
          el('th', {}, ['Waktu']),
          el('th', {}, ['Jenis Kiriman']),
          el('th', {}, ['Target']),
          el('th', {}, ['Status'])
        ])
      ]),
      el(
        'tbody',
        {},
        sessionHistory.map((item) =>
          el('tr', {}, [
            el('td', {}, [item.time]),
            el('td', {}, [item.type]),
            el('td', {}, [item.target]),
            el('td', {}, [el('span', { class: 'badge badge-ok' }, [item.status])])
          ])
        )
      )
    ]);

    section.appendChild(table);
    return section;
  }

  // Subscribe to realtime events to re-render when tickets or state change
  const unsubDb = realtimeDb.onEvent(() => {
    render();
  });

  const unsubAuth = authService.onAuthChange(() => {
    render();
  });

  render();

  return {
    element: container,
    destroy: () => {
      unsubDb();
      unsubAuth();
    }
  };
}

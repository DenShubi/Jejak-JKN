import { evaluate, inspectEpisode, latestRecords } from './jejakEngine.js';

export const TEMPLATE_TEXT = 'Terapi latihan dan evaluasi respons pasien.';
export const CLONE_SOURCE_FALLBACK = {
  text: 'Keluhan khas kelompok 1: lutut kanan nyeri 6 dari 10 setelah naik tangga. Latihan individu 17 repetisi, respons akhir nyeri 3 dari 10. Catatan tindak lanjut personal kode pasangan 1.',
  episode_id: 'EP-015',
  record_id: 'REC-015-2'
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RECORDS_PER_SUBMISSION = 20;

const episodeNumber = (ep) => ep.episode_id.replace('EP-', '');
const str = (value, max) => String(value ?? '').slice(0, max);

export function facilityEpisodes(dataset, facilityId) {
  return dataset.episodes.filter((ep) => ep.facility_id === facilityId);
}

export function nextRecordVersion(ep, recordId) {
  const versions = [...ep.records, ...ep.late_records]
    .filter((r) => r.record_id === recordId)
    .map((r) => Number(r.version) || 1);
  return versions.length ? Math.max(...versions) + 1 : 1;
}

export function defaultTherapist(ep) {
  return ep.records[0]?.therapist_token || ep.late_records[0]?.therapist_token || 'T-DEMO-1';
}

export function composePersonalText(ep, sessionIndex, { painBefore = 6, painAfter = 3, repetitions = 12, note = '' } = {}) {
  const p = episodeNumber(ep);
  const extra = String(note || '').trim();
  return `Peserta ${p} sesi ${sessionIndex}. Nyeri awal ${painBefore} dari 10, nyeri akhir ${painAfter} dari 10. Target latihan ${repetitions} repetisi. ${
    extra || `Respons dan tindak lanjut individual dicatat untuk sesi ${p}-${sessionIndex}.`
  }`;
}

export function buildSessionRecord(ep, sessionIndex, opts = {}) {
  const claim = ep.claims.find((c) => c.session_index === sessionIndex);
  const serviceDate = opts.serviceDate || claim?.service_date || '2026-09-01';
  const recordId = `REC-${episodeNumber(ep)}-${sessionIndex}`;
  return {
    record_id: recordId,
    episode_id: ep.episode_id,
    patient_token: ep.patient_token,
    facility_id: ep.facility_id,
    session_index: sessionIndex,
    service_date: serviceDate,
    status: opts.status === 'not-done' ? 'not-done' : 'completed',
    created_at: `${serviceDate}T08:00:00Z`,
    received_at: opts.now || new Date().toISOString(),
    therapist_token: opts.therapistToken || defaultTherapist(ep),
    version: nextRecordVersion(ep, recordId),
    source_system: 'Portal Faskes JEJAK (demo)',
    template_text: opts.templateText || TEMPLATE_TEXT,
    patient_specific_text:
      opts.personalText ||
      composePersonalText(ep, sessionIndex, { painBefore: 6, painAfter: 3, repetitions: 10 + sessionIndex })
  };
}

function sanitizeRecord(raw, receivedAt, keepReceived) {
  if (!raw || typeof raw !== 'object') return null;
  const sessionIndex = Number(raw.session_index);
  if (!Number.isInteger(sessionIndex) || sessionIndex < 1 || sessionIndex > 60) return null;
  if (!DATE_RE.test(String(raw.service_date))) return null;
  const recordId = str(raw.record_id, 60).trim();
  if (!recordId) return null;
  return {
    record_id: recordId,
    episode_id: str(raw.episode_id, 20),
    patient_token: str(raw.patient_token, 40),
    facility_id: str(raw.facility_id, 20),
    session_index: sessionIndex,
    service_date: raw.service_date,
    status: raw.status === 'not-done' ? 'not-done' : 'completed',
    created_at: str(raw.created_at, 40),
    received_at: keepReceived && raw.received_at ? str(raw.received_at, 40) : receivedAt,
    therapist_token: str(raw.therapist_token, 40),
    version: Math.max(1, Math.floor(Number(raw.version) || 1)),
    source_system: str(raw.source_system, 60),
    template_text: str(raw.template_text, 600),
    patient_specific_text: str(raw.patient_specific_text, 1200)
  };
}

/**
 * Applies one persisted submission row (from the realtime database) to the in-memory dataset.
 * Rule outcomes are never stored; they are always recomputed by JEJAK-RULES-0.1.0 afterwards.
 */
export function applySubmission(dataset, submission) {
  if (!submission || typeof submission !== 'object') return { applied: false, reason: 'invalid' };
  const ep = dataset.episodes.find((e) => e.episode_id === submission.episode_id);
  if (!ep) return { applied: false, reason: 'episode-not-found' };
  if (submission.facility_id !== ep.facility_id) return { applied: false, reason: 'facility-mismatch' };

  const at = submission.created_at || new Date().toISOString();
  const payload = submission.payload && typeof submission.payload === 'object' ? submission.payload : {};
  const actorName = str(submission.submitted_by_name || 'Petugas faskes', 80);

  if (submission.kind === 'records') {
    const isConnector = payload.source === 'connector';
    const records = (Array.isArray(payload.records) ? payload.records : [])
      .slice(0, MAX_RECORDS_PER_SUBMISSION)
      .map((r) => sanitizeRecord(r, at, isConnector))
      .filter(Boolean);
    if (!records.length) return { applied: false, reason: 'no-valid-records' };

    records.forEach((record) => {
      ep.late_records = ep.late_records.filter((lr) => lr.record_id !== record.record_id);
      ep.records.push(record);
    });
    if (payload.batch_complete) ep.source_complete = true;
    ep.source_received_at = isConnector ? records[0].received_at : at;

    const ids = records.map((r) => r.record_id).join(', ');
    ep.events.push(
      isConnector
        ? {
            at,
            actor: 'Konektor demo',
            action: 'Catatan terlambat disinkronkan',
            detail: `${records.length} catatan masuk. Batch sumber dinyatakan lengkap untuk pemeriksaan ulang.`
          }
        : {
            at,
            actor: `${actorName} (${ep.facility_name})`,
            action: payload.batch_complete ? 'Batch catatan diterima dari faskes' : 'Catatan layanan diterima dari faskes',
            detail: `${records.length} catatan (${ids}) dikirim melalui portal faskes${
              payload.batch_complete ? '; batch sumber dinyatakan lengkap' : ''
            }.`
          }
    );
    return {
      applied: true,
      kind: 'records',
      episode_id: ep.episode_id,
      sessions: [...new Set(records.map((r) => r.session_index))].sort((a, b) => a - b),
      count: records.length,
      batchComplete: Boolean(payload.batch_complete)
    };
  }

  if (submission.kind === 'claim_cancel') {
    const sessionIndex = Number(payload.session_index);
    const claim = ep.claims.find((c) => c.session_index === sessionIndex && c.status === 'active');
    if (!claim) return { applied: false, reason: 'claim-not-active' };
    claim.status = 'cancelled';
    claim.revision = (Number(claim.revision) || 1) + 1;
    ep.claim_version = Math.max(Number(ep.claim_version) || 1, claim.revision);
    ep.events.push({
      at,
      actor: `${actorName} (${ep.facility_name})`,
      action: 'Koreksi tagihan diterima dari faskes',
      detail: `Baris ${claim.line_id} dibatalkan (revisi v${claim.revision}). Alasan: ${str(payload.reason || 'tidak disebutkan', 200)}`
    });
    return {
      applied: true,
      kind: 'claim_cancel',
      episode_id: ep.episode_id,
      sessions: [sessionIndex],
      count: 1,
      batchComplete: false
    };
  }

  return { applied: false, reason: 'unknown-kind' };
}

export function applyReview(dataset, review) {
  const ep = dataset.episodes.find((e) => e.episode_id === review?.episode_id);
  if (!ep) return false;
  const labels = {
    pending: 'Perlu bukti tambahan',
    legitimate: 'Penjelasan sah diterima',
    confirmed: 'Ketidaksesuaian terkonfirmasi'
  };
  if (!labels[review.outcome]) return false;
  const at = review.updated_at || new Date().toISOString();
  const actor = str(review.actor_name || 'Verifikator', 80);
  const note = str(review.note, 600);
  ep.review = { outcome: review.outcome, note, actor, at };
  ep.events.push({ at, actor, action: 'Tindak lanjut dicatat', detail: `${labels[review.outcome]}: ${note}` });
  return true;
}

export function findCloneSourceText(dataset) {
  for (const ep of dataset.episodes) {
    for (const record of latestRecords(ep.records)) {
      if (String(record.patient_specific_text || '').startsWith('Keluhan khas kelompok')) {
        return { text: record.patient_specific_text, episode_id: ep.episode_id, record_id: record.record_id };
      }
    }
  }
  return CLONE_SOURCE_FALLBACK;
}

function missingSlots(dataset, facilityId) {
  const slots = [];
  facilityEpisodes(dataset, facilityId).forEach((ep) => {
    const r = evaluate(ep, dataset.episodes);
    if (!r.complete) return;
    r.missing_indexes.forEach((sessionIndex) => {
      const claim = ep.claims.find((c) => c.session_index === sessionIndex);
      slots.push({ ep, sessionIndex, serviceDate: claim?.service_date });
    });
  });
  return slots;
}

/** Computes the four 1-click pitch scenarios for the logged-in facility from the live dataset state. */
export function buildFaskesPresets(dataset, facilityId) {
  const slots = missingSlots(dataset, facilityId);
  const outboxEp = facilityEpisodes(dataset, facilityId).find((ep) => ep.late_records.length > 0) || null;
  const valid = slots[0] || null;
  const clone = slots.find((s) => valid && s.ep !== valid.ep) || slots[1] || null;
  const cancel = [...slots].reverse().find((s) => s !== valid && s !== clone) || null;
  const source = findCloneSourceText(dataset);
  const slotTarget = (s) =>
    s ? { episodeId: s.ep.episode_id, sessionIndex: s.sessionIndex, serviceDate: s.serviceDate } : null;

  return [
    {
      id: 'valid',
      tone: 'ok',
      title: 'Kirim Catatan Sesi Sah',
      rule: 'R1 · sesi menjadi cocok',
      target: slotTarget(valid),
      description: 'Mengirim catatan tindakan lengkap untuk sesi yang sudah ditagihkan tetapi catatannya belum terkirim.',
      expectation: 'Di layar verifikator, kotak sesi berubah dari “Belum cocok” menjadi “Catatan cocok”.'
    },
    {
      id: 'outbox',
      tone: 'info',
      title: 'Kirim Batch Catatan Terlambat',
      rule: 'R0 · batch menjadi lengkap',
      target: outboxEp
        ? {
            episodeId: outboxEp.episode_id,
            sessions: outboxEp.late_records.map((r) => r.session_index),
            count: outboxEp.late_records.length
          }
        : null,
      description: 'Mengirim catatan yang tertahan di antrean RME rumah sakit dan menandai batch periode ini lengkap.',
      expectation: 'Status “Lengkapi data” dihitung ulang; sisa selisih (jika ada) baru menjadi klarifikasi R1.'
    },
    {
      id: 'clone',
      tone: 'warn',
      title: 'Kirim Catatan Hasil Salin (Kloning)',
      rule: 'R2 · isi personal identik',
      target: slotTarget(clone),
      cloneSource: source,
      description: `Mengisi sesi kosong dengan teks personal yang disalin dari ${source.record_id} (${source.episode_id}, peserta lain).`,
      expectation: 'Sesi tampak cocok, tetapi verifikator menerima sinyal R2 kesamaan isi personal lintas peserta.'
    },
    {
      id: 'cancel',
      tone: 'neutral',
      title: 'Kirim Koreksi Pembatalan Tagihan',
      rule: 'v2 · sesi dikecualikan',
      target: slotTarget(cancel),
      description: 'Mengoreksi tagihan untuk sesi yang tidak jadi dilaksanakan (pasien tidak hadir).',
      expectation: 'Baris tagihan menjadi “Dibatalkan resmi” dan tidak lagi dihitung sebagai selisih sesi.'
    }
  ];
}

/** Builds the submission body (without id/room/actor metadata) for a pitch preset. */
export function buildPresetSubmission(dataset, presetId, facilityId) {
  const preset = buildFaskesPresets(dataset, facilityId).find((p) => p.id === presetId);
  if (!preset || !preset.target) return null;
  const ep = dataset.episodes.find((e) => e.episode_id === preset.target.episodeId);
  if (!ep) return null;
  const base = { episode_id: ep.episode_id, facility_id: ep.facility_id };

  if (presetId === 'valid') {
    const s = preset.target.sessionIndex;
    const record = buildSessionRecord(ep, s, {
      personalText: composePersonalText(ep, s, {
        painBefore: 6,
        painAfter: 3,
        repetitions: 10 + s,
        note: `Respons baik terhadap latihan penguatan sesi ${s}; edukasi latihan mandiri di rumah diberikan.`
      })
    });
    return { ...base, kind: 'records', payload: { records: [record], batch_complete: false, source: 'faskes-preset' } };
  }
  if (presetId === 'outbox') {
    return {
      ...base,
      kind: 'records',
      payload: { records: ep.late_records.map((r) => ({ ...r })), batch_complete: true, source: 'faskes-outbox' }
    };
  }
  if (presetId === 'clone') {
    const record = buildSessionRecord(ep, preset.target.sessionIndex, { personalText: preset.cloneSource.text });
    return {
      ...base,
      kind: 'records',
      payload: { records: [record], batch_complete: false, source: 'faskes-preset', demo_clone_of: preset.cloneSource.record_id }
    };
  }
  if (presetId === 'cancel') {
    const claim = ep.claims.find((c) => c.session_index === preset.target.sessionIndex);
    return {
      ...base,
      kind: 'claim_cancel',
      payload: {
        session_index: preset.target.sessionIndex,
        line_id: claim?.line_id,
        reason: 'Pasien tidak hadir pada jadwal sesi; tagihan sesi dikoreksi oleh faskes.'
      }
    };
  }
  return null;
}

/** Facility-side view of each episode: what was billed, sent, still in the RME outbox, or cancelled. */
export function faskesEpisodeView(ep, dataset) {
  const inspection = inspectEpisode(ep, dataset.episodes);
  const sessions = inspection.sessions.map((s) => {
    let state = 'none';
    if (s.cancelled) state = 'cancelled';
    else if (s.record && s.record.status === 'completed') state = 'sent';
    else if (s.queuedLateRecord) state = 'outbox';
    return {
      sessionIndex: s.sessionIndex,
      serviceDate: s.claim.service_date,
      lineId: s.claim.line_id,
      recordId: s.record?.record_id || s.queuedLateRecord?.record_id || null,
      state
    };
  });
  return {
    ep,
    sessions,
    billed: sessions.filter((s) => s.state !== 'cancelled').length,
    sent: sessions.filter((s) => s.state === 'sent').length,
    outbox: ep.late_records.length,
    batchComplete: ep.source_complete
  };
}

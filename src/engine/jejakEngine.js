export const VERSION = 'JEJAK-RULES-0.1.0';
export const ASOF = '2026-10-04T04:00:00Z';

export const labels = {
  consistent: 'Bukti konsisten',
  review: 'Perlu klarifikasi',
  incomplete: 'Lengkapi data'
};

export const outcomeLabels = {
  pending: 'Perlu bukti tambahan',
  legitimate: 'Penjelasan sah diterima',
  confirmed: 'Ketidaksesuaian terkonfirmasi'
};

export const clone = (value) => JSON.parse(JSON.stringify(value));

const date = (n) => `2026-09-${String(1 + (n - 1) * 2).padStart(2, '0')}`;

export const normalize = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

export function makeDataset() {
  const episodes = [];
  for (let i = 1; i <= 40; i++) {
    const p = String(i).padStart(3, '0');
    const scenario =
      i === 1 || (i >= 10 && i <= 14)
        ? 'delayed'
        : i >= 2 && i <= 9
          ? 'mismatch'
          : i >= 15 && i <= 20
            ? 'reuse'
            : 'normal';
    const total = i <= 9 || i === 1 ? 12 : 6;
    const actual =
      scenario === 'delayed'
        ? total - 2
        : scenario === 'mismatch'
          ? total - (i === 2 ? 4 : 2)
          : total;

    const ep = {
      episode_id: `EP-${p}`,
      claim_id: `CLM-${p}`,
      patient_token: `P-DEMO-${p}`,
      facility_id: `F-DEMO-${1 + (i % 3)}`,
      facility_name: `RS Simulasi ${['Aruna', 'Bima', 'Cakra'][i % 3]}`,
      period: 'September 2026',
      source_complete: scenario !== 'delayed',
      source_received_at: ASOF,
      rule_version: VERSION,
      claim_version: 1,
      claims: [],
      records: [],
      late_records: [],
      review: null,
      events: [],
      scenario_label: scenario
    };

    if (i === 1) ep.initial_available = 8;

    for (let s = 1; s <= total; s++) {
      const serviceDate = date(s);
      ep.claims.push({
        line_id: `${ep.claim_id}-S${s}`,
        session_index: s,
        service_date: serviceDate,
        status: 'active',
        revision: 1
      });

      const rec = {
        record_id: `REC-${p}-${s}`,
        episode_id: ep.episode_id,
        patient_token: ep.patient_token,
        facility_id: ep.facility_id,
        session_index: s,
        service_date: serviceDate,
        status: 'completed',
        created_at: `${serviceDate}T08:00:00Z`,
        received_at: `${serviceDate}T10:00:00Z`,
        therapist_token: `T-DEMO-${1 + (i % 4)}`,
        version: 1,
        source_system: 'RME simulasi',
        template_text: 'Terapi latihan dan evaluasi respons pasien.',
        patient_specific_text: `Peserta ${p} sesi ${s}. Nyeri awal ${2 + ((i + s) % 6)} dari 10, nyeri akhir ${1 + ((i + s) % 4)} dari 10. Target latihan ${8 + i + s} repetisi. Respons dan tindak lanjut individual dicatat untuk sesi ${p}-${s}.`
      };

      if (scenario === 'reuse' && s === 2) {
        const pair = Math.floor((i - 15) / 2) + 1;
        rec.patient_specific_text = `Keluhan khas kelompok ${pair}: lutut kanan nyeri 6 dari 10 setelah naik tangga. Latihan individu 17 repetisi, respons akhir nyeri 3 dari 10. Catatan tindak lanjut personal kode pasangan ${pair}.`;
      }

      if (s <= actual && !(i === 1 && s > 8)) {
        ep.records.push(rec);
      } else if (scenario === 'delayed' && (i !== 1 || s <= 10)) {
        ep.late_records.push({ ...rec, received_at: '2026-10-04T04:10:00Z' });
      }
    }

    if (i === 39) {
      ep.claims.slice(-2).forEach((c) => {
        c.status = 'cancelled';
        c.revision = 2;
      });
      ep.records.slice(-2).forEach((r) => {
        r.status = 'not-done';
        r.version = 2;
      });
      ep.claim_version = 2;
    }

    ep.events.push({
      at: ASOF,
      actor: 'Konektor demo',
      action: 'Snapshot diterima',
      detail: `${ep.records.length} catatan; cakupan sumber ${ep.source_complete ? 'lengkap' : 'belum lengkap'}.`
    });

    episodes.push(ep);
  }

  return { schema_version: '0.1', synthetic: true, as_of: ASOF, episodes };
}

export function latestRecords(records) {
  const map = new Map();
  records.forEach((r) => {
    const old = map.get(r.record_id);
    if (
      !old ||
      r.version > old.version ||
      (r.version === old.version && r.received_at > old.received_at)
    ) {
      map.set(r.record_id, r);
    }
  });
  return [...map.values()];
}

export function evaluate(ep, all) {
  const claims = ep.claims.filter((c) => c.status === 'active');
  const rows = latestRecords(ep.records);
  const identityErrors = rows.filter(
    (r) =>
      r.episode_id !== ep.episode_id ||
      r.patient_token !== ep.patient_token ||
      r.facility_id !== ep.facility_id
  );
  const valid = rows.filter(
    (r) =>
      r.episode_id === ep.episode_id &&
      r.patient_token === ep.patient_token &&
      r.facility_id === ep.facility_id &&
      r.status === 'completed'
  );

  const matches = new Map();
  claims.forEach((c) =>
    matches.set(
      c.line_id,
      valid.filter((r) => r.session_index === c.session_index && r.service_date === c.service_date)
    )
  );

  const matched = claims.filter((c) => matches.get(c.line_id).length > 0);
  const missing = claims.filter((c) => !matches.get(c.line_id).length);
  const unclaimed = valid.filter(
    (r) => !claims.some((c) => c.session_index === r.session_index && c.service_date === r.service_date)
  );
  const multiple = claims.filter((c) => matches.get(c.line_id).length > 1);

  const reused = [];
  valid.forEach((r) => {
    const text = normalize(r.patient_specific_text);
    if (text.length < 60) return;
    all
      .filter((other) => other.episode_id !== ep.episode_id)
      .forEach((other) => {
        latestRecords(other.records)
          .filter(
            (or) =>
              or.status === 'completed' &&
              or.patient_token === other.patient_token &&
              or.episode_id === other.episode_id &&
              or.facility_id === other.facility_id
          )
          .forEach((or) => {
            if (normalize(or.patient_specific_text) === text) {
              reused.push({
                record_id: r.record_id,
                other_record_id: or.record_id,
                other_episode_id: other.episode_id,
                other_patient_token: other.patient_token,
                other_facility_name: other.facility_name,
                session_index: r.session_index,
                text: r.patient_specific_text
              });
            }
          });
      });
  });

  const complete = ep.source_complete && identityErrors.length === 0;
  const reasons = [];
  if (!complete) {
    reasons.push({
      code: 'R0',
      title: 'Kelengkapan sumber belum memadai',
      detail: identityErrors.length
        ? `${identityErrors.length} catatan memiliki identitas yang tidak cocok.`
        : 'Batch sumber belum dinyatakan lengkap. Selisih bersifat sementara.'
    });
  }
  if (complete && (missing.length || unclaimed.length || multiple.length)) {
    reasons.push({
      code: 'R1',
      title: 'Pencocokan sesi perlu klarifikasi',
      detail: `${missing.length} sesi ditagihkan belum memiliki catatan yang cocok; ${unclaimed.length} catatan di luar sesi aktif; ${multiple.length} sesi dengan lebih dari satu catatan.`
    });
  }
  if (reused.length) {
    reasons.push({
      code: 'R2',
      title: 'Isi personal sama pada episode lain',
      detail: `${reused.length} pasangan catatan memiliki isi personal yang identik. Teks formulir standar dikecualikan.`
    });
  }

  const status = !complete ? 'incomplete' : reasons.length ? 'review' : 'consistent';

  return {
    status,
    label: labels[status],
    claimed: claims.length,
    matched: matched.length,
    missing: missing.length,
    missing_indexes: missing.map((c) => c.session_index),
    valid_records: valid.length,
    unclaimed: unclaimed.length,
    multiple: multiple.length,
    cancelled: ep.claims.length - claims.length,
    reasons,
    reused,
    complete,
    matches: Object.fromEntries([...matches].map(([key, val]) => [key, val.map((r) => r.record_id)])),
    rule_version: VERSION
  };
}

export function sync(ep) {
  if (!ep.late_records.length) return false;
  const amount = ep.late_records.length;
  ep.records.push(...ep.late_records);
  ep.late_records = [];
  ep.source_complete = true;
  ep.source_received_at = '2026-10-04T04:10:00Z';
  ep.events.push({
    at: ep.source_received_at,
    actor: 'Konektor demo',
    action: 'Catatan terlambat disinkronkan',
    detail: `${amount} catatan masuk. Batch sumber dinyatakan lengkap untuk pemeriksaan ulang.`
  });
  return true;
}

export function formatLatency(createdAt, receivedAt) {
  if (!createdAt || !receivedAt) {
    return { label: 'Waktu tidak lengkap', isDelayed: false, hours: 0 };
  }
  const diffMs = Date.parse(receivedAt) - Date.parse(createdAt);
  if (Number.isNaN(diffMs) || diffMs < 0) {
    return { label: '0 jam', isDelayed: false, hours: 0 };
  }
  const totalMinutes = Math.round(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  if (days >= 1) {
    return {
      label: `+${days} hari${hours ? ` ${hours} jam` : ''} (sinkronisasi susulan)`,
      isDelayed: true,
      hours: Math.round(totalMinutes / 60)
    };
  }
  return {
    label: `+${hours || 1} jam (hari layanan sama)`,
    isDelayed: false,
    hours
  };
}

export function inspectEpisode(ep, all) {
  const result = evaluate(ep, all);
  const latest = latestRecords(ep.records);
  const identityErrors = latest.filter(
    (r) =>
      r.episode_id !== ep.episode_id ||
      r.patient_token !== ep.patient_token ||
      r.facility_id !== ep.facility_id
  );

  const sessions = ep.claims.map((claim) => {
    const matchedIds = result.matches[claim.line_id] || [];
    const matchedRecords = latest.filter((r) => matchedIds.includes(r.record_id));
    const cancelledRecord =
      claim.status === 'cancelled'
        ? latest.find(
            (r) =>
              r.session_index === claim.session_index &&
              r.service_date === claim.service_date &&
              r.status !== 'completed'
          ) || null
        : null;
    const primaryRecord = matchedRecords[0] || cancelledRecord || null;
    const reusedPairs = primaryRecord
      ? result.reused.filter((pair) => pair.record_id === primaryRecord.record_id)
      : [];
    const queuedLateRecord =
      ep.late_records.find(
        (lr) => lr.session_index === claim.session_index && lr.service_date === claim.service_date
      ) || null;

    const cancelled = claim.status === 'cancelled';
    const reused = Boolean(primaryRecord && reusedPairs.length > 0);
    const multiple = matchedRecords.length > 1;
    const state = cancelled
      ? 'cancelled'
      : reused
        ? 'reused'
        : multiple
          ? 'multiple'
          : matchedRecords.length > 0
            ? 'has'
            : result.complete
              ? 'missing'
              : 'waiting';

    const stateLabel =
      state === 'cancelled'
        ? 'Dibatalkan resmi'
        : state === 'reused'
          ? 'Cocok · Isi sama (R2)'
          : state === 'multiple'
            ? 'Catatan ganda (R1)'
            : state === 'has'
              ? 'Catatan cocok'
              : state === 'missing'
                ? 'Perlu klarifikasi (R1)'
                : 'Menunggu data (R0)';

    const shortStatus =
      state === 'cancelled'
        ? 'Dibatalkan'
        : state === 'reused'
          ? 'Isi sama'
          : state === 'multiple'
            ? 'Ganda'
            : state === 'has'
              ? 'Catatan cocok'
              : state === 'missing'
                ? 'Belum cocok'
                : 'Menunggu data';

    const latency = primaryRecord
      ? formatLatency(primaryRecord.created_at, primaryRecord.received_at)
      : null;

    const normalizedPersonalLength = primaryRecord
      ? normalize(primaryRecord.patient_specific_text).length
      : 0;

    return {
      sessionIndex: claim.session_index,
      claim,
      record: primaryRecord,
      matchedRecords,
      queuedLateRecord,
      reusedPairs,
      cancelled,
      reused,
      multiple,
      state,
      stateLabel,
      shortStatus,
      latency,
      normalizedPersonalLength
    };
  });

  const recommended =
    sessions.find((s) => s.state === 'reused') ||
    sessions.find((s) => s.state === 'missing') ||
    sessions.find((s) => s.state === 'waiting') ||
    sessions.find((s) => s.state === 'cancelled') ||
    sessions[0];

  const hasR1Issue = result.complete && (result.missing > 0 || result.unclaimed > 0 || result.multiple > 0);

  const gates = [
    {
      code: 'R0',
      name: 'Gerbang Kelengkapan Sumber',
      status: result.complete ? 'pass' : 'hold',
      badge: result.complete ? 'Memadai' : 'Belum lengkap',
      summary: result.complete
        ? `Batch sumber lengkap (${latest.length} catatan unik).`
        : identityErrors.length
          ? `${identityErrors.length} catatan salah identitas peserta/episode.`
          : `Batch sumber belum lengkap (${ep.late_records.length} catatan di antrean tunda).`
    },
    {
      code: 'R1',
      name: 'Pencocokan Sesi Aktif',
      status: !result.complete ? 'muted' : hasR1Issue ? 'warn' : 'pass',
      badge: !result.complete
        ? 'Menunggu R0'
        : hasR1Issue
          ? `${result.missing} selisih sesi`
          : `${result.matched}/${result.claimed} cocok`,
      summary: !result.complete
        ? 'Evaluasi selisih akhir ditunda hingga batch sumber dinyatakan lengkap.'
        : hasR1Issue
          ? `${result.matched} dari ${result.claimed} sesi aktif cocok; ${result.missing} sesi perlu klarifikasi.`
          : `Seluruh ${result.claimed} sesi tagihan aktif memiliki catatan tindakan selesai${result.cancelled ? ` (${result.cancelled} batal dikecualikan)` : ''}.`
    },
    {
      code: 'R2',
      name: 'Kesamaan Isi Personal',
      status: result.reused.length ? 'warn' : 'pass',
      badge: result.reused.length ? `${result.reused.length} kemiripan` : 'Unik / normal',
      summary: result.reused.length
        ? `Ditemukan isi personal identik (≥60 karakter) dengan ${result.reused.map((x) => x.other_episode_id).join(', ')}.`
        : 'Tidak ada duplikasi isi personal lintas episode (teks formulir standar dikecualikan).'
    }
  ];

  return {
    result,
    sessions,
    identityErrors,
    recommendedSessionIndex: recommended ? recommended.sessionIndex : 1,
    gates
  };
}

export function computePortfolioAnalytics(episodes) {
  const evaluated = episodes.map((ep) => ({
    ep,
    r: evaluate(ep, episodes)
  }));

  const totals = {
    episodes: evaluated.length,
    consistent: 0,
    review: 0,
    incomplete: 0,
    claimedSessions: 0,
    matchedSessions: 0,
    missingClarificationSessions: 0,
    waitingDataSessions: 0,
    cancelledSessions: 0,
    reusedEpisodes: 0,
    pendingSyncEpisodes: 0,
    pendingSyncRecords: 0,
    reviewedCount: 0
  };

  const facilityMap = new Map();
  const r0Episodes = [];
  const r1Episodes = [];
  const r2Episodes = [];
  const cancelledEpisodes = [];
  const pairSet = new Set();
  const r2Pairs = [];

  const reviewOutcomes = {
    unreviewed: 0,
    pending: 0,
    legitimate: 0,
    confirmed: 0
  };

  evaluated.forEach(({ ep, r }) => {
    totals[r.status] += 1;
    totals.claimedSessions += r.claimed;
    totals.matchedSessions += r.matched;
    totals.cancelledSessions += r.cancelled;

    if (r.complete) {
      totals.missingClarificationSessions += r.missing;
    } else {
      totals.waitingDataSessions += r.missing;
    }

    if (ep.late_records.length > 0) {
      totals.pendingSyncEpisodes += 1;
      totals.pendingSyncRecords += ep.late_records.length;
    }

    if (ep.review) {
      totals.reviewedCount += 1;
      if (reviewOutcomes[ep.review.outcome] !== undefined) {
        reviewOutcomes[ep.review.outcome] += 1;
      }
    } else {
      reviewOutcomes.unreviewed += 1;
    }

    if (!r.complete) r0Episodes.push(ep.episode_id);
    if (r.reasons.some((x) => x.code === 'R1')) r1Episodes.push(ep.episode_id);
    if (r.reused.length > 0) {
      totals.reusedEpisodes += 1;
      r2Episodes.push(ep.episode_id);
      r.reused.forEach((pair) => {
        const key = [ep.episode_id, pair.other_episode_id].sort().join('↔');
        if (!pairSet.has(key)) {
          pairSet.add(key);
          r2Pairs.push({
            key,
            leftEpisode: ep.episode_id,
            rightEpisode: pair.other_episode_id,
            leftRecord: pair.record_id,
            rightRecord: pair.other_record_id,
            sessionIndex: pair.session_index || 2
          });
        }
      });
    }
    if (r.cancelled > 0) cancelledEpisodes.push(ep.episode_id);

    if (!facilityMap.has(ep.facility_id)) {
      facilityMap.set(ep.facility_id, {
        facility_id: ep.facility_id,
        facility_name: ep.facility_name,
        episodes: 0,
        consistent: 0,
        review: 0,
        incomplete: 0,
        claimedSessions: 0,
        matchedSessions: 0,
        missingSessions: 0,
        pendingSyncEpisodes: 0,
        reviewedCount: 0,
        reusedCount: 0
      });
    }
    const f = facilityMap.get(ep.facility_id);
    f.episodes += 1;
    f[r.status] += 1;
    f.claimedSessions += r.claimed;
    f.matchedSessions += r.matched;
    f.missingSessions += r.missing;
    if (ep.late_records.length > 0) f.pendingSyncEpisodes += 1;
    if (ep.review) f.reviewedCount += 1;
    if (r.reused.length > 0) f.reusedCount += 1;
  });

  const facilities = [...facilityMap.values()]
    .map((f) => ({
      ...f,
      matchRate: f.claimedSessions ? Math.round((f.matchedSessions / f.claimedSessions) * 100) : 100
    }))
    .sort((a, b) => a.facility_name.localeCompare(b.facility_name));

  totals.matchRate = totals.claimedSessions
    ? Math.round((totals.matchedSessions / totals.claimedSessions) * 100)
    : 100;

  return {
    totals,
    facilities,
    rules: {
      r0Episodes,
      r1Episodes,
      r2Episodes,
      cancelledEpisodes,
      r2Pairs
    },
    reviewOutcomes
  };
}

export function buildClarificationTicket(ep, all) {
  const inspection = inspectEpisode(ep, all);
  const { result, sessions } = inspection;

  const ticketNumber = `KLAR-${ep.episode_id.replace('EP-', '')}-202609`;
  const categoryTitle =
    result.status === 'incomplete'
      ? 'PERMINTAAN PELENGKAPAN DATA SUMBER (R0)'
      : result.status === 'review'
        ? 'PERMINTAAN KLARIFIKASI BUKTI SESI LAYANAN (R1/R2)'
        : 'RINGKASAN PEMERIKSAAN BUKTI SESI KONSISTEN';

  const items = [];
  if (!result.complete) {
    const waitingSessions = sessions.filter((s) => s.state === 'waiting');
    items.push({
      code: 'R0',
      heading: 'Konfirmasi Kelengkapan Pengiriman Batch RME',
      description: `Cakupan sumber untuk ${ep.episode_id} (${ep.period}) tercatat belum lengkap. Mohon konfirmasi sinkronisasi catatan tindakan fisioterapi pada ${waitingSessions.length} sesi yang belum diterima: ${waitingSessions.map((s) => `Sesi ${s.sessionIndex} (${s.claim.service_date}, ref ${s.claim.line_id})`).join('; ') || 'periksa pemetaan identitas catatan'}.`
    });
  }

  const missingSessions = sessions.filter((s) => s.state === 'missing');
  if (missingSessions.length > 0) {
    items.push({
      code: 'R1',
      heading: 'Klarifikasi Sesi Aktif Tanpa Catatan Tindakan Cocok',
      description: `Batch sumber telah dinyatakan lengkap, namun terdapat ${missingSessions.length} sesi tagihan aktif tanpa rujukan catatan RME berstatus selesai: ${missingSessions.map((s) => `Sesi ${s.sessionIndex} (${s.claim.service_date} · ${s.claim.line_id})`).join(', ')}. Mohon lampirkan bukti pelayanan/registrasi kunjungan atau konfirmasi koreksi tagihan.`
    });
  }

  if (result.reused.length > 0) {
    result.reused.forEach((pair) => {
      items.push({
        code: 'R2',
        heading: `Konfirmasi Kesamaan Isi Catatan Personal (${pair.record_id})`,
        description: `Jumlah sesi tagihan cocok (${result.matched}/${result.claimed}), namun teks tindak lanjut individual pada ${pair.record_id} identik setelah normalisasi dengan catatan episode lain (${pair.other_record_id} / ${pair.other_episode_id}). Formulir standar telah dikecualikan. Mohon konfirmasi dokumentasi asesmen klinis individual pada sesi tersebut.`
      });
    });
  }

  if (result.cancelled > 0) {
    const cancelledList = sessions.filter((s) => s.cancelled);
    items.push({
      code: 'INFO',
      heading: 'Pengecualian Sesi Dibatalkan Resmi',
      description: `${result.cancelled} sesi yang dibatalkan resmi (${cancelledList.map((s) => `${s.claim.line_id} rev.${s.claim.revision}`).join(', ')}) telah dikecualikan dari kewajiban bukti sesi aktif.`
    });
  }

  if (items.length === 0) {
    items.push({
      code: 'OK',
      heading: 'Kesesuaian Bukti Sesi Terpenuhi',
      description: `Seluruh ${result.claimed} sesi tagihan aktif pada ${ep.episode_id} memiliki rujukan catatan RME selesai yang saling bersesuaian (${sessions.filter((s) => s.record).map((s) => s.record.record_id).join(', ')}). Tidak diperlukan permintaan klarifikasi tambahan saat ini.`
    });
  }

  const governanceNotes = [
    'Dokumen simulasi ini adalah alat bantu penelusuran administrasi klaim berdasarkan Permenkes No. 16 Tahun 2019, bukan putusan kecurangan (fraud) atau pemotongan pembayaran otomatis.',
    'Sesuai prinsip pelindungan data pribadi (UU No. 27 Tahun 2022), antarmuka analitik menggunakan token peserta (P-DEMO-xxx); pencocokan identitas pasien sebenarnya hanya dilakukan pada lingkungan berizin di fasilitas kesehatan / BPJS Kesehatan.',
    'Keputusan akhir verifikasi dan dampak pembiayaan tetap mengikuti prosedur ajudikasi resmi pejabat berwenang.'
  ];

  const lines = [
    `=== JEJAK JKN — ${categoryTitle} ===`,
    `Nomor Referensi : ${ticketNumber}`,
    `Fasilitas       : ${ep.facility_name} (${ep.facility_id})`,
    `Episode / Klaim : ${ep.episode_id} / ${ep.claim_id} (Revisi v${ep.claim_version})`,
    `Token Peserta   : ${ep.patient_token} [DATA SINTETIS]`,
    `Periode Layanan : ${ep.period}`,
    `Status Mesin    : ${result.label} (${result.matched}/${result.claimed} sesi aktif cocok · ${VERSION})`,
    '',
    'POIN PENELUSURAN & KLARIFIKASI:',
    ...items.map((item, idx) => `${idx + 1}. [${item.code}] ${item.heading}\n   ${item.description}`),
    '',
    ep.review
      ? `CATATAN VERIFIKATOR (${outcomeLabels[ep.review.outcome]}):\n"${ep.review.note}" — ${ep.review.actor} (${ep.review.at})\n`
      : 'CATATAN VERIFIKATOR:\nBelum ada catatan tindak lanjut manual yang disimpan.\n',
    'CATATAN TATA KELOLA:',
    ...governanceNotes.map((g) => `- ${g}`)
  ];

  return {
    ticketNumber,
    categoryTitle,
    generatedAt: new Date().toISOString(),
    episode: ep,
    result,
    sessions,
    items,
    governanceNotes,
    plainText: lines.join('\n')
  };
}

export const JejakEngine = {
  VERSION,
  ASOF,
  labels,
  outcomeLabels,
  clone,
  normalize,
  makeDataset,
  latestRecords,
  evaluate,
  sync,
  formatLatency,
  inspectEpisode,
  computePortfolioAnalytics,
  buildClarificationTicket
};

if (typeof globalThis !== 'undefined') {
  globalThis.JejakEngine = JejakEngine;
}

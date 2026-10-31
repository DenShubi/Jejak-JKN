import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VERSION,
  makeDataset,
  evaluate,
  sync,
  inspectEpisode,
  computePortfolioAnalytics,
  buildClarificationTicket
} from '../src/engine/jejakEngine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

test('0. Dataset parity: makeDataset() matches JEJAK-JKN-Data-Sintetis.json exactly', () => {
  const diskJson = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'JEJAK-JKN-Data-Sintetis.json'), 'utf8')
  );
  const generated = makeDataset();
  assert.equal(generated.episodes.length, 40);
  assert.deepEqual(generated, diskJson);
});

test('1. 40 episode memiliki ID unik', () => {
  const ds = makeDataset();
  const ids = new Set(ds.episodes.map((e) => e.episode_id));
  assert.equal(ds.episodes.length, 40);
  assert.equal(ids.size, 40);
});

test('2. Snapshot awal memiliki 20 konsisten 14 klarifikasi 6 belum lengkap', () => {
  const ds = makeDataset();
  const counts = { consistent: 0, review: 0, incomplete: 0 };
  ds.episodes.forEach((ep) => {
    const r = evaluate(ep, ds.episodes);
    counts[r.status] += 1;
  });
  assert.equal(counts.consistent, 20);
  assert.equal(counts.review, 14);
  assert.equal(counts.incomplete, 6);
});

test('3. 12 sesi ditagihkan 8 catatan cocok menunjukkan 4 sesi yang belum cocok', () => {
  const ds = makeDataset();
  const ep2 = ds.episodes.find((e) => e.episode_id === 'EP-002');
  const r = evaluate(ep2, ds.episodes);
  assert.equal(r.claimed, 12);
  assert.equal(r.matched, 8);
  assert.equal(r.missing, 4);
  assert.deepEqual(r.missing_indexes, [9, 10, 11, 12]);
  assert.equal(r.status, 'review');
});

test('4. Sumber belum lengkap menghasilkan permintaan data tanpa R1', () => {
  const ds = makeDataset();
  const ep1 = ds.episodes.find((e) => e.episode_id === 'EP-001');
  const r = evaluate(ep1, ds.episodes);
  assert.equal(r.status, 'incomplete');
  assert.equal(r.reasons.some((x) => x.code === 'R0'), true);
  assert.equal(r.reasons.some((x) => x.code === 'R1'), false);
});

test('5. Sinkronisasi parsial meninggalkan 2 sesi untuk klarifikasi', () => {
  const ds = makeDataset();
  const ep1 = ds.episodes.find((e) => e.episode_id === 'EP-001');
  assert.equal(sync(ep1), true);
  const r = evaluate(ep1, ds.episodes);
  assert.equal(r.complete, true);
  assert.equal(r.matched, 10);
  assert.equal(r.missing, 2);
  assert.equal(r.status, 'review');
  assert.equal(r.reasons.some((x) => x.code === 'R1'), true);
});

test('6. Sinkronisasi lengkap pada episode terlambat menghapus permintaan data', () => {
  const ds = makeDataset();
  const ep10 = ds.episodes.find((e) => e.episode_id === 'EP-010');
  assert.equal(evaluate(ep10, ds.episodes).status, 'incomplete');
  assert.equal(sync(ep10), true);
  const r = evaluate(ep10, ds.episodes);
  assert.equal(r.status, 'consistent');
  assert.equal(r.matched, 6);
  assert.equal(r.missing, 0);
  assert.equal(r.reasons.length, 0);
});

test('7. Sinkronisasi ulang tidak menggandakan catatan', () => {
  const ds = makeDataset();
  const ep10 = ds.episodes.find((e) => e.episode_id === 'EP-010');
  assert.equal(sync(ep10), true);
  const countAfterFirst = ep10.records.length;
  assert.equal(sync(ep10), false);
  assert.equal(ep10.records.length, countAfterFirst);
});

test('8. Catatan personal identik menghubungkan dua peserta berbeda', () => {
  const ds = makeDataset();
  const ep15 = ds.episodes.find((e) => e.episode_id === 'EP-015');
  const r = evaluate(ep15, ds.episodes);
  assert.equal(r.status, 'review');
  assert.equal(r.matched, 6);
  assert.equal(r.claimed, 6);
  assert.equal(r.reused.length, 1);
  assert.equal(r.reused[0].other_episode_id, 'EP-016');
  assert.equal(r.reused[0].other_patient_token, 'P-DEMO-016');
});

test('9. Formulir standar sama tidak menghasilkan peringatan', () => {
  const ds = makeDataset();
  const ep21 = ds.episodes.find((e) => e.episode_id === 'EP-021');
  const ep22 = ds.episodes.find((e) => e.episode_id === 'EP-022');
  assert.equal(ep21.records[0].template_text, ep22.records[0].template_text);
  const r = evaluate(ep21, ds.episodes);
  assert.equal(r.reused.length, 0);
  assert.equal(r.status, 'consistent');
});

test('10. Teks personal kosong tidak menghasilkan pasangan duplikasi', () => {
  const ds = makeDataset();
  const ep21 = ds.episodes.find((e) => e.episode_id === 'EP-021');
  const ep22 = ds.episodes.find((e) => e.episode_id === 'EP-022');
  ep21.records[0].patient_specific_text = '   ';
  ep22.records[0].patient_specific_text = '';
  const r = evaluate(ep21, ds.episodes);
  assert.equal(r.reused.length, 0);
});

test('11. Pembatalan resmi mengurangi sesi aktif dan mengecualikan catatan not-done', () => {
  const ds = makeDataset();
  const ep39 = ds.episodes.find((e) => e.episode_id === 'EP-039');
  const r = evaluate(ep39, ds.episodes);
  assert.equal(r.cancelled, 2);
  assert.equal(r.claimed, 4);
  assert.equal(r.matched, 4);
  assert.equal(r.status, 'consistent');
});

test('12. Catatan salah peserta masuk masalah kualitas data', () => {
  const ds = makeDataset();
  const ep25 = ds.episodes.find((e) => e.episode_id === 'EP-025');
  ep25.records[0].patient_token = 'P-SALAH-999';
  const r = evaluate(ep25, ds.episodes);
  assert.equal(r.complete, false);
  assert.equal(r.status, 'incomplete');
  assert.equal(r.reasons[0].code, 'R0');
  assert.match(r.reasons[0].detail, /identitas/);
});

test('13. Tanggal layanan salah tidak bisa mengisi sesi yang hilang', () => {
  const ds = makeDataset();
  const ep2 = ds.episodes.find((e) => e.episode_id === 'EP-002');
  ep2.records.push({
    ...ep2.records[0],
    record_id: 'REC-002-9-WRONGDATE',
    session_index: 9,
    service_date: '2026-09-30'
  });
  const r = evaluate(ep2, ds.episodes);
  assert.equal(r.missing_indexes.includes(9), true);
  assert.equal(r.unclaimed, 1);
});

test('14. Pengiriman ulang record_id sama dihitung sekali', () => {
  const ds = makeDataset();
  const ep21 = ds.episodes.find((e) => e.episode_id === 'EP-021');
  ep21.records.push({ ...ep21.records[0] });
  const r = evaluate(ep21, ds.episodes);
  assert.equal(r.valid_records, 6);
  assert.equal(r.multiple, 0);
  assert.equal(r.status, 'consistent');
});

test('15. Versi catatan terbaru mengalahkan versi lama', () => {
  const ds = makeDataset();
  const ep21 = ds.episodes.find((e) => e.episode_id === 'EP-021');
  ep21.records.push({
    ...ep21.records[5],
    version: 2,
    status: 'not-done'
  });
  const r = evaluate(ep21, ds.episodes);
  assert.equal(r.matched, 5);
  assert.equal(r.missing, 1);
  assert.equal(r.status, 'review');
});

test('16. Label skenario tidak digunakan oleh mesin pemeriksaan', () => {
  const ds = makeDataset();
  const ep21 = ds.episodes.find((e) => e.episode_id === 'EP-021');
  ep21.scenario_label = 'mismatch';
  const r = evaluate(ep21, ds.episodes);
  assert.equal(r.status, 'consistent');
  assert.equal(r.rule_version, VERSION);
});

test('17. Inspector, Portfolio Analytics & Clarification Ticket helpers produce expected structures', () => {
  const ds = makeDataset();
  const ep15 = ds.episodes.find((e) => e.episode_id === 'EP-015');
  const inspection = inspectEpisode(ep15, ds.episodes);
  assert.equal(inspection.recommendedSessionIndex, 2);
  assert.equal(inspection.sessions[1].state, 'reused');

  const ep39 = ds.episodes.find((e) => e.episode_id === 'EP-039');
  const insp39 = inspectEpisode(ep39, ds.episodes);
  assert.equal(insp39.recommendedSessionIndex, 5);
  assert.equal(insp39.sessions[4].record.status, 'not-done');

  const analytics = computePortfolioAnalytics(ds.episodes);
  assert.equal(analytics.totals.episodes, 40);
  assert.equal(analytics.facilities.length, 3);
  assert.equal(analytics.rules.r2Pairs.length, 3);

  const ticket = buildClarificationTicket(ep15, ds.episodes);
  assert.match(ticket.plainText, /R2/);
  assert.match(ticket.plainText, /EP-016/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDataset, evaluate } from '../src/engine/jejakEngine.js';
import {
  applySubmission,
  applyReview,
  buildFaskesPresets,
  buildPresetSubmission,
  faskesEpisodeView
} from '../src/engine/ingest.js';

const CAKRA = 'F-DEMO-3';
const BIMA = 'F-DEMO-2';
const find = (ds, id) => ds.episodes.find((e) => e.episode_id === id);
const asRow = (body, extra = {}) => ({
  id: `row-${Math.random()}`,
  room: 'TEST',
  submitted_by: 'u-1',
  submitted_by_name: 'Petugas Uji',
  created_at: '2026-10-31T12:00:00.000Z',
  ...body,
  ...extra
});

test('L1. Preset per faskes hanya menargetkan episode milik faskes tersebut', () => {
  const ds = makeDataset();
  for (const facilityId of ['F-DEMO-1', BIMA, CAKRA]) {
    buildFaskesPresets(ds, facilityId)
      .filter((p) => p.target)
      .forEach((p) => assert.equal(find(ds, p.target.episodeId).facility_id, facilityId));
  }
  const cakra = buildFaskesPresets(ds, CAKRA);
  assert.deepEqual(cakra.find((p) => p.id === 'valid').target.episodeId, 'EP-002');
  assert.equal(cakra.find((p) => p.id === 'valid').target.sessionIndex, 9);
});

test('L2. Catatan sah dari faskes membuat EP-002 menjadi 9/12 cocok', () => {
  const ds = makeDataset();
  const body = buildPresetSubmission(ds, 'valid', CAKRA);
  const res = applySubmission(ds, asRow(body));
  assert.equal(res.applied, true);
  assert.deepEqual(res.sessions, [9]);
  const r = evaluate(find(ds, 'EP-002'), ds.episodes);
  assert.equal(r.matched, 9);
  assert.equal(r.missing, 3);
  assert.equal(r.status, 'review');
});

test('L3. Batch terlambat dari RS Bima melengkapi R0 EP-001 (10/12, klarifikasi)', () => {
  const ds = makeDataset();
  const body = buildPresetSubmission(ds, 'outbox', BIMA);
  assert.equal(body.episode_id, 'EP-001');
  applySubmission(ds, asRow(body));
  const ep1 = find(ds, 'EP-001');
  const r = evaluate(ep1, ds.episodes);
  assert.equal(ep1.late_records.length, 0);
  assert.equal(r.complete, true);
  assert.equal(r.matched, 10);
  assert.equal(r.status, 'review');
});

test('L4. Catatan kloning mengisi sesi tetapi memicu sinyal R2', () => {
  const ds = makeDataset();
  const body = buildPresetSubmission(ds, 'clone', CAKRA);
  assert.equal(body.episode_id, 'EP-005');
  applySubmission(ds, asRow(body));
  const r = evaluate(find(ds, 'EP-005'), ds.episodes);
  assert.equal(r.matched, 11);
  assert.ok(r.reused.length >= 1);
  assert.ok(r.reasons.some((x) => x.code === 'R2'));
});

test('L5. Koreksi pembatalan mengecualikan baris tagihan', () => {
  const ds = makeDataset();
  const body = buildPresetSubmission(ds, 'cancel', CAKRA);
  const before = evaluate(find(ds, body.episode_id), ds.episodes);
  applySubmission(ds, asRow(body));
  const after = evaluate(find(ds, body.episode_id), ds.episodes);
  assert.equal(after.cancelled, before.cancelled + 1);
  assert.equal(after.claimed, before.claimed - 1);
  assert.equal(after.missing, before.missing - 1);
});

test('L6. Kiriman dengan faskes tidak cocok ditolak', () => {
  const ds = makeDataset();
  const body = buildPresetSubmission(ds, 'valid', CAKRA);
  const res = applySubmission(ds, asRow({ ...body, facility_id: 'F-DEMO-1' }));
  assert.equal(res.applied, false);
  assert.equal(res.reason, 'facility-mismatch');
  assert.equal(evaluate(find(ds, 'EP-002'), ds.episodes).matched, 8);
});

test('L7. Kiriman ganda record_id yang sama tetap dihitung sekali', () => {
  const ds = makeDataset();
  const body = buildPresetSubmission(ds, 'valid', CAKRA);
  applySubmission(ds, asRow(body));
  applySubmission(ds, asRow(body));
  assert.equal(evaluate(find(ds, 'EP-002'), ds.episodes).matched, 9);
});

test('L8. Tindak lanjut tersimpan diterapkan tanpa mengubah status aturan', () => {
  const ds = makeDataset();
  applyReview(ds, { episode_id: 'EP-002', outcome: 'pending', note: 'Uji', actor_name: 'V', updated_at: 'x' });
  const ep2 = find(ds, 'EP-002');
  assert.equal(ep2.review.outcome, 'pending');
  assert.equal(evaluate(ep2, ds.episodes).status, 'review');
});

test('L9. Tampilan faskes menunjukkan catatan terkirim dan antrean kirim', () => {
  const ds = makeDataset();
  const view = faskesEpisodeView(find(ds, 'EP-001'), ds);
  assert.equal(view.sent, 8);
  assert.equal(view.outbox, 2);
  assert.equal(view.sessions.filter((s) => s.state === 'outbox').length, 2);
});

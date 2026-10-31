// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { JejakEngine } from '../src/engine/jejakEngine.js';
import {
  applySubmission,
  applyReview,
  buildFaskesPresets,
  buildPresetSubmission
} from '../src/engine/ingest.js';
import { DEMO_ACCOUNTS, sanitizeRoom } from '../src/config.js';

test('R1. Sanitize room code removes special chars and upper-cases', () => {
  assert.equal(sanitizeRoom('room 2026!'), 'ROOM2026');
  assert.equal(sanitizeRoom('healthkathon-demo'), 'HEALTHKATHON-DEMO');
  assert.equal(sanitizeRoom(''), 'HEALTHKATHON-2026');
});

test('R2. Demo accounts cover verifikator and all three simulation hospitals', () => {
  const keys = DEMO_ACCOUNTS.map((a) => a.key);
  assert.deepEqual(keys, ['verifikator', 'aruna', 'bima', 'cakra']);

  const verifikator = DEMO_ACCOUNTS.find((a) => a.key === 'verifikator');
  assert.equal(verifikator?.role, 'verifikator');
  assert.equal(verifikator?.facilityId, null);

  const cakra = DEMO_ACCOUNTS.find((a) => a.key === 'cakra');
  assert.equal(cakra?.role, 'faskes');
  assert.equal(cakra?.facilityId, 'F-DEMO-3');
});

test('R3. End-to-end multi-role flow: Petugas Cakra submits Sesi 9 to EP-002, Verifikator receives and evaluates', () => {
  const dataset = JejakEngine.makeDataset();
  const ep2Before = dataset.episodes.find((e) => e.episode_id === 'EP-002');
  assert.ok(ep2Before);

  const evalBefore = JejakEngine.evaluate(ep2Before, dataset.episodes);
  assert.equal(evalBefore.claimed, 12);
  assert.equal(evalBefore.matched, 8);
  assert.equal(evalBefore.missing, 4);
  assert.ok(evalBefore.missing_indexes.includes(9));

  // Friend at RS Cakra submits valid session 9 via preset
  const submission = buildPresetSubmission(dataset, 'valid', 'F-DEMO-3');
  assert.ok(submission);
  assert.equal(submission.episode_id, 'EP-002');

  const res = applySubmission(dataset, {
    ...submission,
    submitted_by_name: 'Petugas RME RS Cakra',
    created_at: '2026-09-02T10:00:00Z'
  });

  assert.equal(res.applied, true);
  assert.deepEqual(res.sessions, [9]);

  // Verifikator re-evaluates EP-002
  const evalAfter = JejakEngine.evaluate(ep2Before, dataset.episodes);
  assert.equal(evalAfter.matched, 9);
  assert.equal(evalAfter.missing, 3);
  assert.equal(evalAfter.missing_indexes.includes(9), false);
});

test('R4. End-to-end two-way clarification flow between Verifikator and Faskes', () => {
  const dataset = JejakEngine.makeDataset();
  const ep1 = dataset.episodes.find((e) => e.episode_id === 'EP-001');
  assert.ok(ep1);

  // 1. Verifikator builds ticket for EP-001 (R0 gate issue)
  const ticket = JejakEngine.buildClarificationTicket(ep1, dataset.episodes);
  assert.equal(ticket.ticketNumber, 'KLAR-001-202609');
  assert.equal(ticket.result.status, 'incomplete');
  assert.ok(ticket.items.some((i) => i.code === 'R0'));

  // 2. Faskes (RS Bima) reviews ticket and submits delayed batch
  const outboxSubmission = buildPresetSubmission(dataset, 'outbox', 'F-DEMO-2');
  assert.ok(outboxSubmission);
  const ingestRes = applySubmission(dataset, outboxSubmission);
  assert.equal(ingestRes.applied, true);

  // 3. Faskes submits reply
  const reply = {
    ticket_id: ticket.ticketNumber,
    episode_id: ep1.episode_id,
    reply_text: 'Batch catatan terlambat dari server lokal RS Bima telah berhasil disinkronkan.',
    replied_at: new Date().toISOString()
  };
  assert.equal(reply.ticket_id, 'KLAR-001-202609');

  // 4. Verifikator records decision
  const reviewOk = applyReview(dataset, {
    episode_id: ep1.episode_id,
    outcome: 'legitimate',
    note: reply.reply_text,
    actor_name: 'Verifikator BPJS'
  });
  assert.equal(reviewOk, true);
  assert.equal(ep1.review?.outcome, 'legitimate');
});

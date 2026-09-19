import test from "node:test";
import assert from "node:assert/strict";
import { loadSequence, renderEmailHtml, renderEmailText } from "../api/_lib/sequence-content.js";
import { buildSequenceIdempotencyKey, nextDailyCronDueAt } from "../api/_lib/sequence-schedule.js";

test("sequence content has six complete daily emails and the real purchase URL", () => {
  const sequence = loadSequence();
  const minimumWords = [200, 300, 350, 300, 280, 220];
  assert.equal(sequence.length, 6);
  for (const [index, email] of sequence.entries()) {
    assert.equal(email.number, index + 1);
    assert.ok(email.subject.length > 0);
    assert.ok(email.preview.length > 0);
    assert.match(email.body, /https:\/\/www\.cuidatebien\.com\/zca/);
    assert.doesNotMatch(email.body, /\[LINK DE COMPRA\]|garantía|vence hoy/i);
    assert.ok(email.body.trim().split(/\s+/).length >= minimumWords[index]);
  }
});

test("email renderers escape subscriber input and include purchase and unsubscribe links", () => {
  const sequenceEmail = loadSequence()[0];
  const input = {
    name: "<script>alert(1)</script>",
    unsubscribeUrl: "https://cuidatebien.com/api/unsubscribe?token=test-token",
    sequenceEmail,
  };

  const html = renderEmailHtml(input);
  const text = renderEmailText(input);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /https:\/\/www\.cuidatebien\.com\/zca/);
  assert.match(html, /Darte de baja/);
  assert.match(text, /https:\/\/www\.cuidatebien\.com\/zca/);
  assert.match(text, /api\/unsubscribe/);
});

test("daily scheduling targets noon UTC on the next calendar day", () => {
  assert.equal(
    nextDailyCronDueAt(new Date("2026-09-19T00:01:00.000Z")).toISOString(),
    "2026-09-20T12:00:00.000Z",
  );
  assert.equal(
    nextDailyCronDueAt(new Date("2026-09-19T23:59:59.999Z")).toISOString(),
    "2026-09-20T12:00:00.000Z",
  );
  assert.equal(
    nextDailyCronDueAt(new Date("2026-12-31T23:59:59.999Z")).toISOString(),
    "2027-01-01T12:00:00.000Z",
  );
});

test("sequence idempotency keys isolate each consent generation", () => {
  const firstConsent = buildSequenceIdempotencyKey("lead-123", 1, 1);
  const renewedConsent = buildSequenceIdempotencyKey("lead-123", 2, 1);

  assert.equal(firstConsent, "zca-lead-recovery/lead-123/1/1");
  assert.equal(renewedConsent, "zca-lead-recovery/lead-123/2/1");
  assert.notEqual(firstConsent, renewedConsent);
  assert.throws(() => buildSequenceIdempotencyKey("lead-123", 0, 1), /positive generation/);
});

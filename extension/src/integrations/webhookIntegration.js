'use strict';
const { assertMetadataOnly } = require('./eventStream');

/**
 * Generic webhook integration (QC-52).
 *
 * Same defense-in-depth principle as QC-51's Slack integration:
 * independently re-validates the event is metadata-only before ever
 * sending it anywhere, so a bug upstream can't leak content through this
 * path either. Unlike Slack, there's no human-readable message to build —
 * this delivers the raw event as a versioned JSON envelope, since the
 * receiving end is whatever arbitrary service the user configured, not a
 * known chat product with a specific expected shape.
 */

const WEBHOOK_PAYLOAD_VERSION = 1;

function buildWebhookPayload(event) {
  assertMetadataOnly(event); // re-validate independently — see module doc
  return { version: WEBHOOK_PAYLOAD_VERSION, event };
}

async function sendWebhookNotification(event, webhookUrl, fetchImpl = globalThis.fetch) {
  const payload = buildWebhookPayload(event); // throws before any network call if event is unsafe
  return fetchImpl(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

module.exports = { buildWebhookPayload, sendWebhookNotification, WEBHOOK_PAYLOAD_VERSION };

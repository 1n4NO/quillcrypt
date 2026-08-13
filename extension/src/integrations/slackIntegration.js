'use strict';
const { assertMetadataOnly } = require('./eventStream');

/**
 * Slack notification integration (QC-51).
 *
 * Consumes events from QC-50's EventStream and posts human-readable
 * notifications to a Slack incoming webhook. Deliberately re-validates
 * `assertMetadataOnly()` independently here, even though EventStream
 * already guarantees it — this is defense in depth specifically for this
 * ticket's stated goal ("built entirely from encrypted-metadata events"):
 * if a future bug ever fed this function something that wasn't
 * metadata-only, it refuses to send rather than silently forwarding
 * whatever it was given.
 *
 * `fetchImpl` is injectable (same pattern as WebSocketImpl throughout this
 * project) so this can be tested without making real network calls — no
 * live Slack webhook exists in the test environment.
 */

const EVENT_VERBS = {
  'annotation-added': 'added',
  'annotation-updated': 'updated',
  'annotation-deleted': 'deleted',
};

function buildSlackMessage(event) {
  assertMetadataOnly(event); // re-validate independently — see module doc
  const verb = EVENT_VERBS[event.type] || event.type;
  const authorPart = event.authorId ? `*${event.authorId}*` : 'someone';
  const pageHint = event.urlHash.slice(0, 8); // short prefix only, never the reversible full URL itself in this context
  return {
    text: `${authorPart} ${verb} an annotation on workspace \`${event.workspaceId}\` (page ${pageHint}…)`,
  };
}

async function sendSlackNotification(event, webhookUrl, fetchImpl = globalThis.fetch) {
  const message = buildSlackMessage(event); // throws before any network call if event is unsafe
  return fetchImpl(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  });
}

module.exports = { buildSlackMessage, sendSlackNotification };

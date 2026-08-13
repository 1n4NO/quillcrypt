'use strict';
const { buildSlackMessage, sendSlackNotification } = require('../src/integrations/slackIntegration');
const { buildWebhookPayload, sendWebhookNotification, WEBHOOK_PAYLOAD_VERSION } = require('../src/integrations/webhookIntegration');

let pass = 0, fail = 0;
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label);
  cond ? pass++ : fail++;
}

const validEvent = {
  type: 'annotation-added',
  workspaceId: 'ws-1',
  urlHash: 'abcdef1234567890',
  authorId: 'alice',
  annotationId: 'ann-1',
  timestamp: Date.now(),
};
const leakyEvent = { ...validEvent, content: 'this must never reach any integration' };

async function main() {
  const message = buildSlackMessage(validEvent);
  check('Slack message references the author id', message.text.includes('alice'));
  check('Slack message references the workspace id', message.text.includes('ws-1'));
  check('Slack message uses only a short URL hash prefix, not the full hash', message.text.includes('abcdef12') && !message.text.includes(validEvent.urlHash));

  const slackFetchCalls = [];
  const mockSlackFetch = async (url, options) => { slackFetchCalls.push({ url, options }); return { ok: true }; };
  await sendSlackNotification(validEvent, 'https://hooks.slack.com/services/FAKE', mockSlackFetch);
  check('Slack: fetch called exactly once for a valid event', slackFetchCalls.length === 1);
  check('Slack: fetch called with POST', slackFetchCalls[0].options.method === 'POST');

  const leakySlackFetchCalls = [];
  let slackThrew = false;
  try {
    await sendSlackNotification(leakyEvent, 'https://hooks.slack.com/services/FAKE', async (...args) => { leakySlackFetchCalls.push(args); });
  } catch (e) { slackThrew = true; }
  check('Slack: throws for a non-metadata-only event', slackThrew);
  check('Slack: fetch NEVER called for the leaky event', leakySlackFetchCalls.length === 0);

  const payload = buildWebhookPayload(validEvent);
  check('webhook payload includes a version number', payload.version === WEBHOOK_PAYLOAD_VERSION);
  check('webhook payload wraps the exact event unchanged', JSON.stringify(payload.event) === JSON.stringify(validEvent));

  const webhookFetchCalls = [];
  const mockWebhookFetch = async (url, options) => { webhookFetchCalls.push({ url, options }); return { ok: true }; };
  await sendWebhookNotification(validEvent, 'https://example.com/my-webhook', mockWebhookFetch);
  check('webhook: fetch called exactly once for a valid event', webhookFetchCalls.length === 1);
  check('webhook: fetch called with the correct configured URL', webhookFetchCalls[0].url === 'https://example.com/my-webhook');

  const sentPayload = JSON.parse(webhookFetchCalls[0].options.body);
  check('webhook: sent body matches the expected versioned envelope shape', sentPayload.version === 1 && sentPayload.event.annotationId === 'ann-1');

  const leakyWebhookFetchCalls = [];
  let webhookThrew = false;
  try {
    await sendWebhookNotification(leakyEvent, 'https://example.com/my-webhook', async (...args) => { leakyWebhookFetchCalls.push(args); });
  } catch (e) { webhookThrew = true; }
  check('webhook: throws for a non-metadata-only event', webhookThrew);
  check('webhook: fetch NEVER called for the leaky event', leakyWebhookFetchCalls.length === 0);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();

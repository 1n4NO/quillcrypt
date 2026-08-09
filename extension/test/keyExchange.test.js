'use strict';
const {
  generateWorkspaceKey,
  encodeKey,
  buildInviteLink,
  extractKeyFromUrl,
  buildApiRequestUrl,
} = require('../src/crypto/keyExchange');

let pass = 0, fail = 0;
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label);
  cond ? pass++ : fail++;
}

async function main() {
  const key = await generateWorkspaceKey();
  const encodedKey = encodeKey(key);

  const inviteUrl = buildInviteLink('https://app.quillcrypt.dev', 'workspace-abc123', key);

  check('invite link fragment contains the encoded key', inviteUrl.hash.includes(encodedKey));
  check('invite link path/search do NOT contain the encoded key', !(inviteUrl.pathname + inviteUrl.search).includes(encodedKey));

  // ---- Round trip: the joining client extracts the same key ----
  const extracted = extractKeyFromUrl(inviteUrl);
  check('extracted key round-trips correctly', Buffer.compare(Buffer.from(extracted), Buffer.from(key)) === 0);

  // ---- Sanity check the mechanism is real: full href DOES contain the key ----
  // (This is expected and fine — the fragment is genuinely part of the URL,
  // it's just never transmitted on navigation/fetch. The danger is a
  // developer naively using url.href or url.toString() when building a
  // network request instead of an origin+path builder.)
  check('sanity: the full href does contain the key (fragment is real, not stripped at creation)', inviteUrl.href.includes(encodedKey));

  // ---- Simulate every network request the app would realistically make ----
  const simulatedRequests = [
    buildApiRequestUrl(inviteUrl, '/api/workspace/workspace-abc123/metadata'),
    buildApiRequestUrl(inviteUrl, '/api/workspace/workspace-abc123/members'),
    `wss://relay.quillcrypt.dev/sync?room=workspace-abc123`, // relay connect — room id only, never the key
  ];

  const anyRequestLeaksKey = simulatedRequests.some((req) => req.includes(encodedKey));
  check('none of the simulated network requests contain the key', !anyRequestLeaksKey);

  // ---- Guardrail check: demonstrate the naive mistake this is meant to catch ----
  const naiveRequest = inviteUrl.href; // what NOT to do
  check(
    'documented risk: naively using url.href as a request target would include the key at the application-code level',
    naiveRequest.includes(encodedKey)
  );

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

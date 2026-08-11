'use strict';
const sodium = require('libsodium-wrappers');
const { createWorkspace, deriveRoomId } = require('../src/storage/workspace');
const { buildWorkspaceInviteLink, parseInviteLink } = require('../src/crypto/invite');
const { encodeKey } = require('../src/crypto/keyExchange');

let pass = 0, fail = 0;
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label);
  cond ? pass++ : fail++;
}

async function main() {
  await sodium.ready;
  const key = sodium.crypto_secretbox_keygen();

  const domainWorkspace = createWorkspace({ name: "Alice's Notes", scopeType: 'domain', scopeValue: 'example.com' });
  const domainInvite = buildWorkspaceInviteLink('https://app.quillcrypt.dev', domainWorkspace, key);
  const domainEncodedKey = encodeKey(key);

  check('key is present in the invite link fragment', domainInvite.hash.includes(domainEncodedKey));
  check(
    'key is NOT present anywhere in the path or query string',
    !(domainInvite.pathname + domainInvite.search).includes(domainEncodedKey)
  );

  const domainParsed = parseInviteLink(domainInvite);
  check('parsed workspace has the SAME id as the original (not a freshly generated one)', domainParsed.workspace.id === domainWorkspace.id);
  check('parsed workspace name round-trips correctly', domainParsed.workspace.name === "Alice's Notes");
  check('parsed workspace scopeType round-trips correctly', domainParsed.workspace.scopeType === 'domain');
  check('parsed workspace scopeValue round-trips correctly', domainParsed.workspace.scopeValue === 'example.com');
  check(
    'parsed key matches the original key byte-for-byte',
    Buffer.compare(Buffer.from(domainParsed.key), Buffer.from(key)) === 0
  );

  const urlListWorkspace = createWorkspace({
    name: 'Shared review',
    scopeType: 'urlList',
    scopeValue: ['https://example.com/article-1', 'https://example.com/article-2'],
  });
  const urlListInvite = buildWorkspaceInviteLink('https://app.quillcrypt.dev', urlListWorkspace, key);
  const urlListParsed = parseInviteLink(urlListInvite);

  check('urlList scopeValue round-trips as an array, not a stringified blob', Array.isArray(urlListParsed.workspace.scopeValue));
  check(
    'urlList scopeValue contains the exact same URLs after round-trip',
    urlListParsed.workspace.scopeValue.length === 2 &&
    urlListParsed.workspace.scopeValue.includes('https://example.com/article-1') &&
    urlListParsed.workspace.scopeValue.includes('https://example.com/article-2')
  );

  check(
    'joined workspace derives the IDENTICAL sync room id as the inviter (they actually land in the same room)',
    deriveRoomId(domainParsed.workspace) === deriveRoomId(domainWorkspace)
  );

  const notAnInvite = new URL('https://app.quillcrypt.dev/some/other/page');
  check('parsing a non-invite URL returns null rather than throwing', parseInviteLink(notAnInvite) === null);

  const missingKey = new URL('https://app.quillcrypt.dev/join/abc123?name=Test&scopeType=domain&scopeValue=example.com');
  check('parsing an invite link with no key fragment returns null', parseInviteLink(missingKey) === null);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();

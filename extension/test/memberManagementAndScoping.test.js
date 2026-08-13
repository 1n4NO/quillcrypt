'use strict';
const { ready, generateMemberKeyPair } = require('../src/crypto/primitives');
const { MemberRoster } = require('../src/crypto/membership');
const { WorkspaceMemberController, fingerprintOf } = require('../src/crypto/memberManagement');
const { createWorkspace } = require('../src/storage/workspace');
const { buildScopeOptions, addUrlToWorkspace } = require('../src/storage/scopingHelper');

let pass = 0, fail = 0;
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label);
  cond ? pass++ : fail++;
}

async function main() {
  await ready();

  const roster = new MemberRoster();
  const controller = new WorkspaceMemberController(roster);

  const alice = generateMemberKeyPair();
  const bob = generateMemberKeyPair();
  await controller.addMember('alice', alice.publicKey, 'Alice Chen');
  await controller.addMember('bob', bob.publicKey, 'Bob Diaz');

  const display = await controller.listMembersForDisplay();
  check('listMembersForDisplay returns both members', display.length === 2);
  const aliceDisplay = display.find((m) => m.memberId === 'alice');
  check('display name is included and correct', aliceDisplay.displayName === 'Alice Chen');
  check('fingerprint is a grouped, readable hex string', /^[0-9a-f]{4} [0-9a-f]{4} [0-9a-f]{4} [0-9a-f]{4}$/.test(aliceDisplay.publicKeyFingerprint));

  check('fingerprint is deterministic for the same key', fingerprintOf(alice.publicKey) === fingerprintOf(alice.publicKey));
  check('fingerprint differs for different keys', fingerprintOf(alice.publicKey) !== fingerprintOf(bob.publicKey));

  const { wrappedKeysByMember } = await controller.removeMemberAndRotate('bob');
  check('removing bob triggers rotation — a wrapped key was produced for the remaining member (alice)', wrappedKeysByMember.has('alice'));
  check('removed member has no wrapped key', !wrappedKeysByMember.has('bob'));

  const displayAfterRemoval = await controller.listMembersForDisplay();
  check('bob no longer appears in the display list after removal', displayAfterRemoval.every((m) => m.memberId !== 'bob'));
  check("bob's display name is cleaned up too, not left dangling", !controller.displayNames.has('bob'));

  const options = buildScopeOptions('https://example.com/some/article?ref=x#section');
  check('buildScopeOptions returns exactly two options', options.length === 2);
  const pageOption = options.find((o) => o.scopeType === 'urlList');
  const domainOption = options.find((o) => o.scopeType === 'domain');
  check('the "just this page" option scopeValue is the normalized URL (hash/query handled)', pageOption.scopeValue[0] === 'https://example.com/some/article?ref=x');
  check('the "whole domain" option scopeValue is just the hostname', domainOption.scopeValue === 'example.com');
  check('both options have human-readable labels', pageOption.label === 'Just this page' && domainOption.label.includes('example.com'));

  const urlListWorkspace = createWorkspace({ name: 'Review', scopeType: 'urlList', scopeValue: ['https://example.com/article-1'] });
  const grown = addUrlToWorkspace(urlListWorkspace, 'https://example.com/article-2');
  check('addUrlToWorkspace grows the scope with a new URL', grown.length === 2 && grown.includes('https://example.com/article-2'));

  const grownAgainSameUrl = addUrlToWorkspace(urlListWorkspace, 'https://example.com/article-1');
  check('adding a URL already covered does not create a duplicate', grownAgainSameUrl.length === 1);

  check(
    'addUrlToWorkspace rejects being called on a domain-scoped workspace',
    (() => {
      const domainWs = createWorkspace({ name: 'X', scopeType: 'domain', scopeValue: 'example.com' });
      try { addUrlToWorkspace(domainWs, 'https://example.com/x'); return false; }
      catch (e) { return true; }
    })()
  );

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();

'use strict';
const { createWorkspace, matchesUrl, findWorkspacesForUrl, deriveRoomId } = require('../src/storage/workspace');

let pass = 0, fail = 0;
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label);
  cond ? pass++ : fail++;
}

const domainWs = createWorkspace({ name: 'My Notes', scopeType: 'domain', scopeValue: 'example.com' });
check('domain workspace matches a page on that exact hostname', matchesUrl(domainWs, 'https://example.com/some/article'));
check('domain workspace matches regardless of path/query', matchesUrl(domainWs, 'https://example.com/other?x=1'));
check('domain workspace does NOT match a different hostname', !matchesUrl(domainWs, 'https://other.com/some/article'));
check(
  'domain workspace does NOT automatically match a subdomain (deliberate v1 simplicity choice)',
  !matchesUrl(domainWs, 'https://www.example.com/some/article')
);

const urlListWs = createWorkspace({
  name: 'Shared review',
  scopeType: 'urlList',
  scopeValue: ['https://example.com/article-1', 'https://example.com/article-2#some-hash'],
});
check('urlList workspace matches an exact URL in its list', matchesUrl(urlListWs, 'https://example.com/article-1'));
check(
  'urlList workspace matches ignoring hash fragment differences (normalization from QC-12)',
  matchesUrl(urlListWs, 'https://example.com/article-2?nothing=here') === false && matchesUrl(urlListWs, 'https://example.com/article-2')
);
check('urlList workspace does NOT match a URL not in its list', !matchesUrl(urlListWs, 'https://example.com/article-3'));

check(
  'createWorkspace rejects an unknown scopeType',
  (() => { try { createWorkspace({ name: 'x', scopeType: 'bogus', scopeValue: 'x' }); return false; } catch (e) { return true; } })()
);
check(
  'createWorkspace rejects a non-array scopeValue for urlList type',
  (() => { try { createWorkspace({ name: 'x', scopeType: 'urlList', scopeValue: 'not-an-array' }); return false; } catch (e) { return true; } })()
);

const workspaces = [domainWs, urlListWs];
const matchesForArticle1 = findWorkspacesForUrl(workspaces, 'https://example.com/article-1');
check('a URL matching both a domain and urlList workspace returns both', matchesForArticle1.length === 2);
check('the more specific urlList workspace is sorted first', matchesForArticle1[0].scopeType === 'urlList');

const matchesForRandomPage = findWorkspacesForUrl(workspaces, 'https://example.com/random-page');
check('a URL matching only the domain workspace returns just that one', matchesForRandomPage.length === 1 && matchesForRandomPage[0].scopeType === 'domain');

const matchesForUnrelated = findWorkspacesForUrl(workspaces, 'https://totally-different.com/page');
check('a URL matching no workspace returns an empty array', matchesForUnrelated.length === 0);

const roomId1 = deriveRoomId(domainWs);
const roomId2 = deriveRoomId(urlListWs);
check('deriveRoomId produces a stable, deterministic id for the same workspace', deriveRoomId(domainWs) === roomId1);
check('deriveRoomId produces different ids for different workspaces', roomId1 !== roomId2);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

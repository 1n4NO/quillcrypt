'use strict';
const { JSDOM } = require('jsdom');
const { mountRetryObserver } = require('../src/content/retryObserver');

async function main() {
  const dom = new JSDOM('<body><main></main></body>', { url: 'https://example.com/a' });
  let retries = 0;
  const originalPush = dom.window.history.pushState;
  const dispose = mountRetryObserver(dom.window.document, dom.window, {
    hasOrphans: () => true,
    retry: () => { retries++; },
    delayMs: 10,
  });
  const pageNode = dom.window.document.createElement('p');
  pageNode.textContent = 'late content';
  dom.window.document.querySelector('main').appendChild(pageNode);
  await new Promise((resolve) => setTimeout(resolve, 30));
  if (retries !== 1) throw new Error(`expected one retry after page mutation, got ${retries}`);
  dom.window.history.pushState({}, '', '/b');
  await new Promise((resolve) => setTimeout(resolve, 30));
  if (retries !== 2) throw new Error(`expected one retry after route change, got ${retries}`);
  dispose();
  if (dom.window.history.pushState !== originalPush) throw new Error('history.pushState was not restored');
  console.log('PASS — retry observer debounces page mutations/routes and disposes cleanly');
}
main().catch((error) => { console.error(error); process.exit(1); });

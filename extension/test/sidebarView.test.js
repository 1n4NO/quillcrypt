'use strict';

const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { mountSidebar } = require('../src/ui/sidebarView');
const { createAnnotation } = require('../src/models/annotation');
const { anchorFromOffsets } = require('../src/content/anchoring/anchoring');

const dom = new JSDOM('<!doctype html><body><p>Read this important paragraph.</p></body>');
const { document } = dom.window;
const anchor = anchorFromOffsets(document.body, 0, 4);
const annotations = [createAnnotation({ type: 'highlight', anchor, style: { color: '#F5C542' } })];
const host = document.createElement('div');
const sidebar = mountSidebar(host, annotations);

assert.equal(host.querySelectorAll('.qc-sidebar-item').length, 1);
assert.equal(host.querySelector('.qc-sidebar-item').textContent, 'Read');
host.querySelector('.qc-sidebar-search').value = 'missing';
host.querySelector('.qc-sidebar-search').dispatchEvent(new dom.window.Event('input'));
assert.equal(host.querySelectorAll('.qc-sidebar-item').length, 0);
assert.equal(host.querySelector('.qc-sidebar-empty').hidden, false);
sidebar.update(annotations);
assert.equal(host.querySelectorAll('.qc-sidebar-item').length, 0, 'filter remains applied after update');
sidebar.dispose();
assert.equal(host.querySelector('.qc-sidebar'), null);

const orphanHost = document.createElement('div');
const orphan = { id: 'orphan-1', type: 'highlight', anchor: { exact: 'text no longer present', position: { start: 0, end: 20 } }, createdAt: new Date().toISOString() };
const orphanSidebar = mountSidebar(orphanHost, [orphan], { orphanedIds: ['orphan-1'] });
assert.match(orphanHost.querySelector('.qc-sidebar-item').textContent, /Anchor not found/);
assert.ok(orphanHost.querySelector('.qc-sidebar-retry'));
orphanSidebar.dispose();
console.log('PASS — sidebar renders, filters, updates, and surfaces orphaned anchors');

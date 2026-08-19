// Background service worker entry point.
// Page annotation state lives in the content script; this process is reserved
// for future sync lifecycle and extension-level messaging.
'use strict';

globalThis.addEventListener?.('install', () => globalThis.skipWaiting?.());
globalThis.addEventListener?.('activate', (event) => event.waitUntil?.(globalThis.clients?.claim?.()));

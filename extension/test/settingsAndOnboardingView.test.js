'use strict';
const { JSDOM } = require('jsdom');
const { ready, generateSymmetricKey } = require('../src/crypto/primitives');
const { KeyStore } = require('../src/crypto/keyStore');
const { SettingsController, WorkspaceRegistry } = require('../src/ui/settings');
const { mountSettings } = require('../src/ui/settingsView');
const { OnboardingState } = require('../src/ui/onboarding');
const { mountOnboarding, STEP_COPY } = require('../src/ui/onboardingView');

let pass = 0, fail = 0;
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label);
  cond ? pass++ : fail++;
}

async function main() {
  await ready();
  const dom = new JSDOM('<body></body>');

  // ================= Settings view =================
  const settingsContainer = dom.window.document.createElement('div');
  const keyStore = new KeyStore();
  const registry = new WorkspaceRegistry();
  const controller = new SettingsController(keyStore, registry, {
    url: 'https://example.com/article',
    pageTitle: 'Article',
    getAnnotations: async () => [{ id: 'a1', type: 'highlight', anchor: { exact: 'hello' } }],
  });

  await registry.addWorkspace({ id: 'ws-1', name: 'My Notes', scopeType: 'domain', scopeValue: 'example.com' });
  await registry.addWorkspace({ id: 'ws-2', name: 'Shared review', scopeType: 'urlList', scopeValue: ['https://a.com/1'] });
  await keyStore.storeWorkspaceKey('ws-1', generateSymmetricKey());

  const disposeSettings = await mountSettings(settingsContainer, controller);

  const rows = settingsContainer.querySelectorAll('.qc-settings-row');
  check('settings: one row rendered per workspace', rows.length === 2);

  const ws1Row = settingsContainer.querySelector('[data-workspace-id="ws-1"]');
  check('settings: workspace name is rendered correctly', ws1Row.querySelector('.qc-settings-row-name').textContent === 'My Notes');
  check('settings: workspace WITH a key shows "Unlocked"', ws1Row.querySelector('.qc-settings-badge').textContent === 'Unlocked');

  const ws2Row = settingsContainer.querySelector('[data-workspace-id="ws-2"]');
  check('settings: workspace WITHOUT a key shows "No key"', ws2Row.querySelector('.qc-settings-badge').textContent === 'No key');
  check('settings: JSON export action is rendered', settingsContainer.querySelector('[download="quillcrypt-annotations.json"]') === null && settingsContainer.querySelector('.qc-settings-export-button') !== null);
  check('settings: controller exports current page annotations', (await controller.exportCurrentPage('json')).includes('"annotationCount": 1'));
  const created = await controller.createWorkspaceForPage({ name: 'New review', scopeType: 'urlList' });
  check('settings: creates a workspace for the active page', created.workspace.scopeValue[0] === 'https://example.com/article');
  check('settings: generated invite keeps the key in the URL fragment', new URL(created.inviteLink).hash.startsWith('#key='));
  const joined = new SettingsController(new KeyStore(), new WorkspaceRegistry(), { url: 'https://example.com/article' });
  const accepted = await joined.acceptInvite(created.inviteLink);
  check('settings: accepts an invite with the original workspace identity', accepted.id === created.workspace.id);
  check('settings: accepted invite stores a usable local key', (await joined.keyStore.getWorkspaceKey(accepted.id)) !== null);
  let duplicateRejected = false;
  try { await joined.acceptInvite(created.inviteLink); } catch { duplicateRejected = true; }
  check('settings: duplicate invite is rejected clearly', duplicateRejected);
  const config = { value: '', token: '', async getRelayUrl() { return this.value; }, async setRelayUrl(value) { this.value = value; }, async getRelayAuthToken() { return this.token; }, async setRelayAuthToken(value) { this.token = value; } };
  const configured = new SettingsController(new KeyStore(), new WorkspaceRegistry(), { configBackend: config });
  await configured.setRelayUrl('wss://relay.example.com/');
  check('settings: relay URL is normalized before storage', (await configured.getRelayUrl()) === 'wss://relay.example.com');
  let invalidRelayRejected = false;
  try { await configured.setRelayUrl('https://relay.example.com'); } catch { invalidRelayRejected = true; }
  check('settings: non-WebSocket relay URL is rejected', invalidRelayRejected);
  await configured.setRelayAuthToken('token_123');
  check('settings: relay auth token round-trips through configuration', (await configured.getRelayAuthToken()) === 'token_123');
  let invalidTokenRejected = false;
  try { await configured.setRelayAuthToken('token with spaces'); } catch { invalidTokenRejected = true; }
  check('settings: relay auth token rejects unsupported characters', invalidTokenRejected);

  const leaveButton = ws1Row.querySelector('.qc-settings-leave');
  leaveButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 50));

  check('settings: after leaving, the workspace row is removed', settingsContainer.querySelector('[data-workspace-id="ws-1"]') === null);
  check('settings: the other workspace is unaffected', settingsContainer.querySelector('[data-workspace-id="ws-2"]') !== null);
  check('settings: leaving actually removed the key from storage', (await keyStore.getWorkspaceKey('ws-1')) === null);

  disposeSettings();
  check('settings: dispose() removes the panel from the DOM', settingsContainer.querySelector('.qc-settings') === null);

  const emptyContainer = dom.window.document.createElement('div');
  await mountSettings(emptyContainer, new SettingsController(new KeyStore(), new WorkspaceRegistry()));
  check('settings: empty state shown when there are no workspaces', emptyContainer.querySelector('.qc-settings-empty') !== null);

  // ================= Onboarding view =================
  const onboardingContainer = dom.window.document.createElement('div');
  const onboarding = new OnboardingState();
  await mountOnboarding(onboardingContainer, onboarding);

  const panel = onboardingContainer.querySelector('.qc-onboarding');
  check('onboarding: panel shown for a fresh (incomplete) state', panel !== null);
  check('onboarding: shows the correct title for the "install" step', panel.querySelector('.qc-onboarding-title').textContent === STEP_COPY.install.title);

  const dismissButton = panel.querySelector('.qc-onboarding-dismiss');
  dismissButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  check('onboarding: clicking dismiss removes the panel', onboardingContainer.querySelector('.qc-onboarding') === null);

  const completedOnboarding = new OnboardingState();
  await completedOnboarding.markStepComplete('install');
  await completedOnboarding.markStepComplete('first-annotation');
  await completedOnboarding.markStepComplete('first-invite');

  const container2 = dom.window.document.createElement('div');
  const dispose2 = await mountOnboarding(container2, completedOnboarding);
  check('onboarding: nothing rendered when already complete', container2.querySelector('.qc-onboarding') === null);
  check('onboarding: dispose() safely callable even when nothing was rendered', (() => { try { dispose2(); return true; } catch (e) { return false; } })());

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();

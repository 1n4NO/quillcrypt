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
  const controller = new SettingsController(keyStore, registry);

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

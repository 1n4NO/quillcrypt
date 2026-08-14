'use strict';
const { OnboardingState, InMemoryOnboardingBackend, ONBOARDING_STEPS } = require('../src/ui/onboarding');
const { SettingsController, WorkspaceRegistry } = require('../src/ui/settings');
const { KeyStore } = require('../src/crypto/keyStore');
const { ready, generateSymmetricKey } = require('../src/crypto/primitives');

let pass = 0, fail = 0;
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label);
  cond ? pass++ : fail++;
}

async function main() {
  await ready();

  const onboarding = new OnboardingState();

  check('default next step is "install" (the first step)', (await onboarding.getNextStep()) === 'install');
  check('onboarding is not complete by default', (await onboarding.isComplete()) === false);
  check('shouldShowOnboarding is true by default', (await onboarding.shouldShowOnboarding()) === true);

  await onboarding.markStepComplete('install');
  check('after completing "install", next step is "first-annotation"', (await onboarding.getNextStep()) === 'first-annotation');

  await onboarding.markStepComplete('first-invite');
  check('completing a later step out of order does not skip the earlier incomplete one', (await onboarding.getNextStep()) === 'first-annotation');

  await onboarding.markStepComplete('first-annotation');
  check('all three steps complete: getNextStep returns null', (await onboarding.getNextStep()) === null);
  check('isComplete is true once all steps are done', (await onboarding.isComplete()) === true);
  check('shouldShowOnboarding is false once complete', (await onboarding.shouldShowOnboarding()) === false);

  let rejectedUnknownStep = false;
  try {
    await onboarding.markStepComplete('bogus-step');
  } catch (e) {
    rejectedUnknownStep = true;
  }
  check('markStepComplete rejects an unknown step name', rejectedUnknownStep);

  const sharedDisk = new Set();
  const before = new OnboardingState(new InMemoryOnboardingBackend(sharedDisk));
  await before.markStepComplete('install');
  const after = new OnboardingState(new InMemoryOnboardingBackend(sharedDisk));
  check('onboarding progress survives a simulated restart (shared backend)', (await after.getCompletedSteps()).includes('install'));

  const keyStore = new KeyStore();
  const registry = new WorkspaceRegistry();
  const settings = new SettingsController(keyStore, registry);

  const domainWorkspace = { id: 'ws-1', name: 'My Notes', scopeType: 'domain', scopeValue: 'example.com' };
  const urlListWorkspace = { id: 'ws-2', name: 'Shared review', scopeType: 'urlList', scopeValue: ['https://a.com/1', 'https://a.com/2'] };
  await registry.addWorkspace(domainWorkspace);
  await registry.addWorkspace(urlListWorkspace);
  await keyStore.storeWorkspaceKey('ws-1', generateSymmetricKey());

  const summaries = await settings.getWorkspaceSummaries();
  check('settings lists both registered workspaces', summaries.length === 2);
  const ws1Summary = summaries.find((s) => s.id === 'ws-1');
  const ws2Summary = summaries.find((s) => s.id === 'ws-2');
  check('domain workspace summary shows the hostname as its scope label', ws1Summary.scopeLabel === 'example.com');
  check('urlList workspace summary shows a page count as its scope label', ws2Summary.scopeLabel === '2 page(s)');
  check('workspace WITH a stored key shows hasKey: true', ws1Summary.hasKey === true);
  check('workspace WITHOUT a stored key shows hasKey: false (a real, meaningful state for the UI to surface)', ws2Summary.hasKey === false);

  await settings.removeWorkspaceLocally('ws-1');
  const summariesAfterRemoval = await settings.getWorkspaceSummaries();
  check('removeWorkspaceLocally removes it from the summaries list', summariesAfterRemoval.every((s) => s.id !== 'ws-1'));
  check('removeWorkspaceLocally also removes the stored key', (await keyStore.getWorkspaceKey('ws-1')) === null);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();

'use strict';

/**
 * Onboarding DOM view. Wired to OnboardingState (QC-60). Shows a small,
 * dismissible step indicator only while onboarding is incomplete — once
 * shouldShowOnboarding() is false, mounting renders nothing (returns a
 * no-op dispose), so callers can mount this unconditionally on every page
 * load without checking completion state themselves first.
 */

const STEP_COPY = {
  install: { title: 'Welcome to Quillcrypt', body: 'Select some text on any page to make your first highlight.' },
  'first-annotation': { title: 'Nice — that\'s your first annotation', body: 'Try inviting a teammate to see it live.' },
  'first-invite': { title: 'Invite sent', body: "You're all set. Annotations you make here are end-to-end encrypted." },
};

async function mountOnboarding(container, onboardingState) {
  const doc = container.ownerDocument;

  if (!(await onboardingState.shouldShowOnboarding())) {
    return function dispose() {}; // nothing to show or tear down
  }

  const root = doc.createElement('div');
  root.className = 'qc-onboarding';
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');

  const title = doc.createElement('h3');
  title.className = 'qc-onboarding-title';
  const body = doc.createElement('p');
  body.className = 'qc-onboarding-body';

  const dismissButton = doc.createElement('button');
  dismissButton.type = 'button';
  dismissButton.className = 'qc-onboarding-dismiss';
  dismissButton.setAttribute('aria-label', 'Dismiss onboarding message');
  dismissButton.textContent = '×';
  dismissButton.addEventListener('click', () => {
    root.remove();
  });

  root.appendChild(dismissButton);
  root.appendChild(title);
  root.appendChild(body);

  async function render() {
    const step = await onboardingState.getNextStep();
    if (!step) {
      root.remove();
      return;
    }
    const copy = STEP_COPY[step];
    title.textContent = copy.title;
    body.textContent = copy.body;
  }

  await render();
  container.appendChild(root);

  return function dispose() {
    root.remove();
  };
}

module.exports = { mountOnboarding, STEP_COPY };

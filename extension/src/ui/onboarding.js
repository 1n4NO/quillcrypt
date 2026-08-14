'use strict';

/**
 * Onboarding flow state (QC-60). Tracks which onboarding milestones a user
 * has completed, so the UI knows what to show next. Persisted (pluggable
 * backend, same pattern as AnnotationStore) so onboarding doesn't restart
 * if the user closes the browser mid-flow.
 */

const ONBOARDING_STEPS = ['install', 'first-annotation', 'first-invite'];

class InMemoryOnboardingBackend {
  constructor(sharedSet = new Set()) {
    this._set = sharedSet;
  }
  async get() {
    return [...this._set];
  }
  async add(step) {
    this._set.add(step);
  }
}

class OnboardingState {
  constructor(backend = new InMemoryOnboardingBackend()) {
    this.backend = backend;
  }

  async markStepComplete(step) {
    if (!ONBOARDING_STEPS.includes(step)) {
      throw new Error(`Unknown onboarding step: ${step}`);
    }
    await this.backend.add(step);
  }

  async getCompletedSteps() {
    return this.backend.get();
  }

  /** The first step, in canonical order, that hasn't been completed yet — or null if done. */
  async getNextStep() {
    const completed = await this.getCompletedSteps();
    return ONBOARDING_STEPS.find((step) => !completed.includes(step)) || null;
  }

  async isComplete() {
    return (await this.getNextStep()) === null;
  }

  async shouldShowOnboarding() {
    return !(await this.isComplete());
  }
}

module.exports = { OnboardingState, InMemoryOnboardingBackend, ONBOARDING_STEPS };

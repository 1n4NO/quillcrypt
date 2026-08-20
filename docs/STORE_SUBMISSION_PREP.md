# QC-66 — Store submission & review response prep

**Status: prep checklist. Actual submission is a manual action requiring a Mozilla Add-ons
developer account and the built `.xpi` — neither of which this document can produce.**

Candidate release notes are in `docs/RELEASE_NOTES_0.1.0.md`; the launch, rollback, and incident
procedure is in `docs/LAUNCH_RUNBOOK.md`.

## Pre-submission checklist

- [x] `web-ext lint` passes clean (`npm run lint --workspace=extension`)
- [x] Firefox packaging produces a versioned ZIP install archive (`npm run build:firefox --workspace=extension`)
- [x] `manifest.json` version matches the root package after `npm run version:sync`
- [x] Icons are real PNGs at 16/48/128px under `extension/icons/`
- [x] Chrome packaging and SHA-256 verification pass through `npm run release:verify`
- [ ] Privacy policy (`docs/PRIVACY_POLICY.md`) is linked from the store listing and from
      within the extension's settings page
- [ ] QC-23's manual browser QA pass is complete (scroll/resize/zoom/lazy-load) — don't submit
      with this still outstanding
- [ ] QC-47's external security audit has at least been scoped, ideally completed, before
      making the E2EE claim in the public store listing
- [ ] Store screenshots are captured from the tested extension artifacts and redacted
- [ ] A support owner, relay owner, and rollback owner are assigned in `docs/LAUNCH_RUNBOOK.md`

## Permissions Mozilla reviewers will scrutinize

Firefox Add-ons review is stricter about broad permissions than casual expectations suggest.
Anticipate these specific questions:

**"Why does this extension need access to all websites?"**
Because annotation is the core feature and it needs to work on any page the user visits, not a
fixed list. Be ready to explain this plainly in the listing and in any reviewer
correspondence — "annotate any page" is a legitimate, common reason for broad host permissions,
but reviewers will still ask.

**"What does this extension send to external servers, and why?"**
Be specific and accurate: encrypted annotation data is sent to our relay server for real-time
sync between collaborators. The relay never receives plaintext — this is worth stating plainly
and can be backed by pointing to the automated tests in this repo if a reviewer wants technical
substantiation (QC-42's `encryptedSync.test.js` specifically).

**"Does this extension modify page content?"**
Yes — the content script injects an overlay (highlights, drawings, notes) on top of the page.
Reviewers may ask whether this could be used to spoof page content or phish. Be ready to
explain that the overlay is purely additive/visual (via the QC-4 SVG-overlay approach) and
does not modify or intercept the underlying page's own content, forms, or scripts.

**"What third-party services does this connect to?"**
List explicitly: your own relay server (self-hosted, not a third party), and optionally
whatever the user configures for Slack/webhook integrations (QC-51/52) — clarify those are
opt-in and user-configured, not default connections.

## If the review is rejected or flagged

Mozilla's automated review sometimes flags obfuscated or minified code, or code that appears to
fetch/eval remote scripts. Make sure the submitted build:
- Is not minified in a way that looks obfuscated (readable, even if bundled, is safer)
- Does not dynamically `eval()` or fetch-and-execute remote code — everything should be
  bundled at build time

If a specific technical question comes back from a reviewer, the fastest way to answer credibly
is to point at the actual test files in this repo that prove the claim, rather than restating
the claim in different words.

## After approval

- [ ] Update `docs/ROADMAP.md` to mark QC-66 done with the actual store listing URL
- [ ] Monitor the first round of user reviews/bug reports — Phase 5's polish work (QC-60–63)
      was aimed at exactly the rough edges most likely to surface here

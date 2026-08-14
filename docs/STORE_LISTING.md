# QC-64 — Firefox Add-ons store listing

**Status: listing copy drafted. Screenshots NOT included — see note below on why.**

## Listing copy

**Name:** Quillcrypt

**Summary** (max ~250 chars, shown in search results):
> Highlight, draw, and comment on any webpage with your team — end-to-end encrypted, so not
> even we can read what you write.

**Category:** Productivity

**Tags:** annotation, collaboration, encryption, privacy, notes, highlighting, team, e2ee

## Full description

Quillcrypt turns any webpage into a shared canvas. Highlight text, underline key points, draw
freehand, drop arrows and shapes, or leave sticky notes — then invite your team to see it live,
in real time, on the same page.

**What makes it different:** every annotation is end-to-end encrypted before it ever leaves
your browser. Our servers relay encrypted bytes between collaborators — they never see, log,
or store anything readable. Not your highlights, not your notes, not even which words you
selected. If someone asked us what your team is annotating, the honest answer is: we can't
tell them, because we don't know either.

**Features:**
- Highlight, underline, freehand draw, arrows, shapes, and sticky notes on any page
- Real-time collaboration — see teammates' annotations and cursors as they work
- End-to-end encryption — verified with automated tests against our own relay's storage, not
  just claimed (see our security documentation)
- Works on any website, no setup required by the site owner
- Share a workspace by domain or by specific pages
- Export your annotations any time — they're yours

**Permissions this extension requests, and why:**
- *Access to all websites*: required so you can annotate any page you visit, not a fixed list
- *Storage*: to save your annotations locally so they persist between sessions

## Screenshots — NOT included in this deliverable

I can't produce real product screenshots — that requires the extension actually running in a
loaded Firefox browser with real page content and rendered UI, which isn't something I have
access to generate. What Firefox Add-ons requires (as of general store guidelines): at least
one screenshot, ideally 3-5, at 1280x800 or similar, showing the actual UI in use.

**Recommended screenshot set once the extension is buildable and installable:**
1. The toolbar with all annotation tools visible, mid-use on a real article page
2. Two cursors/presence indicators visible, showing live collaboration
3. The sidebar panel listing several annotations
4. The invite/share flow (invite link screen)
5. The settings page showing workspace list and key management

Capture these once QC-23's manual browser QA pass happens anyway (Phase 1) — that's the first
point in the roadmap where there's a genuinely renderable UI to screenshot.

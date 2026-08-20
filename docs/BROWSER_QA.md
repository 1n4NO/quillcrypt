# Browser QA and release checklist

This checklist separates automated evidence from checks that require a real installed browser.
Do not mark the manual items complete from jsdom or bundle tests.

## Artifacts

- Firefox: `npm run build:firefox --workspace=extension`, then install the generated archive.
- Chrome: `npm run build:chrome --workspace=extension`, then load `extension/chrome-dist` as
  an unpacked extension.
- Run `npm run release:verify` after both builds; it checks the install payload and writes the
  archive SHA-256 record to `extension/web-ext-artifacts/quillcrypt-<version>-SHA256SUMS.txt`.
- Record the browser version, OS, date, and the checksum-file contents for every release candidate.

## Chrome and Firefox smoke matrix

| Scenario | Chrome | Firefox |
|---|---|---|
| Install, reload, uninstall/reinstall | [ ] | [ ] |
| Highlight and underline survive page reload | [ ] | [ ] |
| Note, draw, arrow, rectangle, ellipse | [ ] | [ ] |
| Undo, redo, edit, delete | [ ] | [ ] |
| Sidebar filter, focus, anchor jump | [ ] | [ ] |
| Orphaned anchor explanation and retry after lazy content | [ ] | [ ] |
| SPA route change and late DOM mutation | [ ] | [ ] |
| Two profiles converge through encrypted relay | [ ] | [ ] |
| Offline edits catch up after reconnect | [ ] | [ ] |
| Settings backup/import and leave-workspace warning | [ ] | [ ] |
| 200% zoom, forced colors, reduced motion | [ ] | [ ] |
| Keyboard-only and screen-reader pass | [ ] | [ ] |
| No uncaught console errors | [ ] | [ ] |

## Performance scenarios

Measure cold content-script startup, 5,000 annotations, long freehand paths, mutation bursts,
scroll/resize, sync bursts, and repeated navigation. Capture page load overhead, frame drops,
heap growth after reinjection, and storage latency. The retry observer is intentionally bounded:
it debounces for 250ms and does nothing when there are no orphaned annotations.

## Release evidence

Attach screenshots or recordings for any failure, plus the exact fixture URL (without private
data), browser version, extension artifact checksum, and console output. A release cannot claim
Chrome/Firefox support until both columns and the accessibility/performance sections are signed.

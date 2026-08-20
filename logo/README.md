# Quillcrypt logo assets

Two SVGs, both driven by `currentColor` — no color is baked in, so you set it via CSS (`color: #...`) or by editing the `stroke`/`fill` attributes directly. Default renders black on a transparent background.

## Files

- **`quillcrypt-mark.svg`** — the nib-key symbol alone (concept 1). Use this for the favicon, app icon, social avatar, and anywhere space is tight. 64x64 viewBox, stroke-based, holds up down to ~16px.
- **`quillcrypt-lockup.svg`** — mark + wordmark combined (concept 1 + concept 3's typographic treatment), for the site header, email signature, README badges, anywhere there's room for the full name. 300x56 viewBox.

## Notes before shipping

- The wordmark currently uses a system font stack (`-apple-system, Segoe UI, sans-serif`) as a placeholder. Swap in your chosen brand typeface, or convert the `<text>` to outlined `<path>` data (e.g. via Figma or an SVG font-to-path tool) so the logo renders identically everywhere regardless of installed fonts.
- The broken underline under the wordmark is hand-positioned for the placeholder font's approximate width — double check the gap still lands mid-word once you swap fonts, and nudge the two `<line>` x-values in the `<g>` at the bottom if it drifts.
- Both files are safe to recolor with plain CSS, e.g.:
  ```css
  .logo-mark { color: #1D9E75; }
  ```
- For a dark-mode variant, don't duplicate the file — just flip `currentColor` at the usage site (CSS variable or `prefers-color-scheme` media query).

The extension's `extension/icons/icon-*.png` files are generated from
`quillcrypt-mark.svg` by `extension/scripts/generate-icons.py`. The extension
build reruns that generator before copying the icons into browser bundles.

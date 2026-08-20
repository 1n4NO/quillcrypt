# Quillcrypt landing page

Standalone Editorial-style product landing page for Quillcrypt.

Open `index.html` directly or serve this folder with any static web server. It has no build step or third-party runtime dependency; the visual language uses an oversized magazine-style typographic system, asymmetrical grids, hairline rules, and the Quillcrypt yellow accent.

## Release setup

Run `npm run build:firefox --workspace=extension` and `npm run build:chrome --workspace=extension`,
then `npm run release:verify` to create versioned archives and their SHA-256 record.

Before publishing, replace the deployment-owned URLs in `release-config.js` with the approved
Firefox/Chrome store or release URLs. Store URLs open normally; archive URLs retain download
behavior. Keep the version in the root package, extension package, manifests, and landing URLs
aligned; `npm run release:verify` checks the package and manifest copies.

`npm run test:landing` checks local links, metadata assets, demo CTA removal, and the no-external-font
guarantee. The canonical/social host is currently `https://quillcrypt.dev/`; update it in both HTML
pages if the production host changes.

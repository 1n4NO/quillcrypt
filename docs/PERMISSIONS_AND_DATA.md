# Permissions and data handling

## Browser permissions

| Permission | Why it is needed | Data boundary |
|---|---|---|
| `storage` | Persist local annotations, workspace metadata, relay configuration, keys, onboarding state, and encrypted backup-related state. | Stored in the browser profile; keys are not sent to the relay. |
| `activeTab` | Let the action open Settings in the currently active page without requiring a separate extension page. | Used only for the active tab message/action flow. |
| `<all_urls>` host access | Mount annotation tools on arbitrary pages the user chooses to annotate and match domain/url-list workspaces. | Page text is read locally to anchor annotations; decrypted content is not sent to the relay or integrations. |

Firefox manifests declare `websiteContent` and `websiteActivity` as required data categories:
the extension reads visible page content for anchors and handles selection/annotation actions,
while encrypted annotation updates and routing metadata leave the browser for collaboration. The
declaration is intentionally conservative and must be revisited if the data path changes.

The extension does not request tabs, browsing history, bookmarks, downloads, clipboard, or native
host permissions. It does not collect analytics or transmit page text, annotation content,
workspace keys, backup passwords, or relay authentication tokens.

## Network data

The relay receives encrypted WebSocket update bytes, room identifiers needed for routing, and
normal connection metadata. Presence is a separate ephemeral metadata channel and should be
treated as visible to the relay; it must not carry page text, keys, or annotation content. The
relay's health endpoint reports only readiness and aggregate counts; it does not expose room IDs
or payloads.

## Store disclosure

The broad host permission is intentional: Quillcrypt cannot annotate a page it cannot inject into.
Store listings should explain that page access is used for local selection/anchoring and rendering,
while end-to-end encryption prevents the relay from reading annotation content. This rationale is
not a substitute for browser-store review or an external security audit.

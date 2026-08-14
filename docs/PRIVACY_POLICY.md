# Quillcrypt privacy policy & security whitepaper

*Plain-language version. This is written to be read by an actual user or a journalist, not a
lawyer — it should not later be replaced by opaque legal boilerplate without keeping this
level of clarity intact.*

## The short version

Quillcrypt encrypts your annotations on your device before they're ever sent anywhere. Our
servers only ever see encrypted bytes — they relay data between your devices and your
teammates', but they cannot read what's inside. This isn't a policy promise; it's verified by
automated tests that inspect our own server's storage directly and confirm no readable content
is ever present. See "How we verified this," below.

## What we can see

- **That a workspace exists**, and its scope (which domain or pages it covers) — this
  metadata isn't encrypted, because our relay needs to know which room to route messages to.
- **Connection metadata**: when a device connects, roughly how much data it sends/receives, IP
  address (standard for any network service).
- **Nothing about the content** of what you annotate: not the highlighted text, not your
  notes, not the shapes you draw, not who annotated what.

## What we cannot see, and why

Every annotation is encrypted on your device with a key that's generated on your device and
shared with your team through a link — a link where the encryption key lives in a part of the
URL (the "fragment," the part after `#`) that browsers never send to any server. Our relay
server only ever receives and forwards ciphertext.

We verified this isn't just a design intention: our own automated tests connect to our relay,
send real annotation data through it, and then inspect exactly what's stored — checking that
the actual plaintext content never appears anywhere in that storage, byte for byte, and that
what is stored doesn't even parse as readable data at all.

## How we verified this

Unlike a policy that simply asserts "we use encryption," here's specifically what's been
checked:

1. **The relay's live traffic** never contains plaintext — confirmed by an independent
   third-party connection to our relay that observes every byte crossing it.
2. **The relay's persisted storage** (what it remembers so devices can catch up after being
   offline) never contains plaintext either — checked both by searching for the actual known
   content as a byte sequence, and by confirming the stored bytes don't even structurally
   parse as the underlying data format.
3. **A device with the wrong key** cannot read anything — confirmed directly, not assumed.

The engineering scoping document for an external, independent security audit is public — see
`docs/SECURITY_AUDIT_SCOPE.md`. We believe internal verification is necessary but not
sufficient; an outside review is the right bar before this claim should be taken as fully
settled, and we're not waiting to be asked before planning for one.

## What happens if you lose a device

Because we can't recover your keys (see above — that's what makes the encryption real), losing
a device without a backup means that device's access to a workspace is gone. Other members'
access is unaffected. Full detail: `docs/KEY_RECOVERY.md`.

## Integrations (Slack, webhooks)

If you connect Quillcrypt to Slack or a webhook, those integrations only ever receive
**metadata** — that an annotation was added, by whom (a member ID, not necessarily a real
name), on which workspace, and when. They never receive annotation content. This is enforced
in code, not just policy: our integration code independently re-checks that any data it's
about to send matches a strict allow-list of safe fields, and refuses to send anything — making
zero network calls — if that check fails.

## Data we do NOT collect

- No tracking of your general browsing outside of pages you've actively chosen to annotate
- No analytics tied to annotation content
- No selling or sharing of data with third parties beyond the integrations you explicitly
  configure yourself (e.g., your own Slack webhook)

## Questions

This document will be updated as the product changes. For anything not covered here, the
underlying engineering documentation (`docs/ARCHITECTURE.md`, `docs/spikes/`,
`docs/SECURITY_AUDIT_SCOPE.md`) is public and more technically detailed.

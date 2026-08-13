# If you lose access to a device — what happens to your annotations

Quillcrypt is end-to-end encrypted. That has one direct consequence worth understanding
plainly before it matters to you: **we can't recover your data for you, on any device, ever.**
There's no "forgot my key" button, and there's no support ticket that gets your annotations
back if the device holding your keys is lost, wiped, or the browser profile is deleted without
a backup.

## Why we don't offer key recovery

This isn't an oversight — it's the direct cost of the encryption actually being real.

A product that *can* recover your key for you is a product where **someone else also could** —
either the company running it, or anyone who compromises that company's servers or an
employee's access. "We can reset your encryption key" and "your data is end-to-end encrypted"
are, practically speaking, opposites. We chose the encryption.

## What this means concretely

- **If you lose the device** (stolen, wiped, browser reinstalled without exporting first): any
  workspace only that device had access to becomes unreadable from that device going forward.
- **Other members of a shared workspace are unaffected.** Losing your device doesn't affect
  anyone else's access to a shared workspace — only your own copy of the keys is gone.
- **If you were the only member of a personal (non-shared) workspace**, losing your device
  means that workspace's annotations are gone. There is no way for us, or anyone, to get them
  back.

## What you can do about it

- **Export a backup periodically**, especially before switching browsers, reinstalling, or
  getting a new device. (See the extension's settings page for the export option.)
- **Keep at least one other device or browser profile logged into workspaces you care about**,
  if the workspace is shared — a second active member means the workspace itself survives even
  if your device doesn't.
- **Treat your exported backup like a password** — anyone who has it can read everything it
  covers. Store it somewhere you'd store a password, not in a random shared folder.

## What we're explicitly NOT planning to add, and why

An optional "key escrow" service (where we hold a recovery copy of your key, encrypted to your
account password or similar) is a legitimate design some E2EE products use as an opt-in
tradeoff. We're deliberately not building one for v1 — introducing it means introducing a new
place your data could be exposed if that escrow system is ever compromised, and we'd rather
ship a smaller, more honestly-described guarantee than a bigger one with an asterisk. If this
becomes something a lot of users clearly want, it's a decision worth revisiting in the open,
not something to bolt on quietly.

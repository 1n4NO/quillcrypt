// Blind WebSocket relay.
//
// By design this process should NEVER decrypt or inspect message payloads —
// it only forwards opaque binary blobs between clients in the same workspace.
// See docs/ROADMAP.md QC-31 (initial relay), QC-42 (automated test proving
// no plaintext ever touches this process's memory or logs).
//
// Intentionally empty scaffold.

# Relay operations

The production entry point is `relay-server/src/index.js`. It forwards opaque WebSocket
payloads and does not decrypt annotation updates. Run it with a process supervisor and configure
the following environment variables explicitly in production:

| Variable | Default | Purpose |
|---|---:|---|
| `PORT` | `8123` | WebSocket listener port |
| `RELAY_DATA_PATH` | unset | Atomic file-backed room history; unset means in-memory mode |
| `RELAY_AUTH_TOKEN` | unset | Bearer or WebSocket-subprotocol authentication token |
| `RELAY_ALLOWED_ORIGINS` | unset | Comma-separated exact Origin allowlist |
| `RELAY_MAX_PAYLOAD` | `1048576` | Maximum WebSocket frame size in bytes |
| `RELAY_MAX_ROOMS` | unlimited | Maximum simultaneously active rooms |
| `RELAY_MAX_CLIENTS_PER_ROOM` | unlimited | Maximum live clients in one room |
| `RELAY_HEARTBEAT_INTERVAL` | `30000` | Ping interval in milliseconds; `0` disables it |
| `RELAY_MAX_MESSAGES_PER_INTERVAL` | unlimited | Per-connection message limit |
| `RELAY_RATE_INTERVAL` | `1000` | Rate-limit window in milliseconds |
| `RELAY_HEALTH_PORT` | unset | Separate HTTP health listener; `/healthz` returns 200/503 |
| `RELAY_SHUTDOWN_TIMEOUT` | `5000` | Graceful-drain timeout in milliseconds |

Production should set `RELAY_DATA_PATH`, `RELAY_AUTH_TOKEN`, `RELAY_ALLOWED_ORIGINS`, finite
room/client/message limits, and `RELAY_HEALTH_PORT`. Put the data path on durable storage with
restricted filesystem permissions and back it up as opaque relay state. Backups do not contain
plaintext annotations or workspace keys, but they still reveal room identifiers and encrypted
history size/timing metadata.

The extension supplies the auth token as the `quillcrypt-auth.<token>` WebSocket subprotocol for
both document sync and presence. Tokens must use only WebSocket-token-safe characters. Never put
the token or a workspace key in a relay URL, query string, log line, metric label, or health
response.

`/healthz` intentionally reports only readiness, persistence mode, storage readiness, and
aggregate room/client counts. It does not expose room IDs, payloads, URLs, or keys. A 503 means
the relay listener or configured persistence directory is not ready.

Shutdown handling responds to `SIGTERM` and `SIGINT`, stops accepting new connections, sends a
normal-close signal to clients, waits up to `RELAY_SHUTDOWN_TIMEOUT`, then terminates remaining
sockets. Deployments should still use a supervisor restart policy and monitor the health endpoint.

## Backup and restore

The persistence file is an opaque JSON envelope containing base64-encoded relay updates. Use the
validated, atomic helper rather than copying an arbitrary file into the live data path:

```sh
npm run backup --workspace=relay-server -- \
  --source=/var/lib/quillcrypt/relay.json \
  --destination=/var/backups/quillcrypt/relay.json

npm run backup --workspace=relay-server -- \
  --restore \
  --source=/var/backups/quillcrypt/relay.json \
  --destination=/var/lib/quillcrypt/relay-restored.json
```

The helper validates the snapshot version and base64 envelope, writes through a same-directory
temporary file, and returns only version/room-count/byte-count metadata. Restore to a new path,
run the relay persistence tests and health check, then switch configuration; preserve the failed
path for investigation. Backups remain metadata-bearing operational data and require restricted
permissions and retention controls.

## Redacted operational metrics

`startPersistentRelay` accepts an optional `onMetric` callback for host instrumentation. Its
events contain only an event type, aggregate room/client counts, and a persistence boolean. They
never contain room IDs, URLs, payloads, annotation content, keys, or tokens. The built-in
`/healthz` endpoint remains the default production signal; any metrics sink must preserve this
allowlist and must not add request data around the safe event.

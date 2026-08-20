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

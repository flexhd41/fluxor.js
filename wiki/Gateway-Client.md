# Gateway Client

The `GatewayClient` class manages the WebSocket connection to the Fluxor gateway. It handles authentication, heartbeats, session resume, reconnection with exponential backoff, and dispatches typed events.

---

## Constructor

```ts
import { GatewayClient } from "fluxer.js";

const gateway = new GatewayClient(token: string, config?: FluxorConfig);
```

## Properties

| Property | Type | Description |
|----------|------|-------------|
| `token` | `string` | The authentication token. |
| `ping` | `number` | Last heartbeat round-trip latency in ms, or -1 if not yet measured. |

## Connection Lifecycle

### connect()

Opens a WebSocket connection, sends IDENTIFY (or RESUME if a session exists), and resolves once READY or RESUMED is received.

```ts
await gateway.connect();
```

If a connection attempt is already in progress, subsequent calls are ignored.

### destroy()

Gracefully closes the connection. Does not attempt to reconnect.

```ts
gateway.destroy();
```

## Event Subscription

```ts
gateway.on("READY", (data) => { ... });
gateway.once("MESSAGE_CREATE", (msg) => { ... });
gateway.off("TYPING_START", handler);
```

## Events

All events from the `GatewayEvents` interface are emitted, plus:

| Event | Payload | Description |
|-------|---------|-------------|
| `raw` | `{ event: string, data: unknown }` | Every dispatch event, regardless of name. |
| `close` | `{ code: number, reason: string }` | WebSocket close. |
| `error` | `Error` | Unrecoverable error. |
| `debug` | `string` | Debug log lines. |
| `HEARTBEAT_ACK` | `number` | Round-trip latency in ms after each heartbeat. |

## waitFor

Wait for a specific event with optional filtering and timeout:

```ts
const msg = await gateway.waitFor("MESSAGE_CREATE", {
  filter: (m) => m.author?.id === "123",
  timeout: 30_000,
});
```

The returned promise rejects with an error if the timeout expires.

## Purpose-Built Gateway Methods

The `send()` method is private. Instead, use these purpose-built methods:

### updatePresence

Update the bot's presence on the gateway.

```ts
gateway.updatePresence({ status: "dnd" });
```

### requestGuildMembers

Request the member list for a guild.

```ts
gateway.requestGuildMembers(guildId, query?, limit?);
```

### updateVoiceState

Join, leave, or move voice channels.

```ts
// Join a voice channel
gateway.updateVoiceState(guildId, channelId);

// Leave voice
gateway.updateVoiceState(guildId, null);

// Join muted and deafened
gateway.updateVoiceState(guildId, channelId, true, true);
```

### connectCall

Connect to a DM call.

```ts
gateway.connectCall(channelId);
```

### subscribeGuild

Subscribe to guild events.

```ts
gateway.subscribeGuild(guildId);
```

## Heartbeat and Latency

The gateway client automatically sends heartbeats at the interval specified by the server. After each heartbeat acknowledgement, the round-trip latency is calculated and:

1. Stored in the `ping` property.
2. Emitted as a `HEARTBEAT_ACK` event with the latency in ms.

```ts
gateway.on("HEARTBEAT_ACK", (latencyMs) => {
  console.log(`Gateway latency: ${latencyMs}ms`);
});
```

## Reconnection

When the WebSocket closes unexpectedly, the client automatically reconnects with exponential backoff:

- Base delay is configurable via `reconnectDelay` (default: 2 seconds).
- Maximum delay is capped at 60 seconds.
- Jitter is added to prevent thundering herd.
- A concurrency guard prevents parallel reconnection attempts.
- `maxReconnectAttempts` limits the total number of retries (default: Infinity).

### Close Code Handling

Certain close codes trigger specific behavior:

| Code | Name | Behavior |
|------|------|----------|
| 4004 | AuthenticationFailed | Clears session, does NOT reconnect. |
| 4007 | InvalidSequence | Clears session for fresh IDENTIFY, reconnects. |
| 4009 | SessionTimedOut | Clears session for fresh IDENTIFY, reconnects. |
| 4010 | InvalidShard | Does NOT reconnect. |
| 4011 | ShardingRequired | Does NOT reconnect. |
| 4012 | InvalidApiVersion | Does NOT reconnect. |
| 4013 | InvalidIntents | Does NOT reconnect. |
| 4014 | DisallowedIntents | Does NOT reconnect. |
| All other codes | | Reconnects with backoff. |

## Low-Level Usage

```ts
import { GatewayClient, ApiClient } from "fluxer.js";

const api = new ApiClient("Bot TOKEN");
const gateway = new GatewayClient("Bot TOKEN");

gateway.on("READY", (data) => {
  console.log(`Session: ${data.session_id}`);
});

gateway.on("MESSAGE_CREATE", async (msg) => {
  if (msg.content === "!hello") {
    await api.sendMessage(msg.channel_id, "Hello from the gateway!");
  }
});

await gateway.connect();
```

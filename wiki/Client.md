# Client

The `Client` class is the recommended high-level interface for building Fluxor bots. It bundles an `ApiClient` and a `GatewayClient` and provides caches, convenience methods, and lifecycle management.

---

## Constructor

```ts
import { Client } from "fluxer.js";

const bot = new Client(token: string, config?: FluxorConfig);
```

## Properties

| Property | Type | Description |
|----------|------|-------------|
| `api` | `ApiClient` | REST API client for making HTTP requests. |
| `gateway` | `GatewayClient` | WebSocket gateway client for real-time events. |
| `user` | `User \| null` | The bot's own user object. Populated after READY. |
| `guilds` | `Map<string, Guild>` | Guild cache keyed by guild ID. |
| `channels` | `Map<string, Channel>` | Channel cache keyed by channel ID. |
| `users` | `Map<string, User>` | User cache keyed by user ID. Populated opportunistically from events. |
| `isReady` | `boolean` | Whether the client has received a READY event. |
| `readyAt` | `Date \| null` | Timestamp of when READY was received. |
| `uptime` | `number` | Milliseconds since READY, or -1 if not yet ready. |
| `ping` | `number` | Last heartbeat round-trip latency in ms (shortcut for `gateway.ping`). |

## Methods

### Lifecycle

```ts
// Connect to the gateway (starts receiving events)
await bot.connect();

// Alias for connect()
await bot.login();

// Gracefully shut down -- clears caches, closes the WebSocket
bot.destroy();
```

### Graceful Shutdown

```ts
// Register SIGINT / SIGTERM handlers that automatically call destroy()
bot.enableGracefulShutdown();
```

When enabled, pressing Ctrl+C or sending SIGTERM will cleanly disconnect the bot and exit.

### Sending Messages

```ts
// String shorthand
await bot.send(channelId, "Hello!");

// Full payload
await bot.send(channelId, {
  content: "Check out this embed!",
  embeds: [embed],
  tts: false,
});
```

### Event Subscription

```ts
bot.on("READY", (data) => { ... });
bot.once("MESSAGE_CREATE", (msg) => { ... });
bot.off("TYPING_START", handler);
```

All events from `GatewayEvents` plus the following internal events are available:

| Event | Payload | Description |
|-------|---------|-------------|
| `raw` | `{ event: string, data: unknown }` | Fired for every dispatch event. |
| `close` | `{ code: number, reason: string }` | Fired when the WebSocket closes. |
| `error` | `Error` | Fired on unrecoverable errors. |
| `debug` | `string` | Debug-level log messages. |
| `HEARTBEAT_ACK` | `number` | Heartbeat round-trip latency in ms. |

### waitFor

Wait for a specific gateway event with an optional filter and timeout:

```ts
const msg = await bot.waitFor("MESSAGE_CREATE", {
  filter: (m) => m.channel_id === "123" && m.content === "confirm",
  timeout: 30_000, // 30 seconds
});
```

If the timeout expires, the returned promise rejects with an error.

## Cache Behavior

The client automatically maintains caches from gateway events:

- **READY**: Populates `user`, `guilds`, `channels`, `users`
- **GUILD_CREATE / UPDATE / DELETE**: Maintains the `guilds` and `channels` maps
- **CHANNEL_CREATE / UPDATE / DELETE**: Maintains the `channels` map
- **USER_UPDATE**: Maintains the `users` map and updates `bot.user` if it matches

Caches are cleared when `destroy()` is called.

## Full Example

```ts
import { Client, createConsoleLogger } from "fluxer.js";

const bot = new Client("Bot YOUR_TOKEN_HERE", {
  logger: createConsoleLogger("info"),
  presence: { status: "online" },
});

bot.enableGracefulShutdown();

bot.on("READY", () => {
  console.log(`Logged in as ${bot.user?.username}`);
  console.log(`Guilds: ${bot.guilds.size}`);
  console.log(`Channels: ${bot.channels.size}`);
});

bot.on("GUILD_CREATE", (guild) => {
  console.log(`Guild available: ${guild.name}`);
});

bot.on("MESSAGE_CREATE", async (msg) => {
  if (msg.content === "!info") {
    await bot.send(msg.channel_id, [
      `Uptime: ${Math.floor(bot.uptime / 1000)}s`,
      `Ping: ${bot.ping}ms`,
      `Guilds: ${bot.guilds.size}`,
    ].join("\n"));
  }
});

await bot.connect();
```

# Fluxer.js

A JavaScript / TypeScript SDK for the **Fluxor** platform — build bots and integrations with ease.

> **Community port** of [Fluxer.Net](https://github.com/Nexfinity/Fluxer.Net) (C# / .NET) to the Node.js ecosystem.

---

## Features

- **REST API client** — 150+ typed endpoint methods covering auth, channels, guilds, users, invites, webhooks, memes, and more.
- **Gateway client** — WebSocket connection with automatic heartbeats, session resume, exponential-backoff reconnection, latency tracking, and 50+ typed dispatch events.
- **Command framework** — register commands as plain objects or class modules, with prefix matching, argument parsing, preconditions, and lifecycle hooks.
- **EmbedBuilder** — fluent, validated API for constructing rich embeds.
- **Client-side rate limiting** — sliding-window buckets per route to respect Fluxor rate limits.
- **Type-safe models** — snake_case interfaces matching the wire format, with required vs. optional fields and dedicated mutation payloads.
- **18 enum types** — `ChannelType`, `MessageType`, `Permissions`, `UserFlags`, and more, ported from the .NET SDK.
- **Error subclasses** — `FluxorRateLimitError`, `FluxorNotFoundError`, `FluxorForbiddenError` for easy catch handling.
- **Zero heavy dependencies** — only `ws` for WebSocket; uses native `fetch` (Node 18+).

---

## Installation

```bash
npm install fluxer.js
```

> **Requires Node.js 18+** (for native `fetch`).

---

## Quick Start

```ts
import { Client, createConsoleLogger } from "fluxer.js";

const bot = new Client("Bot YOUR_TOKEN_HERE", {
  logger: createConsoleLogger("info"),
  presence: { status: "online" },
});

bot.enableGracefulShutdown(); // handles SIGINT/SIGTERM

bot.on("READY", (data) => {
  console.log(`Logged in as ${data.user.username}`);
  console.log(`Guilds: ${bot.guilds.size}, Channels: ${bot.channels.size}`);
});

bot.on("MESSAGE_CREATE", async (msg) => {
  if (msg.content === "!ping") {
    await bot.send(msg.channel_id, `Pong! (${bot.ping}ms)`);
  }
});

await bot.connect();
```

---

## Architecture

Fluxer.js exposes three levels of abstraction:

| Class | Purpose |
|-------|---------|
| `Client` | High-level wrapper — bundles `ApiClient` + `GatewayClient`, proxies events, maintains caches. Recommended for most bots. |
| `ApiClient` | REST-only client. Use when you only need HTTP calls without a live WebSocket connection. |
| `GatewayClient` | WebSocket-only client. Use when you want full control over the connection lifecycle. |

---

## Configuration

Pass a `FluxorConfig` object to any client:

```ts
{
  apiBaseUrl?: string;                  // Default: "https://api.fluxer.app/v1"
  gatewayUrl?: string;                  // Default: "wss://gateway.fluxer.app/?v=1&encoding=json"
  requestTimeout?: number;              // REST request timeout in ms (default: 15000)
  reconnectDelay?: number;              // Base reconnect delay in seconds (default: 2)
  maxReconnectAttempts?: number;        // Max reconnects before giving up (default: Infinity)
  enableRateLimiting?: boolean;         // Default: true
  presence?: PresenceData;              // Initial bot status
  ignoredGatewayEvents?: (keyof GatewayEvents)[];  // Type-safe event filter
  logger?: Logger;                      // Any object with debug/info/warn/error methods
}
```

---

## Token Format

- **Bot tokens** must be prefixed with `Bot ` (with a trailing space): `"Bot flx_abc123..."`
- **User tokens** must start with `flx_`: `"flx_abc123..."`

---

## Client Caches

After connecting, the `Client` automatically maintains in-memory caches:

```ts
bot.user         // The bot's own User object
bot.guilds       // Map<string, Guild> — keyed by guild ID
bot.channels     // Map<string, Channel> — keyed by channel ID
bot.users        // Map<string, User> — populated from events
bot.isReady      // boolean
bot.readyAt      // Date | null
bot.uptime       // milliseconds since READY
bot.ping         // last heartbeat round-trip latency in ms
```

---

## Sending Messages

```ts
// String shorthand
await bot.send(channelId, "Hello!");

// Full payload
await bot.send(channelId, {
  content: "Check out this embed!",
  embeds: [embed],
});

// Or via the API client directly
await bot.api.sendMessage(channelId, "Hello!");
```

---

## EmbedBuilder

```ts
import { EmbedBuilder } from "fluxer.js";

const embed = new EmbedBuilder()
  .setTitle("My Embed")
  .setDescription("Built with the fluent API")
  .setColor(0x5865f2)
  .addField("Field 1", "Value 1", true)
  .addField("Field 2", "Value 2", true)
  .setFooter("Fluxer.js")
  .setTimestamp()
  .build();

await bot.send(channelId, { embeds: [embed] });
```

---

## Command Framework

```ts
import { Client, CommandService } from "fluxer.js";
import type { CommandDefinition } from "fluxer.js";

const commands = new CommandService({ prefix: "!" });

const ping: CommandDefinition = {
  name: "ping",
  summary: "Check latency",
  execute: async (ctx) => {
    await ctx.reply("Pong!");
  },
};

commands.addCommand(ping);

bot.on("MESSAGE_CREATE", async (msg) => {
  if (!msg.author?.bot) {
    const argPos = commands.hasPrefix(msg.content ?? "");
    if (argPos >= 0) {
      await commands.execute(msg, bot.api, bot.gateway, argPos);
    }
  }
});
```

### Preconditions

```ts
import { requireGuild, requireOwner } from "fluxer.js";

const adminCmd: CommandDefinition = {
  name: "admin",
  preconditions: [requireGuild(), requireOwner("your-user-id")],
  execute: async (ctx) => { await ctx.reply("Admin only!"); },
};
```

### Argument Parsing

```ts
import { NumberParser } from "fluxer.js";

const roll: CommandDefinition = {
  name: "roll",
  parameters: [
    { name: "sides", type: NumberParser, optional: true, defaultValue: 6 },
  ],
  execute: async (ctx, sides: unknown) => {
    const n = sides as number;
    await ctx.reply(`You rolled a ${Math.floor(Math.random() * n) + 1}`);
  },
};
```

---

## waitFor Utility

```ts
// Wait for a specific event with an optional filter and timeout
const msg = await bot.waitFor("MESSAGE_CREATE", {
  filter: (m) => m.channel_id === "123" && m.author?.id === "456",
  timeout: 30_000,
});
```

---

## Gateway Events

Subscribe to any event name from the Fluxor gateway:

```ts
bot.on("MESSAGE_CREATE", (msg) => { ... });
bot.on("GUILD_MEMBER_ADD", (member) => { ... });
bot.on("TYPING_START", (typing) => { ... });
bot.on("HEARTBEAT_ACK", (latencyMs) => { ... });
// ... 50+ events — fully typed via GatewayEvents interface
```

A `raw` event is also emitted for every dispatch:

```ts
bot.on("raw", ({ event, data }) => {
  console.log(`Event: ${event}`, data);
});
```

---

## Enums

All 18 enum types from the .NET SDK are available:

```ts
import { ChannelType, MessageType, Permissions, hasPermission } from "fluxer.js";

if (channel.type === ChannelType.GuildText) { ... }
if (hasPermission(BigInt(member.permissions), Permissions.BanMembers)) { ... }
```

---

## Error Handling

```ts
import { FluxorApiError, FluxorRateLimitError, FluxorNotFoundError } from "fluxer.js";

try {
  await bot.api.getChannel("invalid-id");
} catch (err) {
  if (err instanceof FluxorNotFoundError) {
    console.log("Channel not found");
  } else if (err instanceof FluxorRateLimitError) {
    console.log(`Rate limited, retry after ${err.retryAfter}ms`);
  }
}
```

---

## Rate Limiting

Client-side rate limiting is enabled by default. The SDK uses a sliding-window algorithm with per-route buckets (mirroring the .NET SDK's approach):

```ts
const bot = new Client("Bot TOKEN", { enableRateLimiting: false }); // opt out
```

---

## Project Structure

```
src/
  index.ts              — Barrel re-exports
  config.ts             — FluxorConfig, defaults
  errors.ts             — Error classes (FluxorApiError + subclasses)
  client/Client.ts      — High-level Client with caches
  api/ApiClient.ts      — REST client (150+ methods)
  gateway/
    GatewayClient.ts    — WebSocket client with latency tracking
    opcodes.ts          — FluxorOpCode enum
    closeCodes.ts       — Close code handling
    packets.ts          — Packet type definitions
  builders/
    EmbedBuilder.ts     — Fluent embed builder with validation
  commands/
    CommandService.ts   — Command registration & dispatch
    CommandContext.ts    — Per-invocation context
    ModuleBase.ts       — Base class for command modules
    Command.ts          — Core types (CommandDefinition, etc.)
    preconditions.ts    — requireGuild, requireOwner, requirePermissions
    typeParsers.ts      — Built-in argument parsers
  rateLimit/
    RateLimitBucket.ts  — Sliding-window bucket
    RateLimitManager.ts — Bucket manager
    RateLimitConfig.ts  — Config interface
    RateLimitMappings.ts— Route-to-bucket map
  types/
    models.ts           — 40+ data model interfaces + mutation payloads
    gateway.ts          — 50+ gateway event payload types
    enums.ts            — 18 enum / constant types
  util/
    logger.ts           — Logger interface + console logger
    token.ts            — Token validation
examples/
  bot.ts                — Example bot with commands + embeds
```

---

## License

MIT — matching [Fluxer.Net](https://github.com/Nexfinity/Fluxer.Net).

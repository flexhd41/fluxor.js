# Fluxer.js Wiki

**Fluxer.js** is a JavaScript / TypeScript SDK for the Fluxor platform. It is a community port of [Fluxer.Net](https://github.com/Nexfinity/Fluxer.Net) (C# / .NET) to the Node.js ecosystem.

---

## Table of Contents

- [Getting Started](Getting-Started)
- [Configuration](Configuration)
- [Client](Client)
- [API Client](API-Client)
- [Gateway Client](Gateway-Client)
- [EmbedBuilder](EmbedBuilder)
- [Command Framework](Command-Framework)
- [Types and Enums](Types-and-Enums)
- [Error Handling](Error-Handling)
- [Rate Limiting](Rate-Limiting)

---

## Overview

Fluxer.js provides three levels of abstraction:

| Class | Purpose |
|-------|---------|
| `Client` | High-level wrapper that bundles `ApiClient` + `GatewayClient`, proxies events, and maintains caches. Recommended for most bots. |
| `ApiClient` | REST-only client with 150+ typed endpoint methods. Use when you only need HTTP calls. |
| `GatewayClient` | WebSocket-only client for real-time events. Use when you want full control over the connection lifecycle. |

## Requirements

- **Node.js 18+** (for native `fetch` support)
- **TypeScript 5.0+** (recommended, but not required)

## Installation

```bash
npm install fluxer.js
```

## Quick Example

```ts
import { Client, createConsoleLogger } from "fluxer.js";

const bot = new Client("Bot YOUR_TOKEN_HERE", {
  logger: createConsoleLogger("info"),
  presence: { status: "online" },
});

bot.enableGracefulShutdown();

bot.on("READY", (data) => {
  console.log(`Logged in as ${data.user.username}`);
});

bot.on("MESSAGE_CREATE", async (msg) => {
  if (msg.content === "!ping") {
    await bot.send(msg.channel_id, `Pong! (${bot.ping}ms)`);
  }
});

await bot.connect();
```

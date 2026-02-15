# Rate Limiting

Fluxer.js includes a client-side rate limiting system that mirrors the sliding-window bucket algorithm from the .NET SDK. It prevents your bot from exceeding API rate limits by queueing requests per route.

---

## Overview

When `enableRateLimiting` is `true` (the default), every API request passes through the rate limiter before being sent. The rate limiter:

1. Maps each API route to a bucket configuration (defined in `RateLimitMappings`).
2. Maintains a sliding-window counter for each bucket.
3. If the bucket is full, the request waits until a slot is available.

This is entirely client-side. The server may still return 429 responses if multiple clients share the same token or if the local mappings are out of date. The SDK handles 429 responses by throwing a `FluxorRateLimitError` with a `retryAfter` value.

## Disabling Rate Limiting

```ts
const bot = new Client("Bot TOKEN", { enableRateLimiting: false });
```

When disabled, requests are sent immediately without any queueing.

## How It Works

### Buckets

Each API route is associated with a `RateLimitConfig`:

```ts
interface RateLimitConfig {
  limit: number;        // Maximum requests per window
  window: number;       // Window duration in milliseconds
  paramKeys?: string[]; // Route parameters that create separate buckets
}
```

For example, sending messages to different channels uses separate buckets because `channelId` is a parameter key. This means rate limits for channel A do not affect channel B.

### Sliding Window

The `RateLimitBucket` tracks request timestamps in a sliding window:

1. When a request comes in, expired timestamps (older than `window` ms) are removed.
2. If the number of remaining timestamps is less than `limit`, the request proceeds immediately.
3. If the bucket is full, the request waits until the oldest timestamp expires.

### Concurrency

Multiple concurrent requests to the same bucket are queued using an async queue. This ensures that even under high concurrency, the rate limit is respected.

## Architecture

```
ApiClient._rl(route, params)
    |
    v
RateLimitManager.getBucket(config, params)
    |
    v
RateLimitManager.waitForRateLimit(bucket)
    |
    v
RateLimitBucket.acquire()
    |
    v
(request proceeds)
```

## Route Mappings

The `RateLimitMappings` object maps logical route names to configurations. Examples:

| Route | Limit | Window | Scoped By |
|-------|-------|--------|-----------|
| `channels.messages.send` | 5 | 5000ms | `channelId` |
| `channels.typing` | 5 | 5000ms | `channelId` |
| `guilds.members.list` | 10 | 10000ms | `guildId` |
| `auth.login` | 5 | 60000ms | (global) |

## Inspecting Rate Limit State

You can access the rate limit manager directly for inspection:

```ts
const manager = bot.api.rateLimitManager;

// The manager maintains an internal map of active buckets
// Use for debugging or monitoring
```

## Handling 429 Responses

Even with client-side rate limiting, the server may return 429. The SDK throws a `FluxorRateLimitError`:

```ts
import { FluxorRateLimitError } from "fluxer.js";

try {
  await bot.api.sendMessage(channelId, "message");
} catch (err) {
  if (err instanceof FluxorRateLimitError) {
    console.log(`Rate limited for ${err.retryAfter}ms`);
    // Wait and retry
    await new Promise((r) => setTimeout(r, err.retryAfter));
    await bot.api.sendMessage(channelId, "message");
  }
}
```

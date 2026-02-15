# Error Handling

Fluxer.js provides a hierarchy of error classes for handling API failures. All API errors extend the base `FluxorApiError` class, and specific subclasses are thrown for common HTTP status codes.

---

## Error Hierarchy

```
Error
  FluxorApiError (any non-success status)
    FluxorRateLimitError (429 Too Many Requests)
    FluxorNotFoundError (404 Not Found)
    FluxorForbiddenError (403 Forbidden)
```

## FluxorApiError

The base error class for all API failures.

```ts
import { FluxorApiError } from "fluxer.js";

try {
  await bot.api.getChannel("invalid-id");
} catch (err) {
  if (err instanceof FluxorApiError) {
    console.log(err.status);  // HTTP status code (e.g. 404)
    console.log(err.body);    // Raw response body string
    console.log(err.json);    // Parsed JSON body (or undefined)
    console.log(err.message); // Human-readable error message
  }
}
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `status` | `number` | The HTTP status code. |
| `body` | `string` | The raw response body. |
| `json` | `unknown` | The body parsed as JSON, or `undefined` if parsing fails. |

## FluxorRateLimitError

Thrown when the API returns 429 (Too Many Requests). Includes information about how long to wait.

```ts
import { FluxorRateLimitError } from "fluxer.js";

try {
  await bot.api.sendMessage(channelId, "spam");
} catch (err) {
  if (err instanceof FluxorRateLimitError) {
    console.log(`Rate limited. Retry after ${err.retryAfter}ms`);
    await new Promise((r) => setTimeout(r, err.retryAfter));
    // retry...
  }
}
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `retryAfter` | `number` | Milliseconds to wait before retrying. |

## FluxorNotFoundError

Thrown when the API returns 404 (Not Found).

```ts
import { FluxorNotFoundError } from "fluxer.js";

try {
  await bot.api.getUser("nonexistent-id");
} catch (err) {
  if (err instanceof FluxorNotFoundError) {
    console.log("User not found.");
  }
}
```

## FluxorForbiddenError

Thrown when the API returns 403 (Forbidden).

```ts
import { FluxorForbiddenError } from "fluxer.js";

try {
  await bot.api.deleteMessage(channelId, messageId);
} catch (err) {
  if (err instanceof FluxorForbiddenError) {
    console.log("Missing permissions to delete that message.");
  }
}
```

## Catching Specific Errors

Use `instanceof` to catch specific error types while letting others propagate:

```ts
import {
  FluxorApiError,
  FluxorRateLimitError,
  FluxorNotFoundError,
  FluxorForbiddenError,
} from "fluxer.js";

try {
  await bot.api.banMember(guildId, userId, { reason: "spam" });
} catch (err) {
  if (err instanceof FluxorRateLimitError) {
    // Wait and retry
    await new Promise((r) => setTimeout(r, err.retryAfter));
  } else if (err instanceof FluxorForbiddenError) {
    // Missing permissions
    console.log("Cannot ban: missing permissions.");
  } else if (err instanceof FluxorNotFoundError) {
    // User or guild not found
    console.log("User or guild not found.");
  } else if (err instanceof FluxorApiError) {
    // Other API error
    console.log(`API error ${err.status}: ${err.body}`);
  } else {
    // Network error, timeout, etc.
    throw err;
  }
}
```

## Gateway Errors

Gateway (WebSocket) errors are emitted as `error` events rather than thrown:

```ts
bot.on("error", (err) => {
  console.error("Gateway error:", err);
});
```

The gateway client includes a default no-op error handler to prevent Node.js from crashing on unhandled `error` events. You can add your own handler to log or react to these errors.

## Request Timeouts

REST requests use `AbortSignal.timeout()` with the configured `requestTimeout` (default: 15 seconds). When a request times out, it throws an `AbortError`:

```ts
const bot = new Client("Bot TOKEN", { requestTimeout: 5000 });

try {
  await bot.api.getGuild(guildId);
} catch (err) {
  if (err instanceof DOMException && err.name === "AbortError") {
    console.log("Request timed out");
  }
}
```

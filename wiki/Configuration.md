# Configuration

All three client classes (`Client`, `ApiClient`, `GatewayClient`) accept a `FluxorConfig` object as their second constructor argument.

---

## FluxorConfig

```ts
interface FluxorConfig {
  apiBaseUrl?: string;
  apiVersion?: string;
  requestTimeout?: number;
  gatewayUrl?: string;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  enableRateLimiting?: boolean;
  presence?: PresenceData;
  ignoredGatewayEvents?: (keyof GatewayEvents)[];
  logger?: Logger;
}
```

## Option Reference

### REST Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiBaseUrl` | `string` | `"https://api.fluxer.app/v1"` | Base URL for REST API requests. No trailing slash. |
| `apiVersion` | `string` | `undefined` | Reserved for future API versioning. |
| `requestTimeout` | `number` | `15000` | Timeout in milliseconds for each REST request. Uses `AbortSignal.timeout()` internally. |

### Gateway Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `gatewayUrl` | `string` | `"wss://gateway.fluxer.app/?v=1&encoding=json"` | WebSocket URL for the gateway. |
| `reconnectDelay` | `number` | `2` | Base delay in seconds before reconnect attempts. Actual delay uses exponential backoff with jitter. |
| `maxReconnectAttempts` | `number` | `Infinity` | Maximum number of reconnect attempts before the client gives up. |
| `ignoredGatewayEvents` | `(keyof GatewayEvents)[]` | `undefined` | Array of event names to filter out. These events will never be dispatched to your handlers. Type-safe -- only valid event names are accepted. |
| `presence` | `PresenceData` | `undefined` | Initial presence sent in the IDENTIFY payload. |

### Rate Limiting

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enableRateLimiting` | `boolean` | `true` | Enable or disable client-side rate limiting. |

### Logging

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `logger` | `Logger` | `noopLogger` | Logger instance. Must have `debug()`, `info()`, `warn()`, and `error()` methods. |

## PresenceData

```ts
interface PresenceData {
  status: "online" | "idle" | "dnd" | "invisible" | "offline";
  activities?: unknown[];
  afk?: boolean;
  since?: number | null;
}
```

## Logger Interface

```ts
interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}
```

Fluxer.js ships with two built-in loggers:

```ts
import { createConsoleLogger, noopLogger } from "fluxer.js";

// Console logger with configurable level
const logger = createConsoleLogger("debug"); // "debug" | "info" | "warn" | "error"

// Silent no-op logger (default)
const silent = noopLogger;
```

## Example

```ts
const bot = new Client("Bot TOKEN", {
  requestTimeout: 10_000,
  reconnectDelay: 5,
  maxReconnectAttempts: 10,
  enableRateLimiting: true,
  presence: { status: "dnd" },
  ignoredGatewayEvents: ["PRESENCE_UPDATE", "TYPING_START"],
  logger: createConsoleLogger("info"),
});
```

# Getting Started

This guide walks you through creating your first Fluxer.js bot from scratch.

---

## 1. Create a new project

```bash
mkdir my-fluxor-bot
cd my-fluxor-bot
npm init -y
npm install fluxer.js
npm install -D typescript tsx
npx tsc --init
```

## 2. Configure TypeScript

In your `tsconfig.json`, set the following options:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "declaration": true
  },
  "include": ["src"]
}
```

Add `"type": "module"` to your `package.json`.

## 3. Set your bot token

Store your bot token in an environment variable. Never commit tokens to source control.

On Windows (PowerShell):
```powershell
$env:FLUXOR_TOKEN = "Bot YOUR_TOKEN_HERE"
```

On Linux / macOS:
```bash
export FLUXOR_TOKEN="Bot YOUR_TOKEN_HERE"
```

Or use a `.env` file with a library like `dotenv`.

## 4. Create the bot

Create `src/index.ts`:

```ts
import { Client, createConsoleLogger } from "fluxer.js";

const TOKEN = process.env.FLUXOR_TOKEN;
if (!TOKEN) {
  console.error("Missing FLUXOR_TOKEN environment variable.");
  process.exit(1);
}

const bot = new Client(TOKEN, {
  logger: createConsoleLogger("info"),
  presence: { status: "online" },
});

bot.enableGracefulShutdown();

bot.on("READY", (data) => {
  console.log(`Logged in as ${data.user.username}`);
  console.log(`Serving ${bot.guilds.size} guild(s)`);
});

bot.on("MESSAGE_CREATE", async (msg) => {
  if (msg.author?.bot) return;

  if (msg.content === "!ping") {
    await bot.send(msg.channel_id, `Pong! Latency: ${bot.ping}ms`);
  }
});

async function main() {
  await bot.connect();
  console.log("Bot is running. Press Ctrl+C to stop.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
```

## 5. Run the bot

```bash
npx tsx src/index.ts
```

## Token Format

Fluxor uses the following token formats:

| Type | Format | Example |
|------|--------|---------|
| Bot token | `Bot <token>` | `Bot 1234567890.abc123...` |
| User token | `flx_<token>` | `flx_abc123...` |

Bot tokens **must** include the `Bot ` prefix (with a trailing space).

## Next Steps

- [Configuration](Configuration) -- All available config options
- [Client](Client) -- Client caches, convenience methods, and lifecycle
- [Command Framework](Command-Framework) -- Add structured commands to your bot
- [EmbedBuilder](EmbedBuilder) -- Build rich embeds

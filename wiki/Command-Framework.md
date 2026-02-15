# Command Framework

Fluxer.js includes a command framework for structured message-based command handling. It supports prefix matching, argument parsing, preconditions, and lifecycle hooks.

---

## Overview

The command framework consists of:

- **CommandService** -- Registers commands and dispatches incoming messages.
- **CommandContext** -- Per-invocation context with message data, API access, and convenience methods.
- **CommandDefinition** -- Plain object describing a command (name, aliases, handler, parameters, preconditions).
- **ModuleBase** -- Optional base class for grouping commands into modules with lifecycle hooks.
- **Preconditions** -- Functions that must pass before a command executes.
- **Type Parsers** -- Convert raw string arguments into typed values.

---

## Quick Start

```ts
import { Client, CommandService } from "fluxer.js";
import type { CommandDefinition } from "fluxer.js";

const bot = new Client("Bot TOKEN");
const commands = new CommandService({ prefix: "!" });

const ping: CommandDefinition = {
  name: "ping",
  summary: "Check if the bot is alive",
  execute: async (ctx) => {
    await ctx.reply("Pong!");
  },
};

commands.addCommand(ping);

bot.on("MESSAGE_CREATE", async (msg) => {
  if (msg.author?.bot) return;

  const argPos = commands.hasPrefix(msg.content ?? "");
  if (argPos >= 0) {
    const result = await commands.execute(msg, bot.api, bot.gateway, argPos);
    if (!result.success) {
      console.log(`Command failed: ${result.reason}`);
    }
  }
});

await bot.connect();
```

---

## CommandService

### Constructor

```ts
const commands = new CommandService({
  prefix: "!",           // Command prefix (default: "!")
  caseSensitive: false,  // Whether command matching is case-sensitive (default: false)
  logger: myLogger,      // Optional logger
});
```

### Registering Commands

```ts
// Single command
commands.addCommand(myCommand);

// Multiple commands
commands.addCommands(cmd1, cmd2, cmd3);

// From a plain object map
commands.addCommandsFromObject({
  ping: { name: "ping", execute: async (ctx) => ctx.reply("Pong!") },
  help: { name: "help", execute: async (ctx) => ctx.reply("Help text") },
});

// From a module class
commands.addModule(new MyCommandModule());
```

### Searching

```ts
const result = commands.search("ping");
// { command: CommandDefinition, matchedAlias: string } | null
```

### Executing

```ts
const result = await commands.execute(message, api, gateway, argPos);
```

Returns a `CommandResult`:

```ts
interface CommandResult {
  success: boolean;
  error?: CommandError;
  reason?: string;
  exception?: unknown;
}
```

### Prefix Check

```ts
const argPos = commands.hasPrefix("!ping hello");
// Returns 0 if the message starts with the prefix, or -1 if not
```

---

## CommandDefinition

```ts
interface CommandDefinition {
  name: string;                    // Primary command name
  aliases?: string[];              // Alternative names
  summary?: string;                // Short description
  remarks?: string;                // Detailed usage info
  runMode?: RunMode;               // Sync or Async
  preconditions?: Precondition[];  // Must pass before execution
  parameters?: CommandParameter[]; // Argument definitions
  execute: (ctx: CommandContext, ...parsedArgs: unknown[]) => void | Promise<void>;
}
```

---

## CommandContext

The context object passed to every command handler.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `message` | `MessageEventData` | The raw gateway message event. |
| `api` | `ApiClient` | REST API client. |
| `gateway` | `GatewayClient` | Gateway client. |
| `channelId` | `string` | Channel ID where the command was sent. |
| `guildId` | `string \| undefined` | Guild ID (undefined in DMs). |
| `user` | `User \| undefined` | The user who sent the command. |
| `content` | `string` | Full message content. |
| `argString` | `string` | Everything after the command name. |
| `args` | `string[]` | Arguments split by whitespace. |

### Methods

```ts
// Reply with text
await ctx.reply("Hello!");

// Reply with a full payload
await ctx.reply({ content: "Hello!", embeds: [embed] });

// Reply with just an embed
await ctx.replyEmbed(embed);
```

---

## Preconditions

Preconditions are functions that run before a command executes. If any precondition fails, the command is not executed and the result includes the error reason.

### Built-in Preconditions

```ts
import { requireGuild, requireOwner, requirePermissions, Permissions } from "fluxer.js";

const cmd: CommandDefinition = {
  name: "ban",
  preconditions: [
    requireGuild(),                            // Must be in a guild
    requireOwner("user-id-1", "user-id-2"),   // Must be a bot owner
    requirePermissions(Permissions.BanMembers), // Must have BanMembers permission
  ],
  execute: async (ctx) => { ... },
};
```

### Custom Preconditions

```ts
import type { Precondition, PreconditionResult } from "fluxer.js";
import { CommandError } from "fluxer.js";

const requireChannel = (channelId: string): Precondition => {
  return (ctx) => {
    if (ctx.channelId === channelId) return { success: true };
    return {
      success: false,
      error: CommandError.UnmetPrecondition,
      reason: "This command can only be used in a specific channel.",
    };
  };
};
```

---

## Argument Parsing

Define parameters on a command to automatically parse arguments from the message.

```ts
import { NumberParser, StringParser, BooleanParser } from "fluxer.js";

const greet: CommandDefinition = {
  name: "greet",
  parameters: [
    { name: "name", type: StringParser },
    { name: "times", type: NumberParser, optional: true, defaultValue: 1 },
  ],
  execute: async (ctx, name: unknown, times: unknown) => {
    const n = name as string;
    const t = times as number;
    await ctx.reply(`Hello, ${n}!`.repeat(t));
  },
};
```

### Built-in Type Parsers

| Parser | Output Type | Description |
|--------|-------------|-------------|
| `StringParser` | `string` | Passes through the raw value. |
| `NumberParser` | `number` | Parses as a float. Returns `undefined` if NaN. |
| `IntegerParser` | `number` | Parses as an integer. Returns `undefined` if NaN. |
| `BooleanParser` | `boolean` | Accepts `true/yes/1` and `false/no/0`. |
| `BigIntParser` | `bigint` | Parses as a BigInt. |

### Custom Type Parsers

```ts
import type { TypeParser } from "fluxer.js";

const UserMentionParser: TypeParser<string> = {
  name: "user_mention",
  parse(value) {
    const match = value.match(/^<@!?(\d+)>$/);
    return match ? match[1] : undefined;
  },
};
```

---

## ModuleBase

For organizing commands into classes with shared lifecycle hooks:

```ts
import { ModuleBase } from "fluxer.js";
import type { CommandDefinition } from "fluxer.js";

class ModerationCommands extends ModuleBase {
  getCommands(): CommandDefinition[] {
    return [
      {
        name: "warn",
        execute: async (ctx) => {
          await this.reply(`Warning issued in ${ctx.guildId}`);
        },
      },
      {
        name: "mute",
        execute: async (ctx) => {
          await this.reply("User muted.");
        },
      },
    ];
  }

  async beforeExecute(ctx) {
    console.log(`Running command in guild ${ctx.guildId}`);
  }

  async afterExecute(ctx) {
    console.log("Command completed.");
  }
}

commands.addModule(new ModerationCommands());
```

### ModuleBase Properties and Methods

| Member | Description |
|--------|-------------|
| `context` | The current `CommandContext` (set before each execution). |
| `getCommands()` | Abstract. Return the command definitions for this module. |
| `beforeExecute(ctx)` | Called before each command. Override for setup logic. |
| `afterExecute(ctx)` | Called after each command. Override for teardown logic. |
| `reply(message)` | Convenience method to reply to the current channel. |

---

## Error Types

The `CommandError` enum defines the possible error types:

| Value | Description |
|-------|-------------|
| `PARSE_FAILED` | An argument could not be parsed to its expected type. |
| `UNKNOWN_COMMAND` | No command matched the input. |
| `BAD_ARG_COUNT` | Missing required arguments. |
| `UNMET_PRECONDITION` | A precondition check failed. |
| `EXCEPTION` | The command handler threw an error. |
| `UNSUCCESSFUL` | Generic failure. |

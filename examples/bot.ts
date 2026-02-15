/**
 * Fluxer.js — Example Bot
 *
 * Demonstrates:
 *   - Basic event handling
 *   - EmbedBuilder usage
 *   - Command framework
 *   - Graceful shutdown
 *
 * Prerequisites:
 *   1. npm install (in the fluxor.js root)
 *   2. Set your bot token via the FLUXOR_TOKEN env var
 *
 * Run:
 *   npx tsx examples/bot.ts
 */

import {
  Client,
  createConsoleLogger,
  EmbedBuilder,
  CommandService,
  requireGuild,
} from "../src/index.js";
import type { CommandDefinition } from "../src/index.js";
import { runSetup } from "../scripts/community-server-plan.js";

// ── Configuration ────────────────────────────────────────────────────────────

const TOKEN = process.env.FLUXOR_TOKEN ?? "Bot YOUR_TOKEN_HERE";

const bot = new Client(TOKEN, {
  logger: createConsoleLogger("debug"),
  presence: { status: "online" },
  ignoredGatewayEvents: ["PRESENCE_UPDATE"], // reduce noise
});

// Enable graceful SIGINT/SIGTERM handling
bot.enableGracefulShutdown();

// ── Command framework setup ─────────────────────────────────────────────────

const commands = new CommandService({ prefix: "!", logger: createConsoleLogger("info") });

// Define commands as plain objects — no decorators needed
const pingCommand: CommandDefinition = {
  name: "ping",
  summary: "Check if the bot is responsive",
  execute: async (ctx) => {
    await ctx.reply(`Pong! Gateway latency: ${bot.ping}ms`);
  },
};

const embedCommand: CommandDefinition = {
  name: "embed",
  summary: "Show an example embed",
  execute: async (ctx) => {
    const embed = new EmbedBuilder()
      .setTitle("Hello from Fluxer.js!")
      .setDescription("This embed was built with the **EmbedBuilder**.")
      .setColor(0x5865f2)
      .addField("Uptime", `${Math.floor(bot.uptime / 1000)}s`, true)
      .addField("Guilds", `${bot.guilds.size}`, true)
      .setFooter("Fluxer.js SDK")
      .setTimestamp()
      .build();

    await ctx.replyEmbed(embed);
  },
};

const whoamiCommand: CommandDefinition = {
  name: "whoami",
  summary: "Show info about the bot user",
  execute: async (ctx) => {
    const user = bot.user;
    if (!user) {
      await ctx.reply("Bot user not available yet.");
      return;
    }
    await ctx.reply(`I am **${user.username}** (ID: ${user.id})`);
  },
};

const setupServerCommand: CommandDefinition = {
  name: "setup-server",
  summary: "Create community server channels and welcome messages in this guild",
  preconditions: [requireGuild()],
  execute: async (ctx) => {
    await ctx.reply("Setting up server... Creating categories and channels.");
    const result = await runSetup(ctx.api, ctx.guildId!, { delayMs: 500 });
    const errText =
      result.errors.length > 0
        ? `\nErrors: ${result.errors.slice(0, 5).join("; ")}${result.errors.length > 5 ? "..." : ""}`
        : "";
    await ctx.reply(
      `Done. Created **${result.categoriesCreated}** categories and **${result.channelsCreated}** channels.${errText}`
    );
  },
};

commands.addCommands(pingCommand, embedCommand, whoamiCommand, setupServerCommand);

// ── Events ───────────────────────────────────────────────────────────────────

bot.on("READY", (data) => {
  console.log(`Bot is ready! Logged in as ${data.user.username}`);
  console.log(`  Guilds: ${bot.guilds.size}`);
  console.log(`  Channels: ${bot.channels.size}`);
});

bot.on("MESSAGE_CREATE", async (msg) => {
  // Ignore messages from bots / webhooks
  if (!msg.author || msg.author.bot) return;

  console.log(`[${msg.channel_id}] ${msg.author.username}: ${msg.content}`);

  // Run through the command framework
  const argPos = commands.hasPrefix(msg.content ?? "");
  if (argPos >= 0) {
    const result = await commands.execute(msg, bot.api, bot.gateway, argPos);
    if (!result.success && result.error !== "UNKNOWN_COMMAND") {
      console.error(`Command error: ${result.reason}`);
    }
  }
});

bot.on("GUILD_CREATE", (guild) => {
  console.log(`Guild available: ${guild.name} (${guild.id})`);
});

// ── Connect ──────────────────────────────────────────────────────────────────

async function main() {
  await bot.connect();
  console.log("Bot is running. Press Ctrl+C to stop.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

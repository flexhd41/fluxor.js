/**
 * 07 - Event Logger
 *
 * A utility bot that logs all gateway events to the console.
 * Useful for understanding what events the Fluxer gateway sends
 * and for debugging. Also demonstrates the raw event handler,
 * heartbeat latency tracking, and typing indicators.
 *
 * Run:
 *   npx tsx examples/07-event-logger.ts
 */

import { Client, createConsoleLogger } from "../src/index.js";

const TOKEN = process.env.FLUXOR_TOKEN ?? "Bot YOUR_TOKEN_HERE";

const bot = new Client(TOKEN, {
  logger: createConsoleLogger("warn"), // quiet the built-in logger
  presence: { status: "online" },
});

bot.enableGracefulShutdown();

// ── Track event counts ──────────────────────────────────────────────────────

const eventCounts: Record<string, number> = {};
const startTime = Date.now();

// ── Log every raw event ─────────────────────────────────────────────────────

bot.on("raw", ({ event, data }) => {
  eventCounts[event] = (eventCounts[event] ?? 0) + 1;

  const timestamp = new Date().toISOString().slice(11, 23); // HH:mm:ss.SSS
  const preview = JSON.stringify(data)?.slice(0, 120) ?? "";
  console.log(`[${timestamp}] ${event} ${preview}${preview.length >= 120 ? "..." : ""}`);
});

// ── Heartbeat latency ───────────────────────────────────────────────────────

bot.on("HEARTBEAT_ACK", (latency) => {
  console.log(`  [heartbeat] round-trip: ${latency}ms`);
});

// ── Connection events ───────────────────────────────────────────────────────

bot.on("close", ({ code, reason }) => {
  console.log(`  [close] code=${code} reason="${reason}"`);
});

bot.on("error", (err) => {
  console.error(`  [error] ${err.message}`);
});

// ── Specific events with formatted output ───────────────────────────────────

bot.on("READY", (data) => {
  console.log("\n=== READY ===");
  console.log(`  User: ${data.user.username} (${data.user.id})`);
  console.log(`  Session: ${data.session_id}`);
  console.log(`  Guilds: ${data.guilds.length}`);
  if (data.private_channels) {
    console.log(`  DM Channels: ${data.private_channels.length}`);
  }
  console.log("=============\n");
});

bot.on("TYPING_START", (data) => {
  console.log(`  [typing] user=${data.user_id} channel=${data.channel_id}`);
});

bot.on("MESSAGE_CREATE", async (msg) => {
  if (msg.author?.bot) return;

  // Print event stats on command
  if (msg.content === "!eventstats") {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const sorted = Object.entries(eventCounts)
      .sort(([, a], [, b]) => b - a);

    const total = sorted.reduce((sum, [, count]) => sum + count, 0);

    const lines = [
      `**Event Statistics** (${elapsed}s uptime)`,
      `Total events: ${total}`,
      "",
      ...sorted.map(([event, count]) => `\`${event}\`: ${count}`),
    ];

    await bot.send(msg.channel_id, lines.join("\n"));
  }

  // Clear stats
  if (msg.content === "!clearstats") {
    for (const key of Object.keys(eventCounts)) {
      delete eventCounts[key];
    }
    await bot.send(msg.channel_id, "Event counters cleared.");
  }
});

bot.on("GUILD_MEMBER_ADD", (member) => {
  console.log(`  [member+] guild=${member.guild_id} user=${member.user?.username ?? "?"}`);
});

bot.on("GUILD_MEMBER_REMOVE", (data) => {
  console.log(`  [member-] guild=${data.guild_id} id=${data.id}`);
});

bot.on("CHANNEL_CREATE", (ch) => {
  console.log(`  [channel+] ${ch.name ?? "unnamed"} (${ch.id}) in guild ${ch.guild_id ?? "DM"}`);
});

bot.on("CHANNEL_DELETE", (ch) => {
  console.log(`  [channel-] ${ch.name ?? "unnamed"} (${ch.id})`);
});

bot.on("GUILD_CREATE", (guild) => {
  console.log(`  [guild+] ${guild.name} (${guild.id}) -- ${guild.member_count ?? "?"} members`);
});

bot.on("GUILD_DELETE", (data) => {
  console.log(`  [guild-] ${data.id} (unavailable: ${data.unavailable ?? false})`);
});

bot.on("MESSAGE_REACTION_ADD", (data) => {
  console.log(
    `  [reaction+] ${data.emoji.name} by ${data.user_id} on ${data.message_id}`,
  );
});

bot.on("VOICE_STATE_UPDATE", (data) => {
  console.log(
    `  [voice] user=${data.user_id} channel=${data.channel_id ?? "none"} mute=${data.self_mute} deaf=${data.self_deaf}`,
  );
});

async function main() {
  console.log("Starting event logger bot...\n");
  await bot.connect();
  console.log("\nEvent logger running. Try: !eventstats, !clearstats");
}

main().catch(console.error);

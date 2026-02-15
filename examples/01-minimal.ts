/**
 * 01 - Minimal Bot
 *
 * The simplest possible Fluxer.js bot. Connects to the gateway,
 * logs when ready, and replies "Pong!" to any message containing "!ping".
 *
 * Run:
 *   npx tsx examples/01-minimal.ts
 */

import { Client } from "../src/index.js";

const TOKEN = process.env.FLUXOR_TOKEN ?? "Bot YOUR_TOKEN_HERE";

const bot = new Client(TOKEN);

bot.on("READY", (data) => {
  console.log(`Logged in as ${data.user.username}`);
});

bot.on("MESSAGE_CREATE", async (msg) => {
  if (msg.author?.bot) return;

  if (msg.content === "!ping") {
    await bot.send(msg.channel_id, "Pong!");
  }
});

async function main() {
  await bot.connect();
}

main().catch(console.error);

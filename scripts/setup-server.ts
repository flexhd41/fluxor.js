/**
 * Community server setup script.
 *
 * Creates channels (organised into categories) and sends initial
 * welcome / info messages. Use this when the bot is not connected
 * to the gateway (e.g. no guilds in cache). Otherwise use the
 * !setup-server command in the guild.
 *
 * Usage:  npx tsx scripts/setup-server.ts [guildId]
 *   Set FLUXOR_TOKEN env var. If guildId is omitted, uses the first guild from the API.
 */

import { Client } from "../src/index.js";
import { runSetup } from "./community-server-plan.js";

const TOKEN = process.env.FLUXOR_TOKEN ?? "Bot YOUR_TOKEN_HERE";
const guildIdArg = process.argv[2];

const bot = new Client(TOKEN);

async function main() {
  await bot.connect();

  await new Promise<void>((resolve) => {
    if (bot.isReady) return resolve();
    bot.on("READY", () => resolve());
  });

  let guildId: string | undefined = guildIdArg;

  if (!guildId) {
    const fromCache = bot.guilds.values().next().value;
    if (fromCache) {
      guildId = fromCache.id;
      console.log(`Using guild from cache: ${fromCache.name ?? guildId}`);
    }
  }

  if (!guildId) {
    const guilds = await bot.api.getCurrentUserGuilds();
    const first = guilds[0];
    if (first) {
      guildId = first.id;
      console.log(`Using first guild from API: ${first.name ?? guildId}`);
    }
  }

  if (!guildId) {
    console.error("No guild found. Add the bot to a server or pass guild ID: npx tsx scripts/setup-server.ts <guildId>");
    bot.destroy();
    process.exit(1);
  }

  console.log("Setting up server...");
  const result = await runSetup(bot.api, guildId, { delayMs: 500 });
  console.log(`Done. Created ${result.categoriesCreated} categories and ${result.channelsCreated} channels.`);
  if (result.errors.length > 0) {
    console.error("Errors:", result.errors);
  }
  bot.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

/**
 * 02 - Embeds
 *
 * Shows how to build and send rich embeds using the EmbedBuilder.
 * Includes examples of every embed feature: title, description, colour,
 * fields, images, thumbnails, author, footer, and timestamp.
 *
 * Run:
 *   npx tsx examples/02-embeds.ts
 */

import { Client, EmbedBuilder, createConsoleLogger } from "../src/index.js";

const TOKEN = process.env.FLUXOR_TOKEN ?? "Bot YOUR_TOKEN_HERE";

const bot = new Client(TOKEN, {
  logger: createConsoleLogger("info"),
  presence: { status: "online" },
});

bot.enableGracefulShutdown();

bot.on("READY", () => {
  console.log(`Logged in as ${bot.user?.username}`);
});

bot.on("MESSAGE_CREATE", async (msg) => {
  if (msg.author?.bot) return;

  // ── Simple embed ──────────────────────────────────────────────────────

  if (msg.content === "!simple") {
    const embed = new EmbedBuilder()
      .setTitle("Simple Embed")
      .setDescription("This is a basic embed with just a title and description.")
      .setColor(0x00aaff)
      .build();

    await bot.send(msg.channel_id, { embeds: [embed] });
  }

  // ── Full-featured embed ───────────────────────────────────────────────

  if (msg.content === "!full") {
    const embed = new EmbedBuilder()
      .setTitle("Full Embed Example")
      .setDescription("This embed uses every available feature.")
      .setUrl("https://github.com/flexhd41/fluxer.js")
      .setColor(0x5865f2)
      .setAuthor("Fluxer.js Bot", "https://github.com/flexhd41/fluxer.js")
      .setThumbnail("https://via.placeholder.com/80")
      .setImage("https://via.placeholder.com/400x200")
      .addFields(
        { name: "Inline Field 1", value: "Value 1", inline: true },
        { name: "Inline Field 2", value: "Value 2", inline: true },
        { name: "Inline Field 3", value: "Value 3", inline: true },
      )
      .addField("Regular Field", "This field takes the full width.")
      .setFooter("Requested by " + (msg.author?.username ?? "unknown"))
      .setTimestamp()
      .build();

    await bot.send(msg.channel_id, { embeds: [embed] });
  }

  // ── Multiple embeds in one message ────────────────────────────────────

  if (msg.content === "!multi") {
    const red = new EmbedBuilder()
      .setTitle("Red")
      .setColor(0xff0000)
      .setDescription("This embed is red.")
      .build();

    const green = new EmbedBuilder()
      .setTitle("Green")
      .setColor(0x00ff00)
      .setDescription("This embed is green.")
      .build();

    const blue = new EmbedBuilder()
      .setTitle("Blue")
      .setColor(0x0000ff)
      .setDescription("This embed is blue.")
      .build();

    await bot.send(msg.channel_id, { embeds: [red, green, blue] });
  }

  // ── Server info embed ─────────────────────────────────────────────────

  if (msg.content === "!serverinfo") {
    const guild = msg.guild_id ? bot.guilds.get(msg.guild_id) : undefined;
    if (!guild) {
      await bot.send(msg.channel_id, "This command can only be used in a server.");
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(guild.name)
      .setColor(0x2f3136)
      .addFields(
        { name: "Owner", value: `<@${guild.owner_id}>`, inline: true },
        { name: "Members", value: `${guild.member_count ?? "?"}`, inline: true },
        { name: "Channels", value: `${guild.channels?.length ?? "?"}`, inline: true },
        { name: "Roles", value: `${guild.roles?.length ?? "?"}`, inline: true },
      )
      .setFooter(`ID: ${guild.id}`)
      .setTimestamp()
      .build();

    await bot.send(msg.channel_id, { embeds: [embed] });
  }
});

async function main() {
  await bot.connect();
  console.log("Embed bot running. Try: !simple, !full, !multi, !serverinfo");
}

main().catch(console.error);

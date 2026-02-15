/**
 * 05 - waitFor Utility
 *
 * Demonstrates the waitFor utility for building interactive flows:
 * confirmation prompts, multi-step wizards, and reaction collectors.
 *
 * Run:
 *   npx tsx examples/05-waitfor.ts
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

  // ── Confirmation prompt ───────────────────────────────────────────────

  if (msg.content === "!confirm") {
    await bot.send(msg.channel_id, "Are you sure? Reply **yes** or **no** within 15 seconds.");

    try {
      const response = await bot.waitFor("MESSAGE_CREATE", {
        filter: (m) =>
          m.channel_id === msg.channel_id &&
          m.author?.id === msg.author?.id &&
          ["yes", "no"].includes((m.content ?? "").toLowerCase()),
        timeout: 15_000,
      });

      if (response.content?.toLowerCase() === "yes") {
        await bot.send(msg.channel_id, "Confirmed! Action would be taken here.");
      } else {
        await bot.send(msg.channel_id, "Cancelled.");
      }
    } catch {
      await bot.send(msg.channel_id, "Timed out. No action taken.");
    }
  }

  // ── Number guessing game ──────────────────────────────────────────────

  if (msg.content === "!guess") {
    const target = Math.floor(Math.random() * 10) + 1;
    let attempts = 0;
    const maxAttempts = 5;

    await bot.send(
      msg.channel_id,
      `I'm thinking of a number between 1 and 10. You have ${maxAttempts} guesses. Go!`,
    );

    while (attempts < maxAttempts) {
      try {
        const response = await bot.waitFor("MESSAGE_CREATE", {
          filter: (m) =>
            m.channel_id === msg.channel_id &&
            m.author?.id === msg.author?.id &&
            !isNaN(Number(m.content)),
          timeout: 30_000,
        });

        attempts++;
        const guess = Number(response.content);

        if (guess === target) {
          await bot.send(
            msg.channel_id,
            `Correct! The number was **${target}**. You got it in ${attempts} attempt(s).`,
          );
          return;
        } else if (guess < target) {
          await bot.send(
            msg.channel_id,
            `Too low! ${maxAttempts - attempts} guess(es) remaining.`,
          );
        } else {
          await bot.send(
            msg.channel_id,
            `Too high! ${maxAttempts - attempts} guess(es) remaining.`,
          );
        }
      } catch {
        await bot.send(msg.channel_id, `Time's up! The number was **${target}**.`);
        return;
      }
    }

    await bot.send(msg.channel_id, `Out of guesses! The number was **${target}**.`);
  }

  // ── Multi-step form ───────────────────────────────────────────────────

  if (msg.content === "!profile") {
    const userId = msg.author?.id;
    if (!userId) return;

    const askAndWait = async (prompt: string): Promise<string | null> => {
      await bot.send(msg.channel_id, prompt);
      try {
        const response = await bot.waitFor("MESSAGE_CREATE", {
          filter: (m) =>
            m.channel_id === msg.channel_id && m.author?.id === userId,
          timeout: 30_000,
        });
        return response.content ?? null;
      } catch {
        return null;
      }
    };

    const name = await askAndWait("What is your name? (30s timeout)");
    if (!name) {
      await bot.send(msg.channel_id, "Timed out. Profile creation cancelled.");
      return;
    }

    const color = await askAndWait("What is your favourite colour? (30s timeout)");
    if (!color) {
      await bot.send(msg.channel_id, "Timed out. Profile creation cancelled.");
      return;
    }

    const hobby = await askAndWait("What is your hobby? (30s timeout)");
    if (!hobby) {
      await bot.send(msg.channel_id, "Timed out. Profile creation cancelled.");
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`Profile: ${name}`)
      .setColor(0x5865f2)
      .addField("Favourite Colour", color, true)
      .addField("Hobby", hobby, true)
      .setFooter(`Created by ${msg.author?.username ?? "unknown"}`)
      .setTimestamp()
      .build();

    await bot.send(msg.channel_id, { embeds: [embed] });
  }

  // ── Wait for a reaction ───────────────────────────────────────────────

  if (msg.content === "!poll") {
    const pollMsg = await bot.send(msg.channel_id, "Do you like Fluxer.js? React to this message!");

    // Wait for any reaction on the poll message
    try {
      const reaction = await bot.waitFor("MESSAGE_REACTION_ADD", {
        filter: (r) => r.message_id === pollMsg.id,
        timeout: 30_000,
      });

      await bot.send(
        msg.channel_id,
        `<@${reaction.user_id}> reacted with ${reaction.emoji.name} to the poll!`,
      );
    } catch {
      await bot.send(msg.channel_id, "No one reacted in time.");
    }
  }
});

async function main() {
  await bot.connect();
  console.log("WaitFor bot running. Try: !confirm, !guess, !profile, !poll");
}

main().catch(console.error);

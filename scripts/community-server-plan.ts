/**
 * Community server channel and message plan.
 * Used by the !setup-server command and by scripts/setup-server.ts.
 */

import type { ApiClient } from "../src/api/ApiClient.js";
import { ChannelType } from "../src/types/enums.js";

export interface ChannelPlan {
  name: string;
  type: ChannelType;
  topic?: string;
  parentName?: string;
  messages?: string[];
}

export const CATEGORIES = [
  "INFO",
  "COMMUNITY",
  "SUPPORT",
  "DEVELOPMENT",
  "VOICE",
];

export const CHANNELS: ChannelPlan[] = [
  {
    name: "welcome",
    type: ChannelType.GuildText,
    topic: "Welcome to the Fluxer.js community server",
    parentName: "INFO",
    messages: [
      "# Welcome to Fluxer.js\n\nThis is the official community server for **Fluxer.js** -- the JavaScript/TypeScript SDK for the Fluxor platform.\n\nHere you can get help, share what you are building, and stay up to date with SDK development.",
      "## Quick links\n\n- **GitHub**: https://github.com/flexhd41/fluxer.js\n- **npm**: https://www.npmjs.com/package/fluxer.js\n- **Wiki**: https://github.com/flexhd41/fluxer.js/wiki",
    ],
  },
  {
    name: "rules",
    type: ChannelType.GuildText,
    topic: "Server rules -- please read before participating",
    parentName: "INFO",
    messages: [
      "# Server Rules\n\n1. **Be respectful** -- Treat everyone with courtesy. No harassment, hate speech, or personal attacks.\n2. **Stay on topic** -- Use the correct channels for your discussions.\n3. **No spam** -- Avoid excessive messages, self-promotion, or unsolicited DMs.\n4. **No NSFW content** -- Keep everything safe for work.\n5. **Use English** -- So everyone can participate and moderators can follow along.\n6. **Search before asking** -- Check the docs and previous messages before posting a question.\n7. **No piracy or illegal content** -- This includes sharing tokens or credentials.\n8. **Follow the Fluxor platform terms of service.**\n\nBreaking these rules may result in a warning, mute, or ban at moderator discretion.",
    ],
  },
  {
    name: "announcements",
    type: ChannelType.GuildText,
    topic: "Official announcements and release notes",
    parentName: "INFO",
    messages: [
      "# Announcements\n\nThis channel is for official SDK announcements, release notes, and important updates.\n\nStay tuned for news about Fluxer.js.",
      "## Fluxer.js v1.0.0 Released\n\nWe are excited to announce the first stable release of Fluxer.js.\n\n**Highlights:**\n- Full REST API coverage\n- Gateway client with auto-reconnect and heartbeat tracking\n- EmbedBuilder with validation\n- Command framework with preconditions and argument parsing\n- Client-side rate limiting\n- TypeScript-first with full type definitions\n\nInstall it now:\n```\nnpm install fluxer.js\n```",
    ],
  },
  {
    name: "general",
    type: ChannelType.GuildText,
    topic: "General chat -- talk about anything",
    parentName: "COMMUNITY",
    messages: [
      "Welcome to general chat. Feel free to talk about anything here -- Fluxor, bots, programming, or just hang out.",
    ],
  },
  {
    name: "show-and-tell",
    type: ChannelType.GuildText,
    topic: "Show off your bots and projects built with Fluxer.js",
    parentName: "COMMUNITY",
    messages: [
      "# Show and Tell\n\nBuilt something with Fluxer.js? Share it here. Screenshots, repos, demos -- we want to see what you are working on.",
    ],
  },
  {
    name: "suggestions",
    type: ChannelType.GuildText,
    topic: "Suggest features or improvements for the SDK",
    parentName: "COMMUNITY",
    messages: [
      "# Suggestions\n\nHave an idea for a new feature or improvement? Post it here. Describe what you want and why it would be useful. The best suggestions may end up in the SDK.",
    ],
  },
  {
    name: "help",
    type: ChannelType.GuildText,
    topic: "Ask questions and get help with Fluxer.js",
    parentName: "SUPPORT",
    messages: [
      "# Help\n\nNeed help with the SDK? Post your question here.\n\n**Tips for a good question:**\n- Describe what you are trying to do\n- Share the relevant code (use code blocks)\n- Include the full error message if there is one\n- Mention your Node.js version and OS",
    ],
  },
  {
    name: "bugs",
    type: ChannelType.GuildText,
    topic: "Report bugs in the SDK",
    parentName: "SUPPORT",
    messages: [
      "# Bug Reports\n\nFound a bug? Report it here or open an issue on GitHub.\n\n**When reporting, please include:**\n- Steps to reproduce\n- Expected vs actual behaviour\n- SDK version, Node.js version, OS\n- Relevant code and error output\n\nGitHub issues: https://github.com/flexhd41/fluxer.js/issues",
    ],
  },
  {
    name: "sdk-dev",
    type: ChannelType.GuildText,
    topic: "Discussion about SDK internals and contributing",
    parentName: "DEVELOPMENT",
    messages: [
      "# SDK Development\n\nThis channel is for discussion about the SDK itself -- architecture, internals, and contributing.\n\nWant to contribute? Check out the repo and feel free to open a PR: https://github.com/flexhd41/fluxer.js",
    ],
  },
  {
    name: "bot-dev",
    type: ChannelType.GuildText,
    topic: "General bot development discussion",
    parentName: "DEVELOPMENT",
    messages: [
      "# Bot Development\n\nDiscuss bot development patterns, architecture, hosting, databases, and anything related to building bots on the Fluxor platform.",
    ],
  },
  {
    name: "code-review",
    type: ChannelType.GuildText,
    topic: "Share code for review and feedback",
    parentName: "DEVELOPMENT",
    messages: [
      "# Code Review\n\nShare your code and get constructive feedback. Paste snippets in code blocks or link to a repo. Be kind when reviewing -- we are all learning.",
    ],
  },
  { name: "Lounge", type: ChannelType.GuildVoice, parentName: "VOICE" },
  { name: "Pair Programming", type: ChannelType.GuildVoice, parentName: "VOICE" },
];

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface SetupResult {
  categoriesCreated: number;
  channelsCreated: number;
  errors: string[];
}

/**
 * Create categories, channels, and send initial messages in the given guild.
 */
export async function runSetup(
  api: ApiClient,
  guildId: string,
  options?: { delayMs?: number }
): Promise<SetupResult> {
  const delay = options?.delayMs ?? 500;
  const errors: string[] = [];
  let categoriesCreated = 0;
  let channelsCreated = 0;

  const categoryIds = new Map<string, string>();

  for (const catName of CATEGORIES) {
    try {
      const cat = await api.createGuildChannel(guildId, {
        name: catName,
        type: ChannelType.GuildCategory,
      });
      categoryIds.set(catName, cat.id);
      categoriesCreated++;
    } catch (err: unknown) {
      errors.push(`Category ${catName}: ${(err as Error).message}`);
    }
    await sleep(delay);
  }

  for (const ch of CHANNELS) {
    const parentId = ch.parentName ? categoryIds.get(ch.parentName) : undefined;
    try {
      const created = await api.createGuildChannel(guildId, {
        name: ch.name,
        type: ch.type,
        topic: ch.topic,
        parent_id: parentId,
      });
      channelsCreated++;

      if (ch.messages?.length) {
        for (const msg of ch.messages) {
          await api.sendMessage(created.id, msg);
          await sleep(300);
        }
      }
    } catch (err: unknown) {
      errors.push(`Channel #${ch.name}: ${(err as Error).message}`);
    }
    await sleep(delay);
  }

  return { categoriesCreated, channelsCreated, errors };
}

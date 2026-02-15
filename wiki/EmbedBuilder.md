# EmbedBuilder

The `EmbedBuilder` provides a fluent API for constructing rich embed objects with built-in validation. It mirrors the embed builder from the .NET SDK.

---

## Basic Usage

```ts
import { EmbedBuilder } from "fluxer.js";

const embed = new EmbedBuilder()
  .setTitle("My Embed")
  .setDescription("A description for the embed.")
  .setColor(0x5865f2)
  .build();

await bot.send(channelId, { embeds: [embed] });
```

## Methods

All setter methods return `this` for chaining.

| Method | Description |
|--------|-------------|
| `setTitle(title)` | Set the title (max 256 characters). |
| `setDescription(description)` | Set the description (max 4096 characters). |
| `setUrl(url)` | Set the URL (makes the title clickable). |
| `setTimestamp(date?)` | Set the timestamp. Accepts a `Date`, ISO string, or omit for "now". |
| `setColor(color)` | Set the colour as a decimal integer (e.g. `0x00AAFF`). |
| `setFooter(text, iconUrl?)` | Set the footer text (max 2048 characters) and optional icon. |
| `setImage(url)` | Set the embed image URL. |
| `setThumbnail(url)` | Set the embed thumbnail URL. |
| `setAuthor(name, url?, iconUrl?)` | Set the author (name max 256 characters). |
| `addField(name, value, inline?)` | Add a field (max 25 fields per embed). |
| `addFields(...fields)` | Add multiple fields at once. |
| `build()` | Validate and return the `Embed` object. |

## Validation Constants

| Constant | Value |
|----------|-------|
| `MaxTitleLength` | 256 |
| `MaxDescriptionLength` | 4096 |
| `MaxFieldCount` | 25 |
| `MaxFieldNameLength` | 256 |
| `MaxFieldValueLength` | 1024 |
| `MaxFooterTextLength` | 2048 |
| `MaxAuthorNameLength` | 256 |
| `MaxEmbedLength` | 6000 |

The `build()` method throws a `RangeError` if any validation constraint is violated, including the total character count across all text fields (title + description + footer + author + all field names and values) exceeding 6000.

## Sub-Builders

For advanced use, you can use the sub-builders directly:

```ts
import { EmbedAuthorBuilder, EmbedFooterBuilder, EmbedFieldBuilder } from "fluxer.js";

const author = new EmbedAuthorBuilder("Author Name")
  .setUrl("https://example.com")
  .setIconUrl("https://example.com/icon.png")
  .build();

const footer = new EmbedFooterBuilder("Footer text")
  .setIconUrl("https://example.com/icon.png")
  .build();

const field = new EmbedFieldBuilder("Field Name", "Field Value", true)
  .build();
```

## Full Example

```ts
import { EmbedBuilder } from "fluxer.js";

const embed = new EmbedBuilder()
  .setTitle("Server Info")
  .setDescription("Here is some information about this server.")
  .setColor(0x2f3136)
  .setThumbnail("https://example.com/server-icon.png")
  .setAuthor("Fluxor Bot", undefined, "https://example.com/bot-icon.png")
  .addFields(
    { name: "Members", value: "150", inline: true },
    { name: "Channels", value: "25", inline: true },
    { name: "Created", value: "2024-01-15", inline: true },
  )
  .addField("Description", "A great community server for developers.")
  .setFooter("Requested by User#1234")
  .setTimestamp()
  .build();

await bot.send(channelId, { embeds: [embed] });
```

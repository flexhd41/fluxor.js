# Types and Enums

Fluxer.js provides comprehensive TypeScript type definitions for all data models, gateway events, and enumerated values. All model interfaces use `snake_case` property names matching the API wire format.

---

## Data Models

All model interfaces are exported from `fluxer.js` and defined in `src/types/models.ts`. Fields that are always present in API responses are required; contextually absent fields are optional.

### Core Models

| Interface | Key Fields |
|-----------|------------|
| `User` | `id`, `username`, `tag`, `avatar`, `bot?`, `flags?` |
| `Channel` | `id`, `type`, `guild_id?`, `name?`, `topic?` |
| `Message` | `id`, `channel_id`, `author`, `content`, `timestamp`, `embeds`, `attachments` |
| `Guild` | `id`, `name`, `icon`, `owner_id`, `roles?`, `channels?`, `members?` |
| `GuildMember` | `user?`, `roles`, `joined_at`, `nickname?`, `permissions?` |
| `GuildRole` | `id`, `name`, `color`, `hoist`, `position`, `permissions` |

### Embed Types

| Interface | Key Fields |
|-----------|------------|
| `Embed` | `title?`, `description?`, `url?`, `color?`, `fields?`, `footer?`, `image?`, `author?` |
| `EmbedFooter` | `text`, `icon_url?` |
| `EmbedAuthor` | `name`, `url?`, `icon_url?` |
| `EmbedField` | `name`, `value`, `inline?` |
| `EmbedMedia` | `url?`, `proxy_url?`, `height?`, `width?` |

### Other Models

| Interface | Description |
|-----------|-------------|
| `Invite` | Guild/channel invite with `code`, `uses`, `max_uses`, `expires_at` |
| `Webhook` | Webhook with `id`, `name`, `channel_id`, `token` |
| `VoiceState` | Voice connection state with `channel_id`, `user_id`, `self_mute`, `self_deaf` |
| `GuildBan` | Ban info with `user`, `reason` |
| `GuildAuditLog` | Audit log entry with `action_type`, `user_id`, `target_id` |
| `Relationship` | Friend/block relationship with `user`, `type` |
| `FavoriteMeme` | Saved meme with `url`, `name` |
| `SavedMessage` | Bookmarked message with `message_id`, `channel_id` |
| `AuthSession` | Active session with `id`, `client_info` |
| `ReadState` | Read position with `channel_id`, `last_message_id`, `mention_count` |

---

## Mutation Payloads

Separate payload types are provided for create/update endpoints where most fields are optional:

| Payload Type | Used By |
|-------------|---------|
| `CreateMessagePayload` | `sendMessage()` |
| `EditMessagePayload` | `editMessage()` |
| `CreateGuildPayload` | `createGuild()` |
| `UpdateGuildPayload` | `updateGuild()` |
| `CreateChannelPayload` | `createGuildChannel()` |
| `UpdateChannelPayload` | `updateChannel()` |
| `BanMemberPayload` | `banMember()` |
| `BulkDeletePayload` | `bulkDeleteMessages()` |
| `CreateInvitePayload` | `createChannelInvite()` |
| `CreateRolePayload` | `createRole()` |
| `UpdateRolePayload` | `updateRole()` |
| `CreateEmojiPayload` | `createEmoji()` |
| `CreateStickerPayload` | `createSticker()` |
| `CreateWebhookPayload` | `createChannelWebhook()` |
| `UpdateWebhookPayload` | `updateWebhook()` |
| `ExecuteWebhookPayload` | `executeWebhook()` |
| `UpdateCurrentUserPayload` | `updateCurrentUser()` |
| `UpdateMemberPayload` | `updateMember()` |
| `SendFriendRequestPayload` | `sendFriendRequest()` |
| `CreateDmPayload` | `createDm()` |
| `GetMessagesOptions` | `getMessages()` |

---

## Enums

All 18+ enum types are exported from `fluxer.js` and defined in `src/types/enums.ts`.

### Status

```ts
enum Status {
  Online = 0,
  Dnd = 1,
  Idle = 2,
  Invisible = 3,
}
```

### ChannelType

```ts
enum ChannelType {
  GuildText = 0,
  Dm = 1,
  GuildVoice = 2,
  GroupDm = 3,
  GuildCategory = 4,
  GuildNews = 5,
  GuildStore = 6,
  NewsThread = 10,
  PublicThread = 11,
  PrivateThread = 12,
  GuildStageVoice = 13,
  GuildDirectory = 14,
  GuildForum = 15,
  GuildMedia = 16,
  GuildLink = 998,        // Fluxer-specific
  DmPersonalNotes = 999,  // Fluxer-specific
}
```

### MessageType

```ts
enum MessageType {
  Default = 0,
  RecipientAdd = 1,
  RecipientRemove = 2,
  Call = 3,
  ChannelNameChange = 4,
  ChannelIconChange = 5,
  ChannelPinnedMessage = 6,
  UserJoin = 7,
  Reply = 19,
}
```

### MessageFlags

```ts
enum MessageFlags {
  None = 0,
  SuppressEmbeds = 1 << 2,
  SuppressNotifications = 1 << 12,
}
```

### Permissions

Permissions are defined as `bigint` constants for bitfield operations:

```ts
import { Permissions, hasPermission } from "fluxer.js";

// Check permissions
const bits = BigInt(member.permissions);
if (hasPermission(bits, Permissions.BanMembers)) {
  // user can ban
}

// Common permissions
Permissions.Administrator       // 1n << 3n
Permissions.ManageChannels      // 1n << 4n
Permissions.ManageGuild         // 1n << 5n
Permissions.BanMembers          // 1n << 2n
Permissions.KickMembers         // 1n << 1n
Permissions.ManageMessages      // 1n << 13n
Permissions.ManageRoles         // 1n << 28n
```

### RelationshipType

```ts
enum RelationshipType {
  Friend = 1,
  Blocked = 2,
  IncomingRequest = 3,
  OutgoingRequest = 4,
}
```

### PremiumType

```ts
enum PremiumType {
  None = 0,
  Subscription = 1,
  Lifetime = 2,
}
```

### Other Enums

| Enum | Values |
|------|--------|
| `InviteType` | Guild, GroupDm |
| `GuildVerificationLevel` | None, Low, Medium, High, VeryHigh |
| `GuildMfaLevel` | None, Elevated |
| `GuildExplicitContentFilterType` | Disabled, MembersWithoutRoles, AllMembers |
| `UserExplicitContentFilterType` | Disabled, NonFriends, FriendsAndNonFriends |
| `NSFWFilterLevelType` | Disabled, NonFriends, FriendsAndNonFriends |
| `StickerFormatType` | Png, Apng, Lottie, Gif |
| `FriendSourceFlags` | None, MutualFriends, MutualGuilds, NoRelation |
| `SystemChannelFlags` | None, SuppressJoinNotifications |

---

## Gateway Event Types

All 52 gateway event payloads are fully typed. See [Gateway Client](Gateway-Client) for the event list.

Key event data types:

| Type | Description |
|------|-------------|
| `ReadyEventData` | READY payload with `user`, `guilds`, `session_id` |
| `MessageEventData` | Message create/update with `id`, `channel_id`, `author`, `content` |
| `EntityRemovedEventData` | Generic deletion with `id`, `channel_id?`, `guild_id?` |
| `GuildEventData` | Full guild object (extends `Guild`) |
| `GuildMemberEventData` | Member event with `guild_id`, `user`, `roles` |
| `PresenceEventData` | Presence update with `user`, `status`, `activities` |
| `TypingEventData` | Typing indicator with `channel_id`, `user_id`, `timestamp` |
| `VoiceStateEventData` | Voice state (extends `VoiceState`) with `member?` |

All event types are available via the `GatewayEvents` interface for use with typed event handlers.

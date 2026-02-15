# API Client

The `ApiClient` class provides typed methods for every Fluxor REST API endpoint. It handles authentication, JSON serialization, rate limiting, request timeouts, and error detection.

---

## Constructor

```ts
import { ApiClient } from "fluxer.js";

const api = new ApiClient(token: string, config?: FluxorConfig);
```

## Request Behavior

- All requests include the `Authorization` header with the configured token (unless explicitly disabled for public endpoints).
- Request bodies are serialized with `JSON.stringify()` and `undefined` values are stripped.
- Each request uses `AbortSignal.timeout()` based on the `requestTimeout` config (default: 15s).
- Non-success status codes throw typed errors: `FluxorRateLimitError` (429), `FluxorNotFoundError` (404), `FluxorForbiddenError` (403), or the base `FluxorApiError`.
- Rate limiting is applied per-route before each request when `enableRateLimiting` is true.

---

## Endpoint Reference

### Auth

| Method | Description |
|--------|-------------|
| `login(data: LoginRequest)` | Authenticate with email and password. |
| `register(data: RegisterPayload)` | Create a new account. |
| `loginMfaTotp(data: MfaTotpPayload)` | Complete MFA login with TOTP code. |
| `loginMfaSms(data: MfaSmsPayload)` | Complete MFA login with SMS code. |
| `sendMfaSmsCode()` | Request an SMS code for MFA. |
| `logout()` | Log out the current session. |
| `verifyEmail(data)` | Verify an email address. |
| `resendVerificationEmail()` | Resend the verification email. |
| `forgotPassword(data)` | Request a password reset email. |
| `resetPassword(data)` | Reset password with a token. |
| `getSessions()` | Get all active sessions. |
| `logoutSessions(data)` | Log out specific sessions. |
| `authorizeIp(data)` | Authorize an IP address. |

### Channels

| Method | Description |
|--------|-------------|
| `getChannel(channelId)` | Get a channel by ID. |
| `updateChannel(channelId, data: UpdateChannelPayload)` | Update a channel. |
| `deleteChannel(channelId)` | Delete a channel. |
| `getChannelRtcRegions(channelId)` | Get available voice regions for a channel. |

### Messages

| Method | Description |
|--------|-------------|
| `getMessages(channelId, options?)` | Get messages with optional pagination (`limit`, `before`, `after`, `around`). |
| `getMessage(channelId, messageId)` | Get a single message. |
| `sendMessage(channelId, message)` | Send a message. Accepts `string` or `CreateMessagePayload`. |
| `editMessage(channelId, messageId, data: EditMessagePayload)` | Edit a message. |
| `deleteMessage(channelId, messageId)` | Delete a message. |
| `bulkDeleteMessages(channelId, data: BulkDeletePayload)` | Bulk delete messages. |
| `getPinnedMessages(channelId)` | Get pinned messages. |
| `pinMessage(channelId, messageId)` | Pin a message. |
| `unpinMessage(channelId, messageId)` | Unpin a message. |
| `triggerTypingIndicator(channelId)` | Show typing indicator. |
| `acknowledgeMessage(channelId, messageId, data)` | Mark a message as read. |

### Reactions

| Method | Description |
|--------|-------------|
| `getReactions(channelId, messageId, emoji)` | Get users who reacted with an emoji. |
| `addReaction(channelId, messageId, emoji)` | Add a reaction. |
| `removeOwnReaction(channelId, messageId, emoji)` | Remove your own reaction. |
| `removeUserReaction(channelId, messageId, emoji, userId)` | Remove another user's reaction. |
| `removeAllReactionsForEmoji(channelId, messageId, emoji)` | Remove all reactions for an emoji. |
| `removeAllReactions(channelId, messageId)` | Remove all reactions from a message. |

### Guilds

| Method | Description |
|--------|-------------|
| `createGuild(data: CreateGuildPayload)` | Create a guild. |
| `getGuild(guildId)` | Get a guild by ID. |
| `updateGuild(guildId, data: UpdateGuildPayload)` | Update guild settings. |
| `deleteGuild(guildId, data: DeleteGuildPayload)` | Delete a guild. |
| `getCurrentUserGuilds()` | Get all guilds for the current user. |
| `leaveGuild(guildId)` | Leave a guild. |
| `getGuildVanityUrl(guildId)` | Get the guild's vanity URL. |
| `updateGuildVanityUrl(guildId, data)` | Update the vanity URL. |

### Members

| Method | Description |
|--------|-------------|
| `getMembers(guildId)` | List all members. |
| `getMember(guildId, userId)` | Get a specific member. |
| `getCurrentMember(guildId)` | Get the bot's own member object. |
| `updateMember(guildId, userId, data: UpdateMemberPayload)` | Update a member. |
| `updateCurrentMember(guildId, data)` | Update the bot's own member. |
| `kickMember(guildId, userId)` | Kick a member. |
| `transferOwnership(guildId, data)` | Transfer guild ownership. |

### Bans

| Method | Description |
|--------|-------------|
| `getBans(guildId)` | List all bans. |
| `banMember(guildId, userId, data: BanMemberPayload)` | Ban a member. |
| `unbanMember(guildId, userId)` | Unban a member. |

### Roles

| Method | Description |
|--------|-------------|
| `createRole(guildId, data: CreateRolePayload)` | Create a role. |
| `updateRole(guildId, roleId, data: UpdateRolePayload)` | Update a role. |
| `updateRoles(guildId, data)` | Bulk update role positions. |
| `deleteRole(guildId, roleId)` | Delete a role. |
| `addMemberRole(guildId, userId, roleId)` | Add a role to a member. |
| `removeMemberRole(guildId, userId, roleId)` | Remove a role from a member. |

### Guild Channels

| Method | Description |
|--------|-------------|
| `getGuildChannels(guildId)` | List guild channels. |
| `createGuildChannel(guildId, data: CreateChannelPayload)` | Create a channel. |
| `updateGuildChannels(guildId, data)` | Bulk update channel positions. |

### Emojis and Stickers

| Method | Description |
|--------|-------------|
| `getEmojis(guildId)` | List guild emojis. |
| `createEmoji(guildId, data: CreateEmojiPayload)` | Create an emoji. |
| `updateEmoji(guildId, emojiId, data: UpdateEmojiPayload)` | Update an emoji. |
| `deleteEmoji(guildId, emojiId)` | Delete an emoji. |
| `getStickers(guildId)` | List guild stickers. |
| `createSticker(guildId, data: CreateStickerPayload)` | Create a sticker. |
| `updateSticker(guildId, stickerId, data: UpdateStickerPayload)` | Update a sticker. |
| `deleteSticker(guildId, stickerId)` | Delete a sticker. |

### Users

| Method | Description |
|--------|-------------|
| `getCurrentUser()` | Get the current user. |
| `updateCurrentUser(data: UpdateCurrentUserPayload)` | Update the current user. |
| `getUser(userId)` | Get a user by ID. |
| `getUserProfile(userId)` | Get a user's profile. |
| `checkUsernameAvailability(tag)` | Check if a username tag is available. |

### Settings

| Method | Description |
|--------|-------------|
| `getCurrentUserSettings()` | Get the current user's settings. |
| `updateCurrentUserSettings(data)` | Update settings. |

### Relationships

| Method | Description |
|--------|-------------|
| `getRelationships()` | Get all relationships. |
| `sendFriendRequest(data: SendFriendRequestPayload)` | Send a friend request. |
| `acceptFriendRequest(userId)` | Accept a friend request. |
| `removeFriend(userId)` | Remove a friend. |
| `blockUser(userId)` | Block a user. |

### Invites

| Method | Description |
|--------|-------------|
| `getInvite(code)` | Get invite info. |
| `joinGuild(code)` | Join a guild via invite. |
| `deleteInvite(code)` | Delete an invite. |
| `getChannelInvites(channelId)` | List channel invites. |
| `createChannelInvite(channelId, data: CreateInvitePayload)` | Create an invite. |
| `getGuildInvites(guildId)` | List guild invites. |

### Webhooks

| Method | Description |
|--------|-------------|
| `getWebhook(webhookId)` | Get a webhook. |
| `updateWebhook(webhookId, data: UpdateWebhookPayload)` | Update a webhook. |
| `deleteWebhook(webhookId)` | Delete a webhook. |
| `executeWebhook(webhookId, token, data: ExecuteWebhookPayload)` | Execute a webhook. |
| `getChannelWebhooks(channelId)` | List channel webhooks. |
| `createChannelWebhook(channelId, data: CreateWebhookPayload)` | Create a webhook. |
| `getGuildWebhooks(guildId)` | List guild webhooks. |

### Message Pagination

```ts
const messages = await api.getMessages(channelId, {
  limit: 50,
  before: "1234567890",  // snowflake ID
  after: "0987654321",
  around: "5555555555",
});
```

### String Shorthand for sendMessage

```ts
// These are equivalent:
await api.sendMessage(channelId, "Hello!");
await api.sendMessage(channelId, { content: "Hello!" });
```

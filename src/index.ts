/**
 * fluxer.js — JavaScript / TypeScript SDK for the Fluxor platform.
 *
 * @example
 * ```ts
 * import { Client } from "fluxer.js";
 *
 * const bot = new Client("Bot your-token-here");
 *
 * bot.on("READY", (data) => {
 *   console.log(`Logged in as ${data.user.username}`);
 * });
 *
 * bot.on("MESSAGE_CREATE", async (msg) => {
 *   if (msg.content === "!ping") {
 *     await bot.send(msg.channel_id, "Pong!");
 *   }
 * });
 *
 * await bot.connect();
 * ```
 */

// ── High-level client ────────────────────────────────────────────────────────
export { Client } from "./client/Client.js";

// ── Low-level clients ────────────────────────────────────────────────────────
export { ApiClient } from "./api/ApiClient.js";
export { GatewayClient } from "./gateway/GatewayClient.js";

// ── Config ───────────────────────────────────────────────────────────────────
export type { FluxorConfig, PresenceData, StatusType } from "./config.js";
export {
  DEFAULT_API_BASE_URL,
  DEFAULT_GATEWAY_URL,
  DEFAULT_REQUEST_TIMEOUT,
  DEFAULT_RECONNECT_DELAY,
  DEFAULT_MAX_RECONNECT_ATTEMPTS,
} from "./config.js";

// ── Errors ───────────────────────────────────────────────────────────────────
export {
  FluxorApiError,
  FluxorRateLimitError,
  FluxorNotFoundError,
  FluxorForbiddenError,
} from "./errors.js";

// ── Gateway internals (for advanced use) ─────────────────────────────────────
export { FluxorOpCode } from "./gateway/opcodes.js";
export { FluxorCloseCode, shouldReconnect } from "./gateway/closeCodes.js";
export type { GatewayPacket, HelloData, IdentifyData, ResumeData } from "./gateway/packets.js";

// ── Enums ────────────────────────────────────────────────────────────────────
export {
  Status,
  ChannelType,
  MessageType,
  MessageReferenceType,
  MessageFlags,
  MessageAttachmentFlags,
  Permissions,
  UserFlags,
  RelationshipType,
  PremiumType,
  InviteType,
  GuildVerificationLevel,
  GuildMfaLevel,
  GuildExplicitContentFilterType,
  UserExplicitContentFilterType,
  NSFWFilterLevelType,
  StickerFormatType,
  FriendSourceFlags,
  SystemChannelFlags,
  ContextType,
  CommandError,
  RunMode,
  hasPermission,
} from "./types/enums.js";
export type { PermissionsBitfield } from "./types/enums.js";

// ── Types: data models ───────────────────────────────────────────────────────
export type {
  User,
  UserSettings,
  Channel,
  ChannelPermissionOverwrite,
  Message,
  MessageRef,
  MessageAck,
  MessageReaction,
  ReactionEmoji,
  Attachment,
  Embed,
  EmbedFooter,
  EmbedMedia,
  EmbedProvider,
  EmbedAuthor,
  EmbedField,
  Guild,
  GuildMember,
  GuildRole,
  GuildEmoji,
  GuildSticker,
  Invite,
  GuildBan,
  GuildAuditLog,
  LoginRequest,
  LoginResponse,
  AuthSession,
  Webhook,
  VoiceState,
  VoiceRegion,
  CallInfo,
  FavoriteMeme,
  GiftCode,
  BetaCode,
  GuildChannelOverride,
  EmailVerificationToken,
  Relationship,
  ReadState,
  UserNote,
  SavedMessage,
  // Mutation payloads
  CreateMessagePayload,
  EditMessagePayload,
  CreateGuildPayload,
  UpdateGuildPayload,
  CreateChannelPayload,
  UpdateChannelPayload,
  BanMemberPayload,
  BulkDeletePayload,
  CreateInvitePayload,
  CreateRolePayload,
  UpdateRolePayload,
  CreateEmojiPayload,
  UpdateEmojiPayload,
  CreateStickerPayload,
  UpdateStickerPayload,
  CreateWebhookPayload,
  UpdateWebhookPayload,
  ExecuteWebhookPayload,
  UpdateCurrentUserPayload,
  UpdateMemberPayload,
  SendFriendRequestPayload,
  CreateDmPayload,
  ReportPayload,
  SearchPayload,
  AuditLogSearchPayload,
  DeleteGuildPayload,
  TransferOwnershipPayload,
  AckBulkPayload,
  GetMessagesOptions,
} from "./types/models.js";

// ── Types: gateway event payloads ────────────────────────────────────────────
export type {
  GatewayEvents,
  ReadyEventData,
  MessageEventData,
  EntityRemovedEventData,
  MessageBulkDeleteEventData,
  MessageAckEventData,
  MessageReactionEventData,
  MessageReactionRemoveEmojiEventData,
  ChannelEventData,
  ChannelUpdateBulkEventData,
  ChannelRecipientEventData,
  ChannelPinsUpdateEventData,
  ChannelPinsAckEventData,
  GuildEventData,
  GuildDeleteEventData,
  GuildMemberEventData,
  GuildBanEventData,
  GuildRoleEventData,
  GuildRoleDeleteEventData,
  GuildRoleUpdateBulkEventData,
  GuildEmojisUpdateEventData,
  GuildStickersUpdateEventData,
  UserEventData,
  UserSettingsUpdateEventData,
  UserGuildSettingsUpdateEventData,
  PresenceEventData,
  TypingEventData,
  VoiceStateEventData,
  VoiceServerUpdateEventData,
  WebhooksUpdateEventData,
  RelationshipEventData,
  FavoriteMemeEventData,
  CallEventData,
  SavedMessageEventData,
  RecentMentionDeleteEventData,
  InviteCreateEventData,
  InviteDeleteEventData,
} from "./types/gateway.js";

// ── Builders ─────────────────────────────────────────────────────────────────
export {
  EmbedBuilder,
  EmbedAuthorBuilder,
  EmbedFooterBuilder,
  EmbedFieldBuilder,
  MaxTitleLength,
  MaxDescriptionLength,
  MaxFieldCount,
  MaxFieldNameLength,
  MaxFieldValueLength,
  MaxFooterTextLength,
  MaxAuthorNameLength,
  MaxEmbedLength,
} from "./builders/EmbedBuilder.js";

// ── Commands ─────────────────────────────────────────────────────────────────
export {
  CommandService,
  CommandContext,
  ModuleBase,
  requireGuild,
  requireOwner,
  requirePermissions,
  StringParser,
  NumberParser,
  IntegerParser,
  BooleanParser,
  BigIntParser,
  defaultTypeParsers,
} from "./commands/index.js";
export type {
  CommandServiceOptions,
} from "./commands/index.js";
export type {
  CommandDefinition,
  CommandResult,
  CommandSearchResult,
  CommandParameter,
  Precondition,
  PreconditionResult,
  TypeParser,
} from "./commands/index.js";

// ── Rate limiting (for advanced/inspection use) ──────────────────────────────
export { RateLimitManager } from "./rateLimit/RateLimitManager.js";
export { RateLimitBucket } from "./rateLimit/RateLimitBucket.js";
export type { RateLimitConfig } from "./rateLimit/RateLimitConfig.js";

// ── Utilities ────────────────────────────────────────────────────────────────
export { validateToken, getGatewayToken } from "./util/token.js";
export { createConsoleLogger, noopLogger, type Logger } from "./util/logger.js";

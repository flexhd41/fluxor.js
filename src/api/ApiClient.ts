/**
 * REST API client for the Fluxor platform.
 *
 * Provides methods for every documented Fluxor API endpoint — auth, channels,
 * guilds, users, invites, webhooks, memes, tenor, reports, and more.
 *
 * Mirrors Fluxer.Net/ApiClient.cs.
 */

import {
  FluxorApiError,
  FluxorRateLimitError,
  FluxorNotFoundError,
  FluxorForbiddenError,
} from "../errors.js";
import { resolveConfig, type FluxorConfig } from "../config.js";
import { validateToken } from "../util/token.js";
import { noopLogger, type Logger } from "../util/logger.js";
import { RateLimitManager, type BucketParams } from "../rateLimit/RateLimitManager.js";
import { RateLimitMappings } from "../rateLimit/RateLimitMappings.js";
import type { RateLimitConfig } from "../rateLimit/RateLimitConfig.js";
import type {
  User,
  Channel,
  Message,
  Guild,
  GuildMember,
  GuildBan,
  GuildRole,
  GuildEmoji,
  GuildSticker,
  Invite,
  Webhook,
  LoginRequest,
  LoginResponse,
  AuthSession,
  MessageAck,
  VoiceRegion,
  CallInfo,
  FavoriteMeme,
  BetaCode,
  UserSettings,
  UserNote,
  SavedMessage,
  GuildAuditLog,
  Embed,
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
  MfaTotpPayload,
  MfaSmsPayload,
  VerifyEmailPayload,
  ForgotPasswordPayload,
  ResetPasswordPayload,
  RegisterPayload,
  AuthorizeIpPayload,
  LogoutSessionsPayload,
  SaveMessagePayload,
  SetNotePayload,
  UpdateCallPayload,
  RingCallPayload,
  CreateMemePayload,
  UpdateMemePayload,
  GetMessagesOptions,
  Relationship,
} from "../types/models.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Remove keys whose value is `undefined` from an object before serialising. */
function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}

/** Build a query string from an options object, ignoring undefined values. */
function toQueryString(params: Record<string, string | number | undefined>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

// ─────────────────────────────────────────────────────────────────────────────
// ApiClient
// ─────────────────────────────────────────────────────────────────────────────

export class ApiClient {
  public readonly token: string;
  public readonly rateLimitManager: RateLimitManager;

  private readonly _baseUrl: string;
  private readonly _log: Logger;
  private readonly _config: ReturnType<typeof resolveConfig>;

  constructor(token: string, config?: FluxorConfig) {
    validateToken(token);
    this.token = token;
    this._config = resolveConfig(config);
    this._baseUrl = this._config.apiBaseUrl;
    this._log = this._config.logger ?? noopLogger;
    this.rateLimitManager = new RateLimitManager(this._config.enableRateLimiting, this._log);

    this._log.info(
      `Initialised Fluxer.js ApiClient (API base ${this._baseUrl}, ` +
        `rate limiting ${this._config.enableRateLimiting ? "enabled" : "disabled"})`,
    );
  }

  // ── Generic request helpers ─────────────────────────────────────────────

  /**
   * Rate-limit aware wait before a request.
   */
  private async _rl(route: string, params: BucketParams = {}): Promise<void> {
    const cfg = (RateLimitMappings as Record<string, RateLimitConfig | undefined>)[route];
    if (!cfg) return;
    const bucket = this.rateLimitManager.getBucket(cfg, params);
    await this.rateLimitManager.waitForRateLimit(bucket);
  }

  /** Build an AbortSignal for the configured request timeout. */
  private _timeoutSignal(): AbortSignal {
    return AbortSignal.timeout(this._config.requestTimeout);
  }

  /**
   * Detect status-code specific errors and throw the appropriate subclass.
   */
  private _throwForStatus(status: number, text: string): never {
    if (status === 429) {
      let retryAfter = 1000;
      try {
        const parsed = JSON.parse(text);
        if (typeof parsed.retry_after === "number") retryAfter = parsed.retry_after * 1000;
      } catch { /* ignore */ }
      throw new FluxorRateLimitError(`Rate limited`, text, retryAfter);
    }
    if (status === 404) throw new FluxorNotFoundError(`Not found`, text);
    if (status === 403) throw new FluxorForbiddenError(`Forbidden`, text);
    throw new FluxorApiError(`Fluxor returned ${status}`, status, text);
  }

  /**
   * Send request with body, return parsed JSON response.
   */
  private async _requestRS<TRes, TSend = unknown>(
    method: string,
    route: string,
    data: TSend,
    throwOnNonSuccess = false,
    authorize = true,
  ): Promise<TRes> {
    const url = this._baseUrl + route;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (authorize) headers["Authorization"] = this.token;

    const body = JSON.stringify(stripUndefined(data as Record<string, unknown>));
    this._log.debug(`${method} ${route}`);

    const res = await fetch(url, { method, headers, body, signal: this._timeoutSignal() });
    const text = await res.text();
    this._log.debug(`${method} ${route} → ${res.status}`);

    if (throwOnNonSuccess && !res.ok) {
      this._throwForStatus(res.status, text);
    }

    return text ? (JSON.parse(text) as TRes) : (undefined as unknown as TRes);
  }

  /**
   * Send request with body, return only status code.
   */
  private async _requestS<TSend = unknown>(
    method: string,
    route: string,
    data: TSend,
    throwOnNonSuccess = false,
    authorize = true,
  ): Promise<number> {
    const url = this._baseUrl + route;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (authorize) headers["Authorization"] = this.token;

    const body = JSON.stringify(stripUndefined(data as Record<string, unknown>));
    this._log.debug(`${method} ${route}`);

    const res = await fetch(url, { method, headers, body, signal: this._timeoutSignal() });

    if (throwOnNonSuccess && !res.ok) {
      const text = await res.text();
      this._throwForStatus(res.status, text);
    }

    return res.status;
  }

  /**
   * No request body, return parsed JSON response.
   */
  private async _requestR<TRes>(
    method: string,
    route: string,
    throwOnNonSuccess = false,
    authorize = true,
  ): Promise<TRes> {
    const url = this._baseUrl + route;
    const headers: Record<string, string> = {};
    if (authorize) headers["Authorization"] = this.token;

    this._log.debug(`${method} ${route}`);
    const res = await fetch(url, { method, headers, signal: this._timeoutSignal() });
    const text = await res.text();
    this._log.debug(`${method} ${route} → ${res.status}`);

    if (throwOnNonSuccess && !res.ok) {
      this._throwForStatus(res.status, text);
    }

    return text ? (JSON.parse(text) as TRes) : (undefined as unknown as TRes);
  }

  /**
   * No request body, no response body — just status code.
   */
  private async _request(
    method: string,
    route: string,
    throwOnNonSuccess = false,
    authorize = true,
  ): Promise<number> {
    const url = this._baseUrl + route;
    const headers: Record<string, string> = {};
    if (authorize) headers["Authorization"] = this.token;

    this._log.debug(`${method} ${route}`);
    const res = await fetch(url, { method, headers, signal: this._timeoutSignal() });

    if (throwOnNonSuccess && !res.ok) {
      const text = await res.text();
      this._throwForStatus(res.status, text);
    }

    return res.status;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Auth API
  // ═══════════════════════════════════════════════════════════════════════════

  async login(data: LoginRequest): Promise<LoginResponse> {
    await this._rl("auth.login");
    return this._requestRS<LoginResponse>("POST", "/auth/login", data);
  }

  async register(data: RegisterPayload): Promise<number> {
    await this._rl("auth.register");
    return this._requestS("POST", "/auth/register", data, true, false);
  }

  async loginMfaTotp(data: MfaTotpPayload): Promise<LoginResponse> {
    await this._rl("auth.login");
    return this._requestRS<LoginResponse>("POST", "/auth/login/mfa/totp", data, true, false);
  }

  async sendMfaSmsCode(): Promise<number> {
    await this._rl("auth.login");
    return this._request("POST", "/auth/login/mfa/sms/send", true, false);
  }

  async loginMfaSms(data: MfaSmsPayload): Promise<LoginResponse> {
    await this._rl("auth.login");
    return this._requestRS<LoginResponse>("POST", "/auth/login/mfa/sms", data, true, false);
  }

  async logout(): Promise<number> {
    await this._rl("auth.logout");
    return this._request("POST", "/auth/logout", true);
  }

  async verifyEmail(data: VerifyEmailPayload): Promise<number> {
    await this._rl("auth.verify");
    return this._requestS("POST", "/auth/verify", data, true, false);
  }

  async resendVerificationEmail(): Promise<number> {
    await this._rl("auth.verify");
    return this._request("POST", "/auth/verify/resend", true);
  }

  async forgotPassword(data: ForgotPasswordPayload): Promise<number> {
    await this._rl("auth.forgot");
    return this._requestS("POST", "/auth/forgot", data, true, false);
  }

  async resetPassword(data: ResetPasswordPayload): Promise<number> {
    await this._rl("auth.reset");
    return this._requestS("POST", "/auth/reset", data, true, false);
  }

  async getSessions(): Promise<AuthSession[]> {
    await this._rl("auth.sessions");
    return this._requestR<AuthSession[]>("GET", "/auth/sessions", true);
  }

  async logoutSessions(data: LogoutSessionsPayload): Promise<number> {
    await this._rl("auth.sessions");
    return this._requestS("POST", "/auth/sessions/logout", data, true);
  }

  async authorizeIp(data: AuthorizeIpPayload): Promise<number> {
    return this._requestS("POST", "/auth/authorize-ip", data, true);
  }

  async webauthnAuthenticationOptions(): Promise<unknown> {
    return this._requestR<unknown>("POST", "/auth/webauthn/authentication-options", true, false);
  }

  async webauthnAuthenticate(data: unknown): Promise<unknown> {
    return this._requestRS<unknown>("POST", "/auth/webauthn/authenticate", data, true, false);
  }

  async loginMfaWebauthnOptions(): Promise<unknown> {
    return this._requestR<unknown>("POST", "/auth/login/mfa/webauthn/authentication-options", true, false);
  }

  async loginMfaWebauthn(data: unknown): Promise<unknown> {
    return this._requestRS<unknown>("POST", "/auth/login/mfa/webauthn", data, true, false);
  }

  async redeemBetaCode(data: { code: string }): Promise<unknown> {
    return this._requestRS<unknown>("POST", "/auth/redeem-beta-code", data, true);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Channels API
  // ═══════════════════════════════════════════════════════════════════════════

  async getChannel(channelId: string): Promise<Channel> {
    await this._rl("channels.get", { channelId });
    return this._requestR<Channel>("GET", `/channels/${channelId}`, true);
  }

  async getChannelRtcRegions(channelId: string): Promise<VoiceRegion[]> {
    await this._rl("channels.rtcRegions", { channelId });
    return this._requestR<VoiceRegion[]>("GET", `/channels/${channelId}/rtc-regions`, true);
  }

  async updateChannel(channelId: string, data: UpdateChannelPayload): Promise<Channel> {
    await this._rl("channels.update", { channelId });
    return this._requestRS<Channel>("PATCH", `/channels/${channelId}`, data, true);
  }

  async deleteChannel(channelId: string): Promise<number> {
    await this._rl("channels.delete", { channelId });
    return this._request("DELETE", `/channels/${channelId}`, true);
  }

  async clearMessageAcknowledgement(channelId: string): Promise<number> {
    return this._request("DELETE", `/channels/${channelId}/messages/ack`, true);
  }

  async getMessages(channelId: string, options?: GetMessagesOptions): Promise<Message[]> {
    await this._rl("channels.messages.list", { channelId });
    const qs = options ? toQueryString(options as Record<string, string | number | undefined>) : "";
    return this._requestR<Message[]>("GET", `/channels/${channelId}/messages${qs}`, true);
  }

  async getMessage(channelId: string, messageId: string): Promise<Message> {
    await this._rl("channels.messages.get", { channelId });
    return this._requestR<Message>("GET", `/channels/${channelId}/messages/${messageId}`, true);
  }

  async searchChannel(channelId: string, data: SearchPayload): Promise<unknown> {
    await this._rl("channels.search", { channelId });
    return this._requestRS<unknown>("POST", `/channels/${channelId}/search`, data, true);
  }

  /**
   * Send a message to a channel.
   * Accepts a `CreateMessagePayload` object or a simple `string` for quick text messages.
   */
  async sendMessage(channelId: string, message: string | CreateMessagePayload): Promise<Message> {
    await this._rl("channels.messages.send", { channelId });
    const payload: CreateMessagePayload = typeof message === "string" ? { content: message } : message;
    return this._requestRS<Message>("POST", `/channels/${channelId}/messages`, payload, true);
  }

  async editMessage(channelId: string, messageId: string, message: EditMessagePayload): Promise<Message> {
    await this._rl("channels.messages.edit", { channelId });
    return this._requestRS<Message>(
      "PATCH",
      `/channels/${channelId}/messages/${messageId}`,
      message,
      true,
    );
  }

  async deleteMessage(channelId: string, messageId: string): Promise<number> {
    await this._rl("channels.messages.delete", { channelId });
    return this._request("DELETE", `/channels/${channelId}/messages/${messageId}`, true);
  }

  async deleteMessageAttachment(channelId: string, messageId: string, attachmentId: string): Promise<number> {
    return this._request(
      "DELETE",
      `/channels/${channelId}/messages/${messageId}/attachments/${attachmentId}`,
      true,
    );
  }

  async bulkDeleteMessages(channelId: string, data: BulkDeletePayload): Promise<number> {
    await this._rl("channels.messages.bulkDelete", { channelId });
    return this._requestS("POST", `/channels/${channelId}/messages/bulk-delete`, data, true);
  }

  async triggerTypingIndicator(channelId: string): Promise<number> {
    await this._rl("channels.typing", { channelId });
    return this._request("POST", `/channels/${channelId}/typing`, true);
  }

  async acknowledgeMessage(channelId: string, messageId: string, details: MessageAck): Promise<number> {
    await this._rl("channels.messages.ack", { channelId });
    return this._requestS(
      "POST",
      `/channels/${channelId}/messages/${messageId}/ack`,
      details,
      true,
    );
  }

  async getPinnedMessages(channelId: string): Promise<Message[]> {
    await this._rl("channels.pins.list", { channelId });
    return this._requestR<Message[]>("GET", `/channels/${channelId}/pins`, true);
  }

  async pinMessage(channelId: string, messageId: string): Promise<number> {
    await this._rl("channels.pins.add", { channelId });
    return this._request("PUT", `/channels/${channelId}/pins/${messageId}`, true);
  }

  async unpinMessage(channelId: string, messageId: string): Promise<number> {
    await this._rl("channels.pins.remove", { channelId });
    return this._request("DELETE", `/channels/${channelId}/pins/${messageId}`, true);
  }

  // ── Reactions ────────────────────────────────────────────────────────

  async getReactions(channelId: string, messageId: string, emoji: string): Promise<User[]> {
    await this._rl("channels.reactions.get", { channelId });
    return this._requestR<User[]>(
      "GET",
      `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
      true,
    );
  }

  async addReaction(channelId: string, messageId: string, emoji: string): Promise<number> {
    await this._rl("channels.reactions.add", { channelId });
    return this._request(
      "PUT",
      `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`,
      true,
    );
  }

  async removeOwnReaction(channelId: string, messageId: string, emoji: string): Promise<number> {
    await this._rl("channels.reactions.remove", { channelId });
    return this._request(
      "DELETE",
      `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`,
      true,
    );
  }

  async removeUserReaction(channelId: string, messageId: string, emoji: string, targetId: string): Promise<number> {
    await this._rl("channels.reactions.remove", { channelId });
    return this._request(
      "DELETE",
      `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/${targetId}`,
      true,
    );
  }

  async removeAllReactionsForEmoji(channelId: string, messageId: string, emoji: string): Promise<number> {
    await this._rl("channels.reactions.removeAll", { channelId });
    return this._request(
      "DELETE",
      `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
      true,
    );
  }

  async removeAllReactions(channelId: string, messageId: string): Promise<number> {
    await this._rl("channels.reactions.removeAll", { channelId });
    return this._request("DELETE", `/channels/${channelId}/messages/${messageId}/reactions`, true);
  }

  // ── Attachments / Recipients / Calls / Invites / Webhooks ───────────

  async uploadAttachments(channelId: string, data: unknown): Promise<unknown> {
    await this._rl("channels.attachments", { channelId });
    return this._requestRS<unknown>("POST", `/channels/${channelId}/attachments`, data, true);
  }

  async addRecipient(channelId: string, userId: string): Promise<number> {
    await this._rl("channels.recipients.add", { channelId });
    return this._request("PUT", `/channels/${channelId}/recipients/${userId}`, true);
  }

  async removeRecipient(channelId: string, userId: string): Promise<number> {
    await this._rl("channels.recipients.remove", { channelId });
    return this._request("DELETE", `/channels/${channelId}/recipients/${userId}`, true);
  }

  async getCall(channelId: string): Promise<CallInfo> {
    await this._rl("channels.call.get", { channelId });
    return this._requestR<CallInfo>("GET", `/channels/${channelId}/call`, true);
  }

  async updateCall(channelId: string, data: UpdateCallPayload): Promise<CallInfo> {
    await this._rl("channels.call.update", { channelId });
    return this._requestRS<CallInfo>("PATCH", `/channels/${channelId}/call`, data, true);
  }

  async ringCall(channelId: string, data: RingCallPayload): Promise<number> {
    await this._rl("channels.call.ring", { channelId });
    return this._requestS("POST", `/channels/${channelId}/call/ring`, data, true);
  }

  async stopRinging(channelId: string): Promise<number> {
    await this._rl("channels.call.stopRinging", { channelId });
    return this._request("POST", `/channels/${channelId}/call/stop-ringing`, true);
  }

  async getChannelInvites(channelId: string): Promise<Invite[]> {
    await this._rl("channels.invites.list", { channelId });
    return this._requestR<Invite[]>("GET", `/channels/${channelId}/invites`, true);
  }

  async createChannelInvite(channelId: string, data: CreateInvitePayload): Promise<Invite> {
    await this._rl("channels.invites.create", { channelId });
    return this._requestRS<Invite>("POST", `/channels/${channelId}/invites`, data, true);
  }

  async getChannelWebhooks(channelId: string): Promise<Webhook[]> {
    await this._rl("channels.webhooks.list", { channelId });
    return this._requestR<Webhook[]>("GET", `/channels/${channelId}/webhooks`, true);
  }

  async createChannelWebhook(channelId: string, data: CreateWebhookPayload): Promise<Webhook> {
    await this._rl("channels.webhooks.create", { channelId });
    return this._requestRS<Webhook>("POST", `/channels/${channelId}/webhooks`, data, true);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Attachments API (standalone)
  // ═══════════════════════════════════════════════════════════════════════════

  async deleteAttachment(uploadFilename: string): Promise<number> {
    await this._rl("attachments.delete");
    return this._request("DELETE", `/attachments/${uploadFilename}`, true);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Memes API
  // ═══════════════════════════════════════════════════════════════════════════

  async getCurrentUserMemes(): Promise<FavoriteMeme[]> {
    await this._rl("users.memes.list");
    return this._requestR<FavoriteMeme[]>("GET", "/users/@me/memes", true);
  }

  async createCurrentUserMeme(data: CreateMemePayload): Promise<FavoriteMeme> {
    await this._rl("users.memes.create");
    return this._requestRS<FavoriteMeme>("POST", "/users/@me/memes", data, true);
  }

  async postChannelMessageMeme(channelId: string, messageId: string, data: unknown): Promise<number> {
    return this._requestS("POST", `/channels/${channelId}/messages/${messageId}/memes`, data, true);
  }

  async getCurrentUserMeme(memeId: string): Promise<FavoriteMeme> {
    await this._rl("users.memes.get");
    return this._requestR<FavoriteMeme>("GET", `/users/@me/memes/${memeId}`, true);
  }

  async updateCurrentUserMeme(memeId: string, data: UpdateMemePayload): Promise<FavoriteMeme> {
    await this._rl("users.memes.update");
    return this._requestRS<FavoriteMeme>("PATCH", `/users/@me/memes/${memeId}`, data, true);
  }

  async deleteCurrentUserMeme(memeId: string): Promise<number> {
    await this._rl("users.memes.delete");
    return this._request("DELETE", `/users/@me/memes/${memeId}`, true);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Invites API
  // ═══════════════════════════════════════════════════════════════════════════

  async getInvite(inviteCode: string): Promise<Invite> {
    await this._rl("invites.get", { inviteCode });
    return this._requestR<Invite>("GET", `/invites/${inviteCode}`, true);
  }

  async joinGuild(inviteCode: string): Promise<Invite> {
    await this._rl("invites.join", { inviteCode });
    return this._requestR<Invite>("POST", `/invites/${inviteCode}`, true);
  }

  async deleteInvite(inviteCode: string): Promise<number> {
    await this._rl("invites.delete", { inviteCode });
    return this._request("DELETE", `/invites/${inviteCode}`, true);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Read States API
  // ═══════════════════════════════════════════════════════════════════════════

  async ackBulk(data: AckBulkPayload): Promise<number> {
    await this._rl("readStates.ackBulk");
    return this._requestS("POST", "/read-states/ack-bulk", data, true);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Reports API
  // ═══════════════════════════════════════════════════════════════════════════

  async reportMessage(data: ReportPayload): Promise<number> {
    await this._rl("reports.message");
    return this._requestS("POST", "/reports/message", data, true);
  }

  async reportUser(data: ReportPayload): Promise<number> {
    await this._rl("reports.user");
    return this._requestS("POST", "/reports/user", data, true);
  }

  async reportGuild(data: ReportPayload): Promise<number> {
    await this._rl("reports.guild");
    return this._requestS("POST", "/reports/guild", data, true);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Guilds API
  // ═══════════════════════════════════════════════════════════════════════════

  async createGuild(data: CreateGuildPayload): Promise<Guild> {
    await this._rl("guilds.create");
    return this._requestRS<Guild>("POST", "/guilds", data, true);
  }

  async getCurrentUserGuilds(): Promise<Guild[]> {
    await this._rl("users.guilds.list");
    return this._requestR<Guild[]>("GET", "/users/@me/guilds", true);
  }

  async leaveGuild(guildId: string): Promise<number> {
    await this._rl("guilds.leave", { guildId });
    return this._request("DELETE", `/users/@me/guilds/${guildId}`, true);
  }

  async getGuild(guildId: string): Promise<Guild> {
    await this._rl("guilds.get", { guildId });
    return this._requestR<Guild>("GET", `/guilds/${guildId}`, true);
  }

  async updateGuild(guildId: string, data: UpdateGuildPayload): Promise<Guild> {
    await this._rl("guilds.update", { guildId });
    return this._requestRS<Guild>("PATCH", `/guilds/${guildId}`, data, true);
  }

  async deleteGuild(guildId: string, data: DeleteGuildPayload): Promise<number> {
    await this._rl("guilds.delete", { guildId });
    return this._requestS("POST", `/guilds/${guildId}/delete`, data, true);
  }

  async getGuildVanityUrl(guildId: string): Promise<{ code: string | null }> {
    await this._rl("guilds.vanityUrl.get", { guildId });
    return this._requestR<{ code: string | null }>("GET", `/guilds/${guildId}/vanity-url`, true);
  }

  async updateGuildVanityUrl(guildId: string, data: { code: string }): Promise<{ code: string }> {
    await this._rl("guilds.vanityUrl.update", { guildId });
    return this._requestRS<{ code: string }>("PATCH", `/guilds/${guildId}/vanity-url`, data, true);
  }

  // ── Members ─────────────────────────────────────────────────────────

  async getMembers(guildId: string): Promise<GuildMember[]> {
    await this._rl("guilds.members.list", { guildId });
    return this._requestR<GuildMember[]>("GET", `/guilds/${guildId}/members`, true);
  }

  async getCurrentMember(guildId: string): Promise<GuildMember> {
    await this._rl("guilds.members.getCurrent", { guildId });
    return this._requestR<GuildMember>("GET", `/guilds/${guildId}/members/@me`, true);
  }

  async getMember(guildId: string, userId: string): Promise<GuildMember> {
    await this._rl("guilds.members.get", { guildId });
    return this._requestR<GuildMember>("GET", `/guilds/${guildId}/members/${userId}`, true);
  }

  async updateCurrentMember(guildId: string, member: UpdateMemberPayload): Promise<GuildMember> {
    await this._rl("guilds.members.updateCurrent", { guildId });
    return this._requestRS<GuildMember>("PATCH", `/guilds/${guildId}/members/@me`, member, true);
  }

  async updateMember(guildId: string, userId: string, member: UpdateMemberPayload): Promise<GuildMember> {
    await this._rl("guilds.members.update", { guildId });
    return this._requestRS<GuildMember>("PATCH", `/guilds/${guildId}/members/${userId}`, member, true);
  }

  async kickMember(guildId: string, userId: string): Promise<number> {
    await this._rl("guilds.members.kick", { guildId });
    return this._request("DELETE", `/guilds/${guildId}/members/${userId}`, true);
  }

  async transferOwnership(guildId: string, data: TransferOwnershipPayload): Promise<number> {
    await this._rl("guilds.transferOwnership", { guildId });
    return this._requestS("POST", `/guilds/${guildId}/transfer-ownership`, data, true);
  }

  // ── Bans ────────────────────────────────────────────────────────────

  async getBans(guildId: string): Promise<GuildBan[]> {
    await this._rl("guilds.bans.list", { guildId });
    return this._requestR<GuildBan[]>("GET", `/guilds/${guildId}/bans`, true);
  }

  async banMember(guildId: string, userId: string, data: BanMemberPayload): Promise<number> {
    await this._rl("guilds.bans.add", { guildId });
    return this._requestS("PUT", `/guilds/${guildId}/bans/${userId}`, data, true);
  }

  async unbanMember(guildId: string, userId: string): Promise<number> {
    await this._rl("guilds.bans.remove", { guildId });
    return this._request("DELETE", `/guilds/${guildId}/bans/${userId}`, true);
  }

  // ── Roles ───────────────────────────────────────────────────────────

  async addMemberRole(guildId: string, userId: string, roleId: string): Promise<number> {
    await this._rl("guilds.members.roles.add", { guildId });
    return this._request("PUT", `/guilds/${guildId}/members/${userId}/roles/${roleId}`, true);
  }

  async removeMemberRole(guildId: string, userId: string, roleId: string): Promise<number> {
    await this._rl("guilds.members.roles.remove", { guildId });
    return this._request("DELETE", `/guilds/${guildId}/members/${userId}/roles/${roleId}`, true);
  }

  async createRole(guildId: string, data: CreateRolePayload): Promise<GuildRole> {
    await this._rl("guilds.roles.create", { guildId });
    return this._requestRS<GuildRole>("POST", `/guilds/${guildId}/roles`, data, true);
  }

  async updateRole(guildId: string, roleId: string, data: UpdateRolePayload): Promise<GuildRole> {
    await this._rl("guilds.roles.update", { guildId });
    return this._requestRS<GuildRole>("PATCH", `/guilds/${guildId}/roles/${roleId}`, data, true);
  }

  async updateRoles(guildId: string, data: Partial<GuildRole>[]): Promise<GuildRole[]> {
    await this._rl("guilds.roles.updateBulk", { guildId });
    return this._requestRS<GuildRole[]>("PATCH", `/guilds/${guildId}/roles`, data, true);
  }

  async deleteRole(guildId: string, roleId: string): Promise<number> {
    await this._rl("guilds.roles.delete", { guildId });
    return this._request("DELETE", `/guilds/${guildId}/roles/${roleId}`, true);
  }

  // ── Channels ────────────────────────────────────────────────────────

  async getGuildChannels(guildId: string): Promise<Channel[]> {
    await this._rl("guilds.channels.list", { guildId });
    return this._requestR<Channel[]>("GET", `/guilds/${guildId}/channels`, true);
  }

  async createGuildChannel(guildId: string, data: CreateChannelPayload): Promise<Channel> {
    await this._rl("guilds.channels.create", { guildId });
    return this._requestRS<Channel>("POST", `/guilds/${guildId}/channels`, data, true);
  }

  async updateGuildChannels(guildId: string, data: Partial<Channel>[]): Promise<Channel[]> {
    await this._rl("guilds.channels.update", { guildId });
    return this._requestRS<Channel[]>("PATCH", `/guilds/${guildId}/channels`, data, true);
  }

  // ── Search / Audit Logs ─────────────────────────────────────────────

  async searchGuild(guildId: string, data: SearchPayload): Promise<unknown> {
    await this._rl("guilds.search", { guildId });
    return this._requestRS<unknown>("POST", `/guilds/${guildId}/search`, data, true);
  }

  async getGuildAuditLogFilters(guildId: string): Promise<unknown> {
    await this._rl("guilds.auditLogs.filters", { guildId });
    return this._requestR<unknown>("GET", `/guilds/${guildId}/audit-logs/filters`, true);
  }

  async searchAuditLog(guildId: string, data: AuditLogSearchPayload): Promise<GuildAuditLog[]> {
    await this._rl("guilds.auditLogs.search", { guildId });
    return this._requestRS<GuildAuditLog[]>("POST", `/guilds/${guildId}/audit-logs/search`, data, true);
  }

  // ── Emojis ──────────────────────────────────────────────────────────

  async getEmojis(guildId: string): Promise<GuildEmoji[]> {
    await this._rl("guilds.emojis.list", { guildId });
    return this._requestR<GuildEmoji[]>("GET", `/guilds/${guildId}/emojis`, true);
  }

  async createEmoji(guildId: string, data: CreateEmojiPayload): Promise<GuildEmoji> {
    await this._rl("guilds.emojis.create", { guildId });
    return this._requestRS<GuildEmoji>("POST", `/guilds/${guildId}/emojis`, data, true);
  }

  async createEmojiBulk(guildId: string, data: CreateEmojiPayload[]): Promise<GuildEmoji[]> {
    await this._rl("guilds.emojis.createBulk", { guildId });
    return this._requestRS<GuildEmoji[]>("POST", `/guilds/${guildId}/emojis/bulk`, data, true);
  }

  async updateEmoji(guildId: string, emojiId: string, data: UpdateEmojiPayload): Promise<GuildEmoji> {
    await this._rl("guilds.emojis.update", { guildId });
    return this._requestRS<GuildEmoji>("PATCH", `/guilds/${guildId}/emojis/${emojiId}`, data, true);
  }

  async deleteEmoji(guildId: string, emojiId: string): Promise<number> {
    await this._rl("guilds.emojis.delete", { guildId });
    return this._request("DELETE", `/guilds/${guildId}/emojis/${emojiId}`, true);
  }

  // ── Stickers ────────────────────────────────────────────────────────

  async getStickers(guildId: string): Promise<GuildSticker[]> {
    await this._rl("guilds.stickers.list", { guildId });
    return this._requestR<GuildSticker[]>("GET", `/guilds/${guildId}/stickers`, true);
  }

  async createSticker(guildId: string, data: CreateStickerPayload): Promise<GuildSticker> {
    await this._rl("guilds.stickers.create", { guildId });
    return this._requestRS<GuildSticker>("POST", `/guilds/${guildId}/stickers`, data, true);
  }

  async createStickerBulk(guildId: string, data: CreateStickerPayload[]): Promise<GuildSticker[]> {
    await this._rl("guilds.stickers.createBulk", { guildId });
    return this._requestRS<GuildSticker[]>("POST", `/guilds/${guildId}/stickers/bulk`, data, true);
  }

  async updateSticker(guildId: string, stickerId: string, data: UpdateStickerPayload): Promise<GuildSticker> {
    await this._rl("guilds.stickers.update", { guildId });
    return this._requestRS<GuildSticker>("PATCH", `/guilds/${guildId}/stickers/${stickerId}`, data, true);
  }

  async deleteSticker(guildId: string, stickerId: string): Promise<number> {
    await this._rl("guilds.stickers.delete", { guildId });
    return this._request("DELETE", `/guilds/${guildId}/stickers/${stickerId}`, true);
  }

  // ── Guild Invites / Webhooks ────────────────────────────────────────

  async getGuildInvites(guildId: string): Promise<Invite[]> {
    await this._rl("guilds.invites.list", { guildId });
    return this._requestR<Invite[]>("GET", `/guilds/${guildId}/invites`, true);
  }

  async getGuildWebhooks(guildId: string): Promise<Webhook[]> {
    await this._rl("guilds.webhooks.list", { guildId });
    return this._requestR<Webhook[]>("GET", `/guilds/${guildId}/webhooks`, true);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Tenor API
  // ═══════════════════════════════════════════════════════════════════════════

  async tenorSearch(query: string): Promise<unknown> {
    await this._rl("tenor.search");
    return this._requestR<unknown>("GET", `/tenor/search?q=${encodeURIComponent(query)}`, true);
  }

  async tenorFeatured(): Promise<unknown> {
    await this._rl("tenor.featured");
    return this._requestR<unknown>("GET", "/tenor/featured", true);
  }

  async tenorTrendingGifs(): Promise<unknown> {
    await this._rl("tenor.trending");
    return this._requestR<unknown>("GET", "/tenor/trending-gifs", true);
  }

  async tenorRegisterShare(data: unknown): Promise<number> {
    await this._rl("tenor.registerShare");
    return this._requestS("POST", "/tenor/register-share", data, true);
  }

  async tenorSuggest(query: string): Promise<unknown> {
    await this._rl("tenor.suggest");
    return this._requestR<unknown>("GET", `/tenor/suggest?q=${encodeURIComponent(query)}`, true);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Users API
  // ═══════════════════════════════════════════════════════════════════════════

  async getCurrentUser(): Promise<User> {
    await this._rl("users.getCurrent");
    return this._requestR<User>("GET", "/users/@me", true);
  }

  async updateCurrentUser(data: UpdateCurrentUserPayload): Promise<User> {
    await this._rl("users.updateCurrent");
    return this._requestRS<User>("PATCH", "/users/@me", data, true);
  }

  async checkUsernameAvailability(tag: string): Promise<{ available: boolean }> {
    await this._rl("users.checkTag");
    return this._requestR<{ available: boolean }>("GET", `/users/check-tag?tag=${encodeURIComponent(tag)}`, true);
  }

  async getUser(userId: string): Promise<User> {
    await this._rl("users.get", { userId });
    return this._requestR<User>("GET", `/users/${userId}`, true);
  }

  async getUserProfile(targetId: string): Promise<unknown> {
    await this._rl("users.profile", { userId: targetId });
    return this._requestR<unknown>("GET", `/users/${targetId}/profile`, true);
  }

  async getCurrentUserSettings(): Promise<UserSettings> {
    await this._rl("users.settings.get");
    return this._requestR<UserSettings>("GET", "/users/@me/settings", true);
  }

  async updateCurrentUserSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
    await this._rl("users.settings.update");
    return this._requestRS<UserSettings>("PATCH", "/users/@me/settings", settings, true);
  }

  async getCurrentUserNotes(): Promise<UserNote[]> {
    await this._rl("users.notes.list");
    return this._requestR<UserNote[]>("GET", "/users/@me/notes", true);
  }

  async getCurrentUserNote(targetId: string): Promise<UserNote> {
    await this._rl("users.notes.get");
    return this._requestR<UserNote>("GET", `/users/@me/notes/${targetId}`, true);
  }

  async setCurrentUserNote(targetId: string, data: SetNotePayload): Promise<UserNote> {
    await this._rl("users.notes.set");
    return this._requestRS<UserNote>("PUT", `/users/@me/notes/${targetId}`, data, true);
  }

  async getCurrentUserBetaCodes(): Promise<BetaCode[]> {
    await this._rl("users.betaCodes.list");
    return this._requestR<BetaCode[]>("GET", "/users/@me/beta-codes", true);
  }

  async createBetaCode(data: { count?: number }): Promise<BetaCode[]> {
    await this._rl("users.betaCodes.create");
    return this._requestRS<BetaCode[]>("POST", "/users/@me/beta-codes", data, true);
  }

  async deleteBetaCode(code: string): Promise<number> {
    await this._rl("users.betaCodes.delete");
    return this._request("DELETE", `/users/@me/beta-codes/${code}`, true);
  }

  async getCurrentUserMentions(): Promise<Message[]> {
    await this._rl("users.mentions.list");
    return this._requestR<Message[]>("GET", "/users/@me/mentions", true);
  }

  async deleteCurrentUserMention(messageId: string): Promise<number> {
    await this._rl("users.mentions.delete");
    return this._request("DELETE", `/users/@me/mentions/${messageId}`, true);
  }

  // ── MFA ─────────────────────────────────────────────────────────────

  async enableMfaTotp(data: MfaTotpPayload): Promise<unknown> {
    return this._requestRS<unknown>("POST", "/users/@me/mfa/totp/enable", data, true);
  }

  async disableMfaTotp(data: MfaTotpPayload): Promise<number> {
    return this._requestS("POST", "/users/@me/mfa/totp/disable", data, true);
  }

  async enableMfaSms(data: MfaSmsPayload): Promise<unknown> {
    return this._requestRS<unknown>("POST", "/users/@me/mfa/sms/enable", data, true);
  }

  async disableMfaSms(data: MfaSmsPayload): Promise<number> {
    return this._requestS("POST", "/users/@me/mfa/sms/disable", data, true);
  }

  async getMfaBackupCodes(data: { password: string }): Promise<{ codes: string[] }> {
    return this._requestRS<{ codes: string[] }>("POST", "/users/@me/mfa/codes", data, true);
  }

  // ── Webauthn ────────────────────────────────────────────────────────

  async getWebauthnCredentials(): Promise<unknown> {
    return this._requestR<unknown>("GET", "/users/@me/mfa/webauthn/credentials", true);
  }

  async createWebauthnRegistrationOptions(data: unknown): Promise<unknown> {
    return this._requestRS<unknown>("POST", "/users/@me/mfa/webauthn/registration-options", data, true);
  }

  async createWebauthnCredential(data: unknown): Promise<unknown> {
    return this._requestRS<unknown>("POST", "/users/@me/mfa/webauthn/credentials", data, true);
  }

  async updateWebauthnCredential(credentialId: string, data: unknown): Promise<unknown> {
    return this._requestRS<unknown>("PATCH", `/users/@me/mfa/webauthn/credentials/${credentialId}`, data, true);
  }

  async deleteWebauthnCredential(credentialId: string, data: unknown): Promise<number> {
    return this._requestS("POST", `/users/@me/mfa/webauthn/credentials/${credentialId}/delete`, data, true);
  }

  // ── Relationships ───────────────────────────────────────────────────

  async getRelationships(): Promise<Relationship[]> {
    return this._requestR<Relationship[]>("GET", "/users/@me/relationships", true);
  }

  async sendFriendRequest(data: SendFriendRequestPayload): Promise<number> {
    return this._requestS("POST", "/users/@me/relationships", data, true);
  }

  async acceptFriendRequest(userId: string): Promise<number> {
    return this._request("PUT", `/users/@me/relationships/${userId}`, true);
  }

  async removeFriend(userId: string): Promise<number> {
    return this._request("DELETE", `/users/@me/relationships/${userId}`, true);
  }

  async blockUser(userId: string): Promise<number> {
    return this._requestS("PUT", `/users/@me/relationships/${userId}`, { type: 2 }, true);
  }

  // ── DM Channels ─────────────────────────────────────────────────────

  async getDmChannels(): Promise<Channel[]> {
    return this._requestR<Channel[]>("GET", "/users/@me/channels", true);
  }

  async createDm(data: CreateDmPayload): Promise<Channel> {
    return this._requestRS<Channel>("POST", "/users/@me/channels", data, true);
  }

  // ── Saved Messages ──────────────────────────────────────────────────

  async getSavedMessages(): Promise<SavedMessage[]> {
    return this._requestR<SavedMessage[]>("GET", "/users/@me/saved-messages", true);
  }

  async saveMessage(data: SaveMessagePayload): Promise<SavedMessage> {
    return this._requestRS<SavedMessage>("POST", "/users/@me/saved-messages", data, true);
  }

  async deleteSavedMessage(savedMessageId: string): Promise<number> {
    return this._request("DELETE", `/users/@me/saved-messages/${savedMessageId}`, true);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Webhooks API (standalone — by webhook ID)
  // ═══════════════════════════════════════════════════════════════════════════

  async getWebhook(webhookId: string): Promise<Webhook> {
    await this._rl("webhooks.get", { webhookId });
    return this._requestR<Webhook>("GET", `/webhooks/${webhookId}`, true);
  }

  async updateWebhook(webhookId: string, data: UpdateWebhookPayload): Promise<Webhook> {
    await this._rl("webhooks.update", { webhookId });
    return this._requestRS<Webhook>("PATCH", `/webhooks/${webhookId}`, data, true);
  }

  async deleteWebhook(webhookId: string): Promise<number> {
    await this._rl("webhooks.delete", { webhookId });
    return this._request("DELETE", `/webhooks/${webhookId}`, true);
  }

  async executeWebhook(webhookId: string, webhookToken: string, data: ExecuteWebhookPayload): Promise<unknown> {
    await this._rl("webhooks.execute", { webhookId });
    return this._requestRS<unknown>("POST", `/webhooks/${webhookId}/${webhookToken}`, data, true, false);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Gift Codes API
  // ═══════════════════════════════════════════════════════════════════════════

  async getGiftCode(code: string): Promise<unknown> {
    return this._requestR<unknown>("GET", `/gift-codes/${code}`, true);
  }

  async redeemGiftCode(code: string): Promise<unknown> {
    return this._requestR<unknown>("POST", `/gift-codes/${code}/redeem`, true);
  }
}

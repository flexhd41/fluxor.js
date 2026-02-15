/**
 * WebSocket gateway client for real-time events from the Fluxor platform.
 *
 * Handles bidirectional communication, automatic heartbeats, reconnection
 * with exponential backoff, and session resume capability.
 *
 * Mirrors Fluxer.Net/GatewayClient.cs.
 */

import WebSocket from "ws";
import { EventEmitter } from "node:events";
import { FluxorOpCode } from "./opcodes.js";
import { FluxorCloseCode, shouldReconnect as shouldReconnectForCode } from "./closeCodes.js";
import type { GatewayPacket, HelloData, IdentifyData, ResumeData } from "./packets.js";
import type { FluxorConfig } from "../config.js";
import { resolveConfig } from "../config.js";
import { validateToken, getGatewayToken } from "../util/token.js";
import { noopLogger, type Logger } from "../util/logger.js";
import type { GatewayEvents } from "../types/gateway.js";

// ─────────────────────────────────────────────────────────────────────────────
// Typed event emitter helper
// ─────────────────────────────────────────────────────────────────────────────

type EventMap = GatewayEvents & {
  /** Raw dispatch — fired for every event regardless of name. */
  raw: { event: string; data: unknown };
  /** Fired when the gateway WS closes (intentionally or not). */
  close: { code: number; reason: string };
  /** Fired on unrecoverable errors. */
  error: Error;
  /** Debug-level log lines. */
  debug: string;
  /** Heartbeat ACK with round-trip latency in ms. */
  HEARTBEAT_ACK: number;
};

type Listener<T> = (payload: T) => void;

// ─────────────────────────────────────────────────────────────────────────────
// GatewayClient
// ─────────────────────────────────────────────────────────────────────────────

export class GatewayClient {
  public readonly token: string;

  private readonly _config: ReturnType<typeof resolveConfig>;
  private readonly _log: Logger;
  private readonly _emitter = new EventEmitter();

  private _ws: WebSocket | null = null;
  private _sequence = 0;
  private _sessionId = "";
  private _heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private _heartbeatAcked = true;
  private _heartbeatSentAt = 0;
  private _lastPing = -1;
  private _reconnectAttempts = 0;
  private _isConnecting = false;
  private _isReconnecting = false;
  private _destroyed = false;

  constructor(token: string, config?: FluxorConfig) {
    validateToken(token);
    this.token = token;
    this._config = resolveConfig(config);
    this._log = this._config.logger ?? noopLogger;

    // Prevent Node from crashing on unhandled 'error' events.
    // Users can still add their own listener via .on("error", ...).
    this._emitter.on("error", () => {});

    this._log.info(
      `Initialised Fluxer.js GatewayClient (gateway ${this._config.gatewayUrl})`,
    );
  }

  // ── Public getters ─────────────────────────────────────────────────────

  /** Last measured heartbeat round-trip latency in ms, or -1 if not yet measured. */
  get ping(): number {
    return this._lastPing;
  }

  // ── Public event helpers ────────────────────────────────────────────────

  /** Subscribe to a typed gateway event. */
  on<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): this {
    this._emitter.on(event as string, listener);
    return this;
  }

  /** Subscribe once to a typed gateway event. */
  once<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): this {
    this._emitter.once(event as string, listener);
    return this;
  }

  /** Unsubscribe from a typed gateway event. */
  off<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): this {
    this._emitter.off(event as string, listener);
    return this;
  }

  /**
   * Wait for a specific gateway event, optionally with a filter and timeout.
   *
   * ```ts
   * const msg = await gateway.waitFor("MESSAGE_CREATE", {
   *   filter: (m) => m.channel_id === "123",
   *   timeout: 30_000,
   * });
   * ```
   */
  waitFor<K extends keyof GatewayEvents>(
    event: K,
    options?: { filter?: (data: GatewayEvents[K]) => boolean; timeout?: number },
  ): Promise<GatewayEvents[K]> {
    return new Promise<GatewayEvents[K]>((resolve, reject) => {
      const filter = options?.filter;
      const timeout = options?.timeout;

      let timer: ReturnType<typeof setTimeout> | undefined;

      const handler = (data: GatewayEvents[K]) => {
        if (filter && !filter(data)) return;
        cleanup();
        resolve(data);
      };

      const cleanup = () => {
        this._emitter.off(event as string, handler);
        if (timer) clearTimeout(timer);
      };

      this._emitter.on(event as string, handler);

      if (timeout !== undefined && timeout > 0) {
        timer = setTimeout(() => {
          cleanup();
          reject(new Error(`waitFor("${event as string}") timed out after ${timeout}ms`));
        }, timeout);
      }
    });
  }

  // ── Connection lifecycle ────────────────────────────────────────────────

  /**
   * Open a WebSocket connection, authenticate, and start receiving events.
   * Resolves once READY or RESUMED is received.
   */
  async connect(): Promise<void> {
    if (this._isConnecting) {
      this._log.warn("Connection attempt already in progress — skipping.");
      return;
    }
    this._isConnecting = true;
    this._destroyed = false;

    try {
      this._cleanup();

      await new Promise<void>((resolve, _reject) => {
        const url = this._config.gatewayUrl;
        this._log.info(`Connecting to gateway ${url} ...`);
        this._ws = new WebSocket(url);

        // Track whether the promise has already settled so we don't
        // call resolve/reject twice.
        let settled = false;
        const settle = (fn: () => void) => {
          if (!settled) {
            settled = true;
            fn();
          }
        };

        this._ws.on("open", () => {
          this._log.info("WebSocket connected.");
          // IDENTIFY is sent after we receive HELLO.
        });

        this._ws.on("message", (raw: WebSocket.Data) => {
          try {
            this._handleMessage(raw.toString(), () => settle(resolve));
          } catch (err) {
            this._log.error("Error in gateway message handler", err);
          }
        });

        this._ws.on("close", (code: number, reason: Buffer) => {
          const reasonStr = reason.toString();
          this._log.warn(`WebSocket closed: code=${code} reason="${reasonStr}"`);
          this._stopHeartbeat();
          this._isConnecting = false;
          this._emitter.emit("close", { code, reason: reasonStr });

          // ── Close code session cleanup (4004/4007/4009) ────────
          this._handleCloseCode(code);

          // Resolve the connect promise so the caller isn't left hanging.
          settle(resolve);

          if (!this._destroyed && shouldReconnectForCode(code)) {
            this._scheduleReconnect();
          } else if (!shouldReconnectForCode(code)) {
            this._log.error(`Non-recoverable close code ${code}. Not reconnecting.`);
          }
        });

        this._ws.on("error", (err: Error) => {
          this._log.error("WebSocket error", err);
          this._emitter.emit("error", err);
          // Don't reject — the close handler fires right after and
          // will resolve the promise + schedule a reconnect.
        });
      });
    } finally {
      this._isConnecting = false;
    }
  }

  /** Gracefully close the connection. Does **not** attempt to reconnect. */
  destroy(): void {
    this._destroyed = true;
    this._cleanup();
    this._log.info("Gateway client destroyed.");
  }

  // ── Purpose-built public gateway methods ──────────────────────────────

  /** Update the client's presence on the gateway. */
  updatePresence(presence: FluxorConfig["presence"]): void {
    this._send({
      op: FluxorOpCode.PresenceUpdate,
      d: presence,
    });
  }

  /** Request guild member data from the gateway. */
  requestGuildMembers(guildId: string, query = "", limit = 0): void {
    this._send({
      op: FluxorOpCode.RequestGuildMembers,
      d: { guild_id: guildId, query, limit },
    });
  }

  /** Update the bot's voice state (join / leave / move voice channels). */
  updateVoiceState(guildId: string, channelId: string | null, selfMute = false, selfDeaf = false): void {
    this._send({
      op: FluxorOpCode.VoiceStateUpdate,
      d: {
        guild_id: guildId,
        channel_id: channelId,
        self_mute: selfMute,
        self_deaf: selfDeaf,
      },
    });
  }

  /** Connect to / leave a DM call. */
  connectCall(channelId: string): void {
    this._send({
      op: FluxorOpCode.CallConnect,
      d: { channel_id: channelId },
    });
  }

  /** Subscribe to guild events. */
  subscribeGuild(guildId: string): void {
    this._send({
      op: FluxorOpCode.GuildSubscriptions,
      d: { guild_id: guildId },
    });
  }

  // ── Internal: send helper (restricted visibility) ─────────────────────

  private _send<T>(data: T): void {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
      this._log.warn("Cannot send — WebSocket not open.");
      return;
    }
    const json = JSON.stringify(data);
    this._log.debug(`Sending gateway packet: ${json}`);
    this._ws.send(json);
  }

  // ── Internal: message handling ──────────────────────────────────────────

  private _handleMessage(raw: string, onReady?: () => void): void {
    this._log.debug(`Gateway ← ${raw.length > 400 ? raw.slice(0, 400) + "…" : raw}`);

    let packet: GatewayPacket;
    try {
      packet = JSON.parse(raw);
    } catch {
      this._log.warn("Failed to parse gateway message.");
      return;
    }

    // Track sequence
    if (packet.s !== null && packet.s !== undefined) {
      this._sequence = packet.s;
    }

    switch (packet.op) {
      case FluxorOpCode.Hello:
        this._handleHello(packet.d as HelloData);
        break;

      case FluxorOpCode.HeartbeatAck: {
        this._heartbeatAcked = true;
        const latency = this._heartbeatSentAt > 0 ? Date.now() - this._heartbeatSentAt : -1;
        this._lastPing = latency;
        this._log.debug(`Heartbeat ACK received. Latency: ${latency}ms`);
        this._emitter.emit("HEARTBEAT_ACK", latency);
        break;
      }

      case FluxorOpCode.Heartbeat:
        // Server requested an immediate heartbeat.
        this._sendHeartbeat();
        break;

      case FluxorOpCode.InvalidSession: {
        const resumable = packet.d as boolean;
        this._log.warn(`InvalidSession (resumable=${resumable})`);
        if (!resumable) {
          this._sessionId = "";
          this._sequence = 0;
        }
        this._cleanup();
        this._scheduleReconnect();
        break;
      }

      case FluxorOpCode.Reconnect:
        this._log.warn("Server requested reconnect.");
        this._cleanup();
        this._scheduleReconnect();
        break;

      case FluxorOpCode.Dispatch:
        this._handleDispatch(packet, onReady);
        break;

      default:
        this._log.debug(`Unhandled opcode ${packet.op}`);
    }
  }

  // ── Close code session cleanup ────────────────────────────────────────

  private _handleCloseCode(code: number): void {
    switch (code) {
      case FluxorCloseCode.AuthenticationFailed:
      case FluxorCloseCode.InvalidSequence:
      case FluxorCloseCode.SessionTimedOut:
        // These codes mean the session is dead — clear state so the next
        // connection does a fresh IDENTIFY instead of trying to RESUME.
        this._log.info(`Close code ${code}: clearing session state for fresh IDENTIFY.`);
        this._sessionId = "";
        this._sequence = 0;
        break;
    }
  }

  // ── HELLO → IDENTIFY / RESUME ──────────────────────────────────────────

  private _handleHello(data: HelloData): void {
    const interval = data.heartbeat_interval;
    this._log.info(`HELLO received — heartbeat interval ${interval}ms`);
    this._startHeartbeat(interval);

    if (this._sessionId) {
      this._log.info(`Resuming session ${this._sessionId} at seq ${this._sequence}`);
      this._sendResume();
    } else {
      this._log.info("Sending IDENTIFY");
      this._sendIdentify();
    }
  }

  private _sendIdentify(): void {
    const payload: GatewayPacket<IdentifyData> = {
      op: FluxorOpCode.Identify,
      d: {
        token: getGatewayToken(this.token),
        properties: {
          os: process.platform,
          browser: "fluxer.js",
          device: "fluxer.js",
        },
        presence: this._config.presence,
        ignored_gateway_events: this._config.ignoredGatewayEvents,
      },
      s: null,
      t: null,
    };
    this._send(payload);
  }

  private _sendResume(): void {
    const payload: GatewayPacket<ResumeData> = {
      op: FluxorOpCode.Resume,
      d: {
        token: getGatewayToken(this.token),
        session_id: this._sessionId,
        seq: this._sequence,
      },
      s: null,
      t: null,
    };
    this._send(payload);
  }

  // ── Heartbeat ──────────────────────────────────────────────────────────

  private _startHeartbeat(intervalMs: number): void {
    this._stopHeartbeat();
    this._heartbeatAcked = true;

    // Send first heartbeat with a jitter to avoid thundering herd.
    const jitter = Math.random() * intervalMs;
    setTimeout(() => {
      this._sendHeartbeat();
      this._heartbeatInterval = setInterval(() => {
        if (!this._heartbeatAcked) {
          this._log.warn("Heartbeat not ACK'd — connection may be zombie. Reconnecting.");
          this._cleanup();
          this._scheduleReconnect();
          return;
        }
        this._sendHeartbeat();
      }, intervalMs);
    }, jitter);
  }

  private _stopHeartbeat(): void {
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
      this._heartbeatInterval = null;
    }
  }

  private _sendHeartbeat(): void {
    this._heartbeatAcked = false;
    this._heartbeatSentAt = Date.now();
    this._send({ op: FluxorOpCode.Heartbeat, d: this._sequence || null });
  }

  // ── Dispatch ───────────────────────────────────────────────────────────

  private _handleDispatch(packet: GatewayPacket, onReady?: () => void): void {
    const eventName = packet.t;
    const data = packet.d;

    if (!eventName) return;

    // Check ignored events
    if (this._config.ignoredGatewayEvents?.includes(eventName as keyof GatewayEvents)) return;

    // Always emit the raw event
    this._emitter.emit("raw", { event: eventName, data });

    // Special handling for READY and RESUMED
    if (eventName === "READY") {
      const ready = data as GatewayEvents["READY"];
      this._sessionId = ready?.session_id ?? "";
      this._reconnectAttempts = 0;
      this._isConnecting = false;
      this._log.info(`READY — session ${this._sessionId}`);
      this._emitter.emit("READY", ready);
      onReady?.();
      return;
    }

    if (eventName === "RESUMED") {
      this._reconnectAttempts = 0;
      this._isConnecting = false;
      this._log.info("Session RESUMED successfully.");
      this._emitter.emit("RESUMED", undefined);
      onReady?.();
      return;
    }

    // Emit typed event
    this._emitter.emit(eventName, data);
  }

  // ── Reconnection ───────────────────────────────────────────────────────

  private _scheduleReconnect(): void {
    if (this._destroyed) return;

    // ── Concurrency guard — prevent parallel reconnect attempts ──
    if (this._isReconnecting) {
      this._log.debug("Reconnect already scheduled — skipping duplicate.");
      return;
    }
    this._isReconnecting = true;

    // ── Check max attempts ──
    if (this._reconnectAttempts >= this._config.maxReconnectAttempts) {
      this._log.error(
        `Reached maximum reconnect attempts (${this._config.maxReconnectAttempts}). Giving up.`,
      );
      this._isReconnecting = false;
      return;
    }

    this._reconnectAttempts++;

    // Use configured base delay with exponential backoff + jitter
    const configBase = this._config.reconnectDelay;
    const backoff = Math.min(Math.pow(2, this._reconnectAttempts - 1) * configBase, 60);
    const jitter = Math.random() * 0.3 * backoff;
    const delayMs = (backoff + jitter) * 1000;

    this._log.info(
      `Reconnect attempt #${this._reconnectAttempts} in ${(delayMs / 1000).toFixed(1)}s`,
    );

    setTimeout(() => {
      this._isReconnecting = false;
      if (this._destroyed) return;
      this.connect().catch((err) => {
        this._log.error("Reconnection failed", err);
      });
    }, delayMs);
  }

  // ── Cleanup ────────────────────────────────────────────────────────────

  private _cleanup(): void {
    this._stopHeartbeat();
    if (this._ws) {
      try {
        this._ws.removeAllListeners();
        if (
          this._ws.readyState === WebSocket.OPEN ||
          this._ws.readyState === WebSocket.CONNECTING
        ) {
          this._ws.close(1000, "Client cleanup");
        }
      } catch {
        // ignore
      }
      this._ws = null;
    }
  }
}

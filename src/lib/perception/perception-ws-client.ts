/**
 * Framework-free client for the perception-fanout WebSocket hot path.
 *
 * The perception-fanout sidecar (upstream-streaming-server) relays processor
 * perception snapshots at 10–15 Hz, bypassing the DB. This client:
 *
 *   1. asks the caller for credentials (`getToken` — a POST to
 *      `/v1/cameras/{id}/perception/stream-token` through the `/api/upstream`
 *      proxy, so the browser never holds api-server URLs or the Supabase JWT),
 *   2. opens `ws_url?token=...` and forwards every `snapshot` frame to
 *      `onSnapshot`,
 *   3. reconnects forever with jittered backoff until `close()` is called.
 *
 * Token lifecycle: the token is short-lived by design (~10 min). At expiry the
 * server sends `{"type":"bye","code":"token_expired"}` and closes 1000; an
 * invalid token closes 4401 at connect. Both paths re-run `getToken` with no
 * backoff penalty (membership is re-checked at every mint). `getToken`
 * resolving `null` means "permanently unavailable for this handle" (e.g. 503
 * perception_stream_not_configured) — the client stops; the overlay's
 * polling/Realtime fallback carries on. A thrown `getToken` is transient and
 * retried with backoff.
 *
 * Like whep-client.ts this module makes no assumptions about auth or React —
 * it is testable with a mocked WebSocket and shared-able across dashboards.
 * The token must never be logged; it only ever appears in the WS URL.
 */

const INITIAL_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 8000;

export type PerceptionStreamStatus =
  | "connecting"
  | "open"
  | "closed"
  | "unavailable";

export interface PerceptionStreamCredentials {
  token: string;
  /** Full subscribe endpoint, e.g. `ws://127.0.0.1:18990/v1/subscribe`. */
  wsUrl: string;
}

/** A `snapshot` frame from the sidecar. `snapshot` stays opaque here —
 * `normalizeSnapshot()` coerces it downstream, same as the REST/Realtime
 * paths. */
export interface PerceptionWsSnapshot {
  type: "snapshot";
  seq: number;
  camera_id: string;
  stream_session_id: string | null;
  processor_id: string | null;
  package_id: string | null;
  observed_at: string;
  snapshot: Record<string, unknown>;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Defensive parse of one inbound WS frame. Returns the typed snapshot, or
 * `null` for anything else (hello/bye/subscribers frames, malformed JSON,
 * envelopes missing required fields). Never throws.
 */
export function parsePerceptionWsSnapshot(
  raw: unknown,
): PerceptionWsSnapshot | null {
  if (typeof raw !== "string") return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data) || data.type !== "snapshot") return null;
  const seq = data.seq;
  const cameraId = data.camera_id;
  const observedAt = data.observed_at;
  if (typeof seq !== "number" || !Number.isFinite(seq)) return null;
  if (typeof cameraId !== "string" || cameraId.length === 0) return null;
  if (typeof observedAt !== "string" || observedAt.length === 0) return null;
  if (!isRecord(data.snapshot)) return null;
  return {
    type: "snapshot",
    seq,
    camera_id: cameraId,
    stream_session_id:
      typeof data.stream_session_id === "string" ? data.stream_session_id : null,
    processor_id:
      typeof data.processor_id === "string" ? data.processor_id : null,
    package_id: typeof data.package_id === "string" ? data.package_id : null,
    observed_at: observedAt,
    snapshot: data.snapshot,
  };
}

export interface PerceptionStreamHandle {
  close(): void;
}

export interface ConnectPerceptionStreamOptions {
  /** Mint fresh credentials. Called before every (re)connect. Resolve `null`
   * to stop permanently (feature unconfigured / authorization gone); throw
   * for a transient failure (retried with backoff). */
  getToken: () => Promise<PerceptionStreamCredentials | null>;
  onSnapshot: (msg: PerceptionWsSnapshot) => void;
  onStatus?: (status: PerceptionStreamStatus) => void;
  /** Injectable for tests; defaults to `new WebSocket(url)`. */
  webSocketFactory?: (url: string) => WebSocket;
}

/** Close codes after which we retry without backoff growth: 1000 with a
 * `bye(token_expired)` is the expected ~10-min token rotation, and 4401 means
 * the token needs re-minting — both are fixed by `getToken`, not by waiting. */
const TOKEN_ROTATION_CLOSE_CODES = new Set([1000, 4401]);

export function connectPerceptionStream(
  opts: ConnectPerceptionStreamOptions,
): PerceptionStreamHandle {
  let closed = false;
  let ws: WebSocket | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;

  const setStatus = (status: PerceptionStreamStatus) => {
    if (!closed) opts.onStatus?.(status);
  };

  const scheduleReconnect = () => {
    if (closed) return;
    const base = Math.min(MAX_BACKOFF_MS, INITIAL_BACKOFF_MS * 2 ** attempt);
    // 50–100% jitter so a fleet of tabs doesn't reconnect in lockstep.
    const delay = base / 2 + Math.random() * (base / 2);
    attempt += 1;
    timer = setTimeout(() => void connect(), delay);
  };

  const connect = async (): Promise<void> => {
    if (closed) return;
    setStatus("connecting");

    let credentials: PerceptionStreamCredentials | null;
    try {
      credentials = await opts.getToken();
    } catch {
      // Transient mint failure (network blip, 5xx): back off and retry.
      setStatus("closed");
      scheduleReconnect();
      return;
    }
    if (closed) return;
    if (credentials === null) {
      // Permanent for this handle. The caller's gate re-creating the handle
      // (session restart, page revisit) is the only retry path.
      setStatus("unavailable");
      return;
    }

    const url = `${credentials.wsUrl}?token=${encodeURIComponent(credentials.token)}`;
    let socket: WebSocket;
    try {
      socket = (opts.webSocketFactory ?? ((u: string) => new WebSocket(u)))(url);
    } catch {
      setStatus("closed");
      scheduleReconnect();
      return;
    }
    ws = socket;

    socket.onopen = () => {
      if (!closed) setStatus("open");
    };
    socket.onmessage = (event: MessageEvent) => {
      if (closed) return;
      const msg = parsePerceptionWsSnapshot(event.data);
      if (msg) {
        // A delivered frame proves the path works; reset the backoff ladder.
        attempt = 0;
        opts.onSnapshot(msg);
      }
    };
    socket.onclose = (event: CloseEvent) => {
      if (closed) return;
      ws = null;
      setStatus("closed");
      if (TOKEN_ROTATION_CLOSE_CODES.has(event.code)) {
        attempt = 0;
      }
      scheduleReconnect();
    };
    // Errors are always followed by a close event; onclose handles retry.
    socket.onerror = () => undefined;
  };

  void connect();

  return {
    close() {
      closed = true;
      if (timer) clearTimeout(timer);
      timer = null;
      try {
        ws?.close();
      } catch {
        // closing a CONNECTING socket can throw in some engines; ignore
      }
      ws = null;
    },
  };
}

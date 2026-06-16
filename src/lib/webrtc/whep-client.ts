/**
 * Framework-free WHEP (WebRTC-HTTP Egress Protocol) negotiator.
 *
 * **Shared module** — imported by both dashboards:
 *   - `/` (light): `LiveStreamPlayerNext` at
 *     `src/components/dashboard-next/live-stream-player-next.tsx`.
 *   - `/dashboard-legacy` (dark): `LiveStreamPlayer` at
 *     `src/components/stream/live-stream-player.tsx`.
 *
 * Both players hit the same `connectWhep` / `closeWhepSession` pair. When
 * /dashboard-legacy is retired this file is a candidate to move into
 * `src/lib/stream/`; see `docs/dashboard-next.md` "Shared modules".
 *
 * Flow:
 *   1. Create RTCPeerConnection with recvonly transceivers
 *   2. createOffer → setLocalDescription
 *   3. POST the offer SDP to `url` with Content-Type: application/sdp
 *   4. Read the SDP answer body and the Location response header
 *   5. setRemoteDescription({ type: "answer", sdp })
 *
 * Tear-down: caller must `pc.close()` AND fire-and-forget DELETE against
 * `resourceUrl` (the api-server tolerates skipping the DELETE but it leaves
 * a ghost reader in MediaMTX's `paths/list` until the ICE timeout fires).
 *
 * Auth: this client makes no assumptions about auth — it just POSTs to the
 * URL it's given. Today the URL points at the api-server's
 * `/v1/stream-sessions/{id}/whep` proxy, which enforces account-scoped read
 * auth via the existing Supabase JWT / CurrentCaller pipeline. The api-server
 * then forwards to MediaMTX over a private network.
 */

export class WhepNotFoundError extends Error {
  readonly retryable = true;
  constructor(public readonly url: string) {
    super(`WHEP path not found: ${url}`);
    this.name = "WhepNotFoundError";
  }
}

export class WhepRejectedError extends Error {
  readonly retryable = false;
  constructor(
    public readonly url: string,
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`WHEP rejected (${status}): ${body.slice(0, 200)}`);
    this.name = "WhepRejectedError";
  }
}

export class WhepNetworkError extends Error {
  readonly retryable = true;
  constructor(
    public readonly url: string,
    public readonly cause: unknown,
  ) {
    super(`WHEP fetch failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "WhepNetworkError";
  }
}

export interface WhepConnection {
  pc: RTCPeerConnection;
  stream: MediaStream;
  resourceUrl: string | null;
}

export async function connectWhep(opts: {
  url: string;
  signal?: AbortSignal;
}): Promise<WhepConnection> {
  const { url, signal } = opts;
  const pc = new RTCPeerConnection();
  const stream = new MediaStream();

  pc.addTransceiver("video", { direction: "recvonly" });
  pc.addTransceiver("audio", { direction: "recvonly" });

  pc.ontrack = (event) => {
    for (const track of event.streams[0]?.getTracks() ?? [event.track]) {
      stream.addTrack(track);
    }
  };

  const cleanupOnAbort = () => {
    pc.close();
  };
  signal?.addEventListener("abort", cleanupOnAbort, { once: true });

  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: offer.sdp ?? "",
        signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      throw new WhepNetworkError(url, err);
    }

    if (response.status === 404) {
      throw new WhepNotFoundError(url);
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new WhepRejectedError(url, response.status, body);
    }

    const answerSdp = await response.text();
    const locationHeader = response.headers.get("Location");
    // The api-server returns a bare resource id (not a full URL) so we can
    // round-trip through the dashboard's `/api/upstream/*` proxy without
    // having to know the proxy prefix server-side. Append it to the POST URL
    // verbatim. `new URL(loc, url)` would throw here because `url` is often
    // a same-origin relative path.
    const resourceUrl = locationHeader
      ? `${url.replace(/\/+$/, "")}/${encodeURIComponent(locationHeader)}`
      : null;

    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

    signal?.removeEventListener("abort", cleanupOnAbort);
    return { pc, stream, resourceUrl };
  } catch (err) {
    pc.close();
    signal?.removeEventListener("abort", cleanupOnAbort);
    throw err;
  }
}

/**
 * Best-effort session teardown. Uses keepalive so an unmount/navigation
 * doesn't kill the request in flight. Errors are swallowed — the caller is
 * already on the way out and there's nothing useful to do.
 */
export function closeWhepSession(resourceUrl: string | null): void {
  if (!resourceUrl) return;
  try {
    void fetch(resourceUrl, { method: "DELETE", keepalive: true }).catch(
      () => undefined,
    );
  } catch {
    // ignore
  }
}

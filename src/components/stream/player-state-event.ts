/**
 * Cross-component channel for "what is the WebRTC player doing right now".
 *
 * **Shared module** — imported by both dashboards:
 *   - `/dashboard` (dark): `LiveStreamPlayer` / `CameraStreamStatusBadge`
 *     under `src/components/stream/`.
 *   - `/dashboard-next` (light): `LiveStreamPlayerNext` /
 *     `CameraStreamStatusBadgeNext` under `src/components/dashboard-next/`.
 *
 * Both dispatch the same `upstream:player-state` event and both filter on
 * `cameraId`. Keep the contract stable; promotion of dashboard-next will
 * delete the dark consumers but the event itself stays. See
 * `docs/dashboard-next.md` "Shared modules" for the relocation plan.
 *
 * Used by `<LiveStreamPlayer />` (emitter) and any UI piece outside its
 * subtree that wants to mirror the WebRTC connection state — the camera
 * detail page's header status badge today; potentially the cameras list
 * view tomorrow.
 *
 * Why a custom DOM event instead of a Context / store:
 *   - The badge lives in the page header (a Server Component path).
 *     Wrapping the whole page in a client Provider just to share player
 *     state would force the entire header subtree into client rendering
 *     for no other reason. A window-scoped event keeps the badge as the
 *     only client island that needs to know.
 *   - Custom events are fully decoupled: the player doesn't need a
 *     reference to anything outside itself, and consumers don't need to
 *     be ancestors. New listeners can opt in without touching the player.
 *
 * Why `cameraId` is required on the event payload:
 *   - The event is window-scoped, so every listener in every tab sees
 *     every dispatch. With two browser tabs open on different cameras,
 *     tab A's player flipping to `connected` would otherwise flip tab
 *     B's badge. Listeners MUST filter on `cameraId` before reacting.
 *   - When we eventually render multiple players on a single page (a
 *     wall-of-cameras view), the same filter handles intra-tab routing
 *     for free.
 */

export const PLAYER_STATE_EVENT = "upstream:player-state" as const;

export type PlayerStateKind =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed"
  | "needs-gesture"
  | "unsupported";

export type PlayerStateEventDetail = {
  /**
   * The camera the dispatching player is rendering. Listeners MUST
   * filter on this field — the event is window-scoped and other
   * cameras' badges live on the same `window`.
   */
  cameraId: string;
  kind: PlayerStateKind;
};

export function dispatchPlayerState(detail: PlayerStateEventDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<PlayerStateEventDetail>(PLAYER_STATE_EVENT, { detail }),
  );
}

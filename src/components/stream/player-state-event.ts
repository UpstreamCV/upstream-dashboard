/**
 * Cross-component channel for "what is the WebRTC player doing right now".
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
 *   - There is at most one LiveStreamPlayer on a page today, so there's
 *     no cross-talk to worry about. If we ever render multiple at once
 *     (e.g. a wall-of-cameras view), add a `cameraId` field to the
 *     detail and filter on it; this file is the single import point for
 *     that change.
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
  kind: PlayerStateKind;
};

export function dispatchPlayerState(detail: PlayerStateEventDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<PlayerStateEventDetail>(PLAYER_STATE_EVENT, { detail }),
  );
}

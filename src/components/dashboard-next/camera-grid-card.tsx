"use client";

import { CameraCard } from "./camera-card";
import type { CameraBucket } from "./dn-status";
import { useUpstreamList } from "@/lib/api/use-list";
import type { Camera, LatestFrame } from "@/lib/api/types";

// A CameraCard that loads its own key-frame thumbnail. Kept separate from the
// presentational CameraCard so the fetch lives at the per-card level: the grid
// paginates at 6, so at most ~6 of these mount at once (one latest-frame call
// each), which is why a batch endpoint isn't needed here.
//
// A camera with no snapshot yet returns 404, which `shouldRetryOnError` does
// NOT retry (client.ts) — `data` stays undefined and the card falls back to its
// placeholder icon. The last frame of an offline/idle camera is a perfectly
// good representative still, so we show whatever the latest is regardless of
// bucket. Signed URLs are 60s-TTL; the browser fetches the image bytes on
// render well within that, so a single mint is enough — the painted <img>
// bytes outlive the URL's expiry.
//
// Demo mode has no snapshot backend — pass `demo` so the fetch is skipped (null
// key) and the bundled warehouse still is used, preserving the demo narrative.
export function CameraGridCard({
  camera,
  agentName,
  bucket,
  lastHeartbeat,
  list = false,
  demo = false,
}: {
  camera: Camera;
  agentName: string;
  bucket: CameraBucket;
  lastHeartbeat?: string | null;
  list?: boolean;
  demo?: boolean;
}) {
  const { data } = useUpstreamList<LatestFrame>(
    demo ? null : `/v1/cameras/${camera.id}/latest-frame`,
    // Fetch the thumbnail once when the card mounts and never poll: a card
    // thumbnail doesn't need to track the live scene, and periodic + on-focus
    // signed-URL mints for the ~6 visible cards were needless churn. It
    // refreshes on the next page (re)load — the detail page is where you go
    // for the live view.
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  const previewSrc = demo ? "/demo/dock-frame.jpg" : data?.signed_url;

  return (
    <CameraCard
      camera={camera}
      agentName={agentName}
      bucket={bucket}
      lastHeartbeat={lastHeartbeat}
      previewSrc={previewSrc}
      list={list}
    />
  );
}

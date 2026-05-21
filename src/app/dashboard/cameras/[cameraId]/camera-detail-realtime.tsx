"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { StreamSession } from "@/lib/api/types";

/**
 * Live state watcher for the camera detail page.
 *
 * Subscribes to Supabase Realtime broadcasts on `stream_sessions` filtered
 * to this camera, and calls `router.refresh()` whenever the row's `state`
 * actually changes. Replaces the previous 5-second SWR polling loop — the
 * dashboard now lights up "live" within the broadcast latency (~50–200ms)
 * instead of up to 5 seconds late.
 *
 * Initial state still comes from the server-rendered `initialSession`
 * prop; subscription only catches subsequent transitions.
 *
 * Realtime broadcasts respect the `stream_sessions_member_select` RLS
 * policy, so the browser only receives events for rows it could already
 * read via the api-server. No new auth surface.
 *
 * The `cameras` table is added to the same Realtime publication for the
 * cameras list view, but this component watches `stream_sessions`
 * specifically because the session row carries the `streaming`/`ended`/
 * `failed` transitions the player cares about. The cameras-side mirror
 * happens in the same DB transaction so list-view subscribers are
 * coherent without us needing to subscribe to both here.
 */
export function CameraDetailRealtime({
  cameraId,
  initialSession,
}: {
  cameraId: string;
  initialSession: StreamSession | null;
}) {
  const router = useRouter();
  const lastStateRef = useRef<string | null>(initialSession?.state ?? null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    // Channel name: `camera:${cameraId}:sessions` is the LIVE-dashboard name.
    // The /dashboard-next sibling uses `dn-camera:…` so a user with both tabs
    // open on the same camera gets two independent subscriptions instead of
    // accidentally sharing one. On promotion of /dashboard-next, this name is
    // the survivor (the `dn-` prefix is dropped from the new file). See
    // `docs/dashboard-next.md` "Realtime channel naming convention".
    const channel = supabase
      .channel(`camera:${cameraId}:sessions`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stream_sessions",
          filter: `camera_id=eq.${cameraId}`,
        },
        (payload) => {
          const next = (payload.new as { state?: string } | null)?.state;
          // Skip DELETE events (no `new` row) and no-op writes that don't
          // change `state`. router.refresh() re-fetches the whole RSC tree
          // and re-renders the detail page; doing it on every column change
          // (e.g. validated_bitrate_kbps wiggling) would churn pointlessly.
          if (next && next !== lastStateRef.current) {
            lastStateRef.current = next;
            router.refresh();
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [cameraId, router]);

  return null;
}

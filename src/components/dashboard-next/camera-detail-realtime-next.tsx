"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { StreamSession } from "@/lib/api/types";

// Light-theme port — pure-logic, no visuals — of
// src/app/dashboard/cameras/[cameraId]/camera-detail-realtime.tsx.
//
// Subscribes to Supabase Realtime broadcasts on `stream_sessions` filtered to
// this camera and calls router.refresh() whenever the row's state changes.
// Replaces 5s polling with sub-200ms push.
//
// Realtime broadcasts respect RLS (`stream_sessions_member_select`) — the
// browser receives only rows the user could read via the api-server, so this
// stays within AGENTS.md's "no new auth surface" rule.
export function CameraDetailRealtimeNext({
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
    // Channel name: `dn-camera:${cameraId}:sessions`. The `dn-` prefix keeps
    // this subscription isolated from /dashboard's `camera:${cameraId}:sessions`
    // while both dashboards run in parallel — a user with both tabs open on
    // the same camera gets two independent refreshes instead of accidentally
    // sharing one channel. On promotion the prefix is dropped (the surviving
    // name is `camera:…`). See `docs/dashboard-next.md` "Realtime channel
    // naming convention" and the promotion checklist.
    const channel = supabase
      .channel(`dn-camera:${cameraId}:sessions`)
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
          // Skip DELETE events and no-op writes that don't change `state`.
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

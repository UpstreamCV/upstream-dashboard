"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client-lazy";
import type { StreamSession } from "@/lib/api/types";
import { isDemoMode } from "@/lib/demo/demo-mode";

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
    if (isDemoMode()) return; // no Supabase in demo mode — the stepper drives refresh
    // Coalesce bursts of state transitions into one refresh. A normal lifecycle
    // (approved -> streaming -> ended) is 2-3 transitions in quick succession,
    // and a reconnecting agent can flip states rapidly — each router.refresh()
    // re-runs the whole camera RSC subtree (~13 no-store fetches). A short
    // trailing debounce keeps the live view fresh (<=300ms behind the final
    // transition) while collapsing rapid-fire churn into a single refetch.
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    // The Supabase SDK is loaded lazily (off the camera-route critical bundle),
    // so obtaining the client is async. Guard teardown with `cancelled` in case
    // this effect unmounts before the dynamic import resolves.
    let cancelled = false;
    let supabase: SupabaseClient | null = null;
    let channel: RealtimeChannel | null = null;

    void (async () => {
      const client = await getSupabaseBrowserClient();
      if (cancelled) return;
      supabase = client;
      // Channel name: `camera:${cameraId}:sessions` — the primary /dashboard name.
      // The /dashboard-legacy fallback uses `legacy-camera:…` so a user with both
      // tabs open on the same camera gets two independent subscriptions instead of
      // accidentally sharing one. When /dashboard-legacy is retired this stays the
      // sole name. See `docs/dashboard-next.md` "Realtime channel naming convention".
      channel = client
        .channel(`camera:${cameraId}:sessions`)
        .on(
          "postgres_changes",
          // NO server-side `filter`: Supabase only applies postgres_changes
          // filters on UPDATE events against columns in the table's REPLICA
          // IDENTITY (the PK `id`), so a `camera_id=eq.` filter silently drops
          // every state-transition UPDATE (approved -> streaming -> ended) and
          // only new-session INSERTs would arrive. RLS (member_select) scopes
          // delivery to the account; we narrow to this camera in the handler.
          {
            event: "*",
            schema: "public",
            table: "stream_sessions",
          },
          (payload) => {
            const row = payload.new as
              | { state?: string; camera_id?: string }
              | null;
            if (!row || row.camera_id !== cameraId) return;
            const next = row.state;
            // Skip DELETE events and no-op writes that don't change `state`.
            if (next && next !== lastStateRef.current) {
              lastStateRef.current = next;
              // Trailing debounce: reset the timer on each transition so a rapid
              // burst fires one refresh ~300ms after the last change.
              if (refreshTimer) clearTimeout(refreshTimer);
              refreshTimer = setTimeout(() => {
                refreshTimer = null;
                router.refresh();
              }, 300);
            }
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      if (supabase && channel) void supabase.removeChannel(channel);
    };
  }, [cameraId, router]);

  return null;
}

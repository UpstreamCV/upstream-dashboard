"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUpstreamList } from "@/lib/api/use-list";
import type {
  StreamSession,
  StreamSessionListResponse,
} from "@/lib/api/types";

/**
 * Background poller for the camera detail page. Watches the camera's most
 * recent session every 5 seconds; calls router.refresh() when the state
 * changes so the server-rendered panels (validation, agent) catch up.
 */
export function CameraDetailPolling({
  cameraId,
  initialSession,
}: {
  cameraId: string;
  initialSession: StreamSession | null;
}) {
  const router = useRouter();
  const { data } = useUpstreamList<StreamSessionListResponse>(
    `/v1/stream-sessions?camera_id=${cameraId}&limit=1`,
    {
      refreshInterval: 5_000,
      fallbackData: {
        sessions: initialSession ? [initialSession] : [],
      },
    },
  );

  const latest = data?.sessions?.[0] ?? null;
  const prevState = initialSession?.state;
  const nextState = latest?.state;

  useEffect(() => {
    if (prevState !== nextState) {
      router.refresh();
    }
    // We deliberately depend only on the state-shift, not the full session object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextState]);

  return null;
}

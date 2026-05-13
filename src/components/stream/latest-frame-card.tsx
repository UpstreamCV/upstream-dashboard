"use client";

import { ImageOff } from "lucide-react";
import { RelativeTime } from "@/components/data/relative-time";
import { useUpstreamList } from "@/lib/api/use-list";
import { UpstreamApiError } from "@/lib/api/errors";
import type { LatestFrame } from "@/lib/api/types";

export function LatestFrameCard({
  cameraId,
  initialFrame,
}: {
  cameraId: string;
  initialFrame: LatestFrame | null;
}) {
  // api-server returns 404 `snapshot_not_found` when the camera hasn't
  // streamed yet. SWR throws UpstreamApiError; we surface that as the
  // empty state instead of re-rendering the error boundary every poll.
  const { data, error } = useUpstreamList<LatestFrame>(
    `/v1/cameras/${cameraId}/latest-frame`,
    {
      refreshInterval: 7_000,
      fallbackData: initialFrame ?? undefined,
    },
  );

  const isMissing =
    error instanceof UpstreamApiError &&
    (error.status === 404 || error.code === "snapshot_not_found");
  const frame = isMissing ? null : (data ?? initialFrame);

  if (!frame) {
    return (
      <div className="glass rounded-3xl px-6 py-14 text-center">
        <ImageOff className="w-7 h-7 mx-auto text-ink-mute" />
        <h3 className="display text-lg font-semibold mt-3">
          No frame <em>yet</em>
        </h3>
        <p className="text-sm text-ink-soft mt-2 max-w-md mx-auto">
          When the agent starts streaming and uploads its first snapshot, the
          latest frame appears here.
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-3xl overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={frame.signed_url}
        alt="Latest captured frame"
        className="w-full h-auto block bg-base-deep"
      />
      <div className="px-4 py-3 text-[12px] text-ink-soft flex items-center justify-between gap-3 mono">
        <span>
          {frame.width && frame.height
            ? `${frame.width}×${frame.height}`
            : "—"}
          {" · "}
          {(frame.bytes / 1024).toFixed(0)} KB
        </span>
        <RelativeTime value={frame.captured_at} className="text-ink-mute" />
      </div>
    </div>
  );
}

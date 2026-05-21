"use client";

import { ImageOff } from "lucide-react";
import { RelativeTime } from "@/components/data/relative-time";
import { useUpstreamList } from "@/lib/api/use-list";
import { UpstreamApiError } from "@/lib/api/errors";
import type { LatestFrame } from "@/lib/api/types";

// Light-theme port of src/components/stream/latest-frame-card.tsx. Same 7s
// SWR poll on /v1/cameras/{id}/latest-frame, same graceful 404 ("no frame
// yet"). Image fills the .dn-tile; meta row underneath shows WxH + size +
// captured-at.
export function LatestFrameCardNext({
  cameraId,
  initialFrame,
}: {
  cameraId: string;
  initialFrame: LatestFrame | null;
}) {
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
      <div className="dn-tile p-[clamp(1.5rem,3vw,2.5rem)] text-center">
        <ImageOff
          className="w-7 h-7 mx-auto text-[var(--dn-text-50)]"
          aria-hidden
        />
        <h3 className="font-bold text-[clamp(1rem,1.4vw,1.3rem)] mt-3">
          No frame yet
        </h3>
        <p className="text-sm text-[var(--dn-text-50)] mt-2 max-w-md mx-auto">
          When the agent starts streaming and uploads its first snapshot, the
          latest frame appears here.
        </p>
      </div>
    );
  }

  return (
    <div className="dn-tile overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={frame.signed_url}
        alt="Latest captured frame"
        className="w-full h-auto block bg-black"
      />
      <div className="px-4 py-3 text-[12px] text-[var(--dn-text-50)] flex items-center justify-between gap-3 font-mono">
        <span>
          {frame.width && frame.height
            ? `${frame.width}×${frame.height}`
            : "—"}
          {" · "}
          {(frame.bytes / 1024).toFixed(0)} KB
        </span>
        <RelativeTime
          value={frame.captured_at}
          className="text-[var(--dn-text-50)]"
        />
      </div>
    </div>
  );
}

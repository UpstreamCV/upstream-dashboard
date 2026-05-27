import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { CameraDetailRealtimeNext } from "@/components/dashboard-next/camera-detail-realtime-next";
import { CameraStreamStatusBadgeNext } from "@/components/dashboard-next/camera-stream-status-badge-next";
import { CameraTabs } from "@/components/dashboard-next/camera-tabs";
import { getActiveAccount } from "@/lib/account/active";
import { getCamera } from "@/lib/api/cameras";
import { UpstreamApiError } from "@/lib/api/errors";
import { listStreamSessions } from "@/lib/api/stream-sessions";
import type { Camera, StreamSession } from "@/lib/api/types";

// Camera detail layout — persistent header, tab strip, and Realtime listener.
// Wraps the five tab segments (monitor/observations/configure/settings/
// reliability). Lifting the header into a layout keeps it visible across tab
// navigation; lifting the Realtime listener here keeps session-state pushes
// alive even when the active tab is not Monitor.
//
// The layout only fetches what the header needs (camera + most-recent session).
// Each tab page fetches its own data; layout/page fetch duplication is
// accepted for now (see docs/dashboard-next.md "Route policy").

export default async function CameraDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ cameraId: string }>;
}) {
  const { cameraId } = await params;
  const { activeAccountId } = await getActiveAccount();

  let camera: Camera;
  try {
    camera = await getCamera({ accountId: activeAccountId, cameraId });
  } catch (err) {
    if (err instanceof UpstreamApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  const sessions = await listStreamSessions({
    accountId: activeAccountId,
    cameraId: camera.id,
    limit: 1,
  });
  const currentSession: StreamSession | null = sessions[0] ?? null;

  return (
    <section className="space-y-4 md:space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard-next/cameras"
          className="inline-flex items-center gap-1 text-[clamp(0.78rem,1vw,0.92rem)] text-white/75 hover:text-white transition"
        >
          <ChevronLeft className="w-4 h-4" />
          Cameras
        </Link>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[clamp(0.62rem,0.8vw,0.78rem)] font-bold uppercase tracking-wide text-white/65">
            camera
          </p>
          <h1 className="mt-1.5 flex flex-wrap items-center gap-3 font-bold text-white text-[clamp(1.6rem,3.2vw,2.4rem)]">
            <span className="truncate">{camera.name}</span>
            <CameraStreamStatusBadgeNext
              cameraId={camera.id}
              initialStatus={camera.status}
            />
          </h1>
          <p className="mt-2 text-[11px] uppercase tracking-wider font-mono text-white/55">
            id: {camera.id}
          </p>
        </div>
      </header>

      <CameraDetailRealtimeNext
        cameraId={camera.id}
        initialSession={currentSession}
      />

      <CameraTabs cameraId={camera.id} />

      {children}
    </section>
  );
}

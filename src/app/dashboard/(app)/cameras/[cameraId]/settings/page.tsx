import { notFound } from "next/navigation";
import { CameraMetaPanel } from "@/components/dashboard-next/camera-panels";
import { RelativeTime } from "@/components/data/relative-time";
import { getActiveAccount } from "@/lib/account/active";
import { getCamera } from "@/lib/api/cameras";
import { UpstreamApiError } from "@/lib/api/errors";
import type { Camera } from "@/lib/api/types";

// Settings tab — read-only camera metadata. Editing this from the dashboard
// is a separate ticket; today this is a clear surface for "what is this
// camera configured as?" without overloading the Monitor tab.

export default async function CameraSettingsPage({
  params,
}: {
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
      <CameraMetaPanel camera={camera} />
      <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)] space-y-3">
        <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
          identifiers
        </p>
        <Row label="Camera id">
          <span className="font-mono text-xs text-[var(--dn-text-50)]">
            {camera.id}
          </span>
        </Row>
        <Row label="Agent id">
          <span className="font-mono text-xs text-[var(--dn-text-50)]">
            {camera.agent_id}
          </span>
        </Row>
        <Row label="Status">
          <span className="font-mono capitalize text-black">{camera.status}</span>
        </Row>
        <Row label="Created">
          <RelativeTime
            value={camera.created_at}
            className="text-[var(--dn-text-50)]"
          />
        </Row>
        <Row label="Updated">
          <RelativeTime
            value={camera.updated_at}
            className="text-[var(--dn-text-50)]"
          />
        </Row>
        <p className="pt-3 text-xs text-[var(--dn-text-50)]">
          Editing camera metadata isn&rsquo;t wired up here yet — for now,
          update via the api-server directly.
        </p>
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
        {label}
      </span>
      <span className="text-right text-[clamp(0.82rem,1vw,0.95rem)]">
        {children}
      </span>
    </div>
  );
}

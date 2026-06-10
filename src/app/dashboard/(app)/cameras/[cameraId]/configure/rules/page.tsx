import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Zap } from "lucide-react";
import { RulesPanel } from "@/components/dashboard-next/rules/rules-panel";
import { getActiveAccount } from "@/lib/account/active";
import { UpstreamApiError } from "@/lib/api/errors";
import { getCameraGeometryConfig } from "@/lib/api/geometry";
import { listRules } from "@/lib/api/rules";

// Rules/Triggers M1 — per-camera rule editor behind the configure tab's
// "Triggers & Effects" card.
//
// Server-renders the camera's rules plus the saved geometry config (the
// rule editor's line/zone pickers offer drawn shapes by label instead of
// free-typed ids), then hands both to <RulesPanel> (Client Component).
// Mutations go through Server Actions in ./actions.ts; the panel calls
// router.refresh() after each success so this page re-renders fresh rows.
//
// Alerts the rules raise land in the account-wide inbox at /dashboard/alerts.

export default async function CameraRulesPage({
  params,
}: {
  params: Promise<{ cameraId: string }>;
}) {
  const { cameraId } = await params;
  const { activeAccountId, activeAccount } = await getActiveAccount();
  const canEdit =
    activeAccount.role === "owner" || activeAccount.role === "admin";

  // Rules and geometry are independent reads keyed off (accountId, cameraId);
  // fetch them concurrently. An unknown/cross-tenant camera 404s on the rules
  // read. Geometry always resolves (the server synthesizes a probe default),
  // so an empty lines/rois list just means "no shapes drawn yet".
  const [rules, geometry] = await Promise.all([
    listRules({ accountId: activeAccountId, cameraId }).catch((err) => {
      if (err instanceof UpstreamApiError && err.status === 404) {
        notFound();
      }
      throw err;
    }),
    getCameraGeometryConfig({ accountId: activeAccountId, cameraId }),
  ]);

  const lines = geometry.config.lines.map((l) => ({
    id: l.id,
    label: l.label ?? l.id,
  }));
  const rois = geometry.config.rois.map((r) => ({
    id: r.id,
    label: r.label ?? r.id,
  }));

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/dashboard/cameras/${cameraId}/configure`}
          className="inline-flex items-center gap-1 text-[clamp(0.78rem,1vw,0.92rem)] text-white/75 hover:text-white transition"
        >
          <ChevronLeft className="w-4 h-4" />
          Configure
        </Link>
      </div>

      <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
        <div className="flex items-start gap-3">
          <Zap
            className="h-6 w-6 shrink-0 text-[var(--dn-creek-mid)]"
            aria-hidden
          />
          <div>
            <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
              triggers &amp; effects
            </p>
            <h2 className="mt-1 font-bold text-[clamp(1.1rem,1.6vw,1.5rem)] text-black">
              Alert rules for this camera
            </h2>
            <p className="mt-2 text-sm text-[var(--dn-text-50)]">
              Rules watch this camera&rsquo;s detections — line crossings, ROI
              occupancy, zone entries, dwell time — and raise alerts in the{" "}
              <Link
                href="/dashboard/alerts"
                className="underline hover:text-black"
              >
                alert inbox
              </Link>{" "}
              when they match. Each rule has a cooldown so a busy scene
              doesn&rsquo;t flood the inbox.
            </p>
          </div>
        </div>
      </div>

      <RulesPanel
        cameraId={cameraId}
        initialRules={rules}
        lines={lines}
        rois={rois}
        canEdit={canEdit}
      />
    </div>
  );
}

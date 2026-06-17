import Link from "next/link";
import { ReliabilityFindingCard } from "@/components/dashboard-next/reliability-finding-card";
import { getActiveAccount } from "@/lib/account/active";
import { getReliabilityFindings } from "@/lib/api/reliability";

// Per-camera Issues tab — the actionable work queue for THIS camera: its open
// reliability findings, one detail card each. Deliberately lighter than the
// Reliability tab (which adds the verdict hero, confidence trends, config
// comparison, and resolved history) — this tab answers only "what needs
// attention here, right now". It's the camera-scoped slice of the (gated,
// account-wide) Issues queue, and reuses the same getReliabilityFindings fetch
// + ReliabilityFindingCard the Reliability tab uses (no new component, no
// fan-out — a single camera).
export default async function CameraIssuesPage({
  params,
}: {
  params: Promise<{ cameraId: string }>;
}) {
  const { cameraId } = await params;
  const { activeAccountId } = await getActiveAccount();

  const openFindings = await getReliabilityFindings({
    accountId: activeAccountId,
    cameraId,
    status: "open",
  });

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-bold text-[clamp(1rem,1.2vw,1.15rem)] text-white">
          Open issues
        </h2>
        <span className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
          {openFindings.length} active
        </span>
      </div>

      {openFindings.length > 0 ? (
        <section className="space-y-3 md:space-y-4">
          {openFindings.map((f) => (
            <ReliabilityFindingCard key={f.id} finding={f} variant="open" />
          ))}
        </section>
      ) : (
        <section className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
          <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
            all clear
          </p>
          <p className="mt-2 text-[clamp(0.85rem,1vw,0.95rem)] text-white">
            No open issues for this camera. Resolved findings and confidence
            trends live on the{" "}
            <Link
              href={`/cameras/${cameraId}/reliability`}
              className="font-bold underline underline-offset-2"
            >
              Reliability
            </Link>{" "}
            tab.
          </p>
        </section>
      )}
    </div>
  );
}

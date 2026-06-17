import Link from "next/link";
import { StatusDot } from "@/components/dashboard-next/status-dot";
import { getActiveAccount } from "@/lib/account/active";
import { listCameras } from "@/lib/api/cameras";
import { listRules } from "@/lib/api/rules";

// Rules — account-wide, READ-ONLY roll-up of every rule across cameras (the
// proposed Event Outputs › Rules surface). Authoring stays per-camera at
// /cameras/[id]/configure/rules; each row deep-links there. Reuses the existing
// listRules (account-scoped; cameraId optional) + listCameras for names. No new
// backend, no editing lift here.

const SEVERITY_CHIP: Record<string, string> = {
  info: "bg-white/[0.06] text-white/70",
  warning: "bg-[#8a6d1f]/15 text-[#caa84a]",
  critical: "bg-red-700/15 text-[#f08a82]",
};

export default async function RulesRollupPage() {
  const { activeAccountId } = await getActiveAccount();
  const [rules, cameras] = await Promise.all([
    listRules({ accountId: activeAccountId }),
    listCameras({ accountId: activeAccountId }),
  ]);
  const cameraNames: Record<string, string> = Object.fromEntries(
    cameras.map((c) => [c.id, c.name]),
  );

  return (
    <div className="space-y-4 md:space-y-6">
      <header>
        <h1 className="font-bold text-white text-[clamp(1.3rem,2vw,1.8rem)]">
          Rules <span className="text-white/55">· {rules.length}</span>
        </h1>
        <p className="mt-1 text-sm text-[var(--dn-text-50)]">
          Every detection rule across your cameras. Read-only here — edit a rule
          on its camera&apos;s Configure tab.
        </p>
      </header>

      {rules.length === 0 ? (
        <div className="dn-tile p-[clamp(1.5rem,3vw,2.5rem)] text-center">
          <p className="font-bold text-[clamp(1rem,1.4vw,1.3rem)] text-white">
            No rules yet
          </p>
          <p className="mt-2 text-[var(--dn-text-50)] text-[clamp(0.85rem,1vw,1rem)]">
            Add a rule from a camera&apos;s Configure tab to start triggering
            alerts and workflows.
          </p>
        </div>
      ) : (
        <div className="dn-tile overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[clamp(0.78rem,1vw,0.92rem)]">
              <thead>
                <tr className="text-[var(--dn-text-50)] [&>th]:whitespace-nowrap [&>th]:px-4 [&>th]:py-3 [&>th]:text-[0.72em] [&>th]:font-bold [&>th]:uppercase [&>th]:tracking-wide">
                  <th>Rule</th>
                  <th>Camera</th>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Cooldown</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-[rgba(255,255,255,0.08)] transition-colors hover:bg-white/[0.04] [&>td]:whitespace-nowrap [&>td]:px-4 [&>td]:py-3 [&>td]:align-middle"
                  >
                    <td className="font-bold text-white">
                      <Link
                        href={`/cameras/${r.camera_id}/configure/rules`}
                        className="hover:underline underline-offset-2"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="text-white/80">
                      <Link
                        href={`/cameras/${r.camera_id}`}
                        className="hover:underline underline-offset-2"
                      >
                        {cameraNames[r.camera_id] ?? r.camera_id.slice(0, 8) + "…"}
                      </Link>
                    </td>
                    <td className="font-mono text-[var(--dn-text-50)]">
                      {r.rule_type}
                    </td>
                    <td>
                      <span
                        className={
                          "rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide " +
                          (SEVERITY_CHIP[r.severity] ?? SEVERITY_CHIP.info)
                        }
                      >
                        {r.severity}
                      </span>
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1.5">
                        <StatusDot status={r.enabled ? "green" : "neutral"} />
                        <span className="text-white/80">
                          {r.enabled ? "Enabled" : "Disabled"}
                        </span>
                      </span>
                    </td>
                    <td className="font-mono text-[var(--dn-text-50)]">
                      {r.cooldown_seconds}s
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

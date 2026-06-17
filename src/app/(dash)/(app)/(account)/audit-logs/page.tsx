import { AuditLogsClient } from "@/components/dashboard-next/audit-logs-client";
import { getActiveAccount } from "@/lib/account/active";
import { listAuditLogs } from "@/lib/api/audit-logs";

// Module 7 M3 — tenant audit log page. Account-facing history (cameras,
// tokens, rules, workflows, billing, limit rejections) for THIS account's
// members; platform-admin auditing lives in the separate admin panel.

export default async function AuditLogsPage() {
  const { activeAccountId } = await getActiveAccount();
  const { items } = await listAuditLogs({ accountId: activeAccountId, limit: 100 });

  return (
    <div className="space-y-4 md:space-y-6 p-[clamp(1rem,2vw,1.75rem)]">
      <div>
        <h1 className="text-[clamp(1.3rem,2vw,1.8rem)] font-bold text-white">
          Audit Logs
        </h1>
        <p className="mt-1 text-sm text-[var(--dn-text-50)]">
          Recent account, billing, camera, token, rule, and workflow changes.
        </p>
      </div>
      <AuditLogsClient items={items} />
    </div>
  );
}

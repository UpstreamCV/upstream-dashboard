"use client";

import { formatRelative } from "@/lib/time";
import type { EvidencePackageHistoryItem } from "@/lib/api/types";
import { packageEventLabel } from "@/lib/perception/processing-evidence-format";

// Compact package request/apply timeline (from the audit log). Read-only.

export function EvidencePackageHistory({
  items,
}: {
  items: EvidencePackageHistoryItem[];
}) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
        package history
      </p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--dn-text-50)]">
          No package changes recorded.
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.map((it) => (
            <li key={it.id} className="flex items-start gap-3 text-sm">
              <span className="whitespace-nowrap font-mono text-xs text-[var(--dn-text-50)]">
                {formatRelative(it.created_at)}
              </span>
              <span className="text-white/85">
                <span className="font-bold">
                  {packageEventLabel(it.event_type)}
                </span>
                {it.package_id ? ` ${it.package_id}` : ""}
                {it.actor_type === "system" ? " (system)" : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

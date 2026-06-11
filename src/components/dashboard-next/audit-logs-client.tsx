"use client";

import { useMemo, useState } from "react";
import { ScrollText } from "lucide-react";
import { RelativeTime } from "@/components/data/relative-time";
import type { AuditLogItem } from "@/lib/api/types";
import {
  AUDIT_CATEGORIES,
  AUDIT_CATEGORY_LABELS,
  type AuditCategory,
  auditActorLabel,
  auditEventCategory,
  auditEventLabel,
  auditMetadataPreview,
} from "@/lib/audit/audit-format";

// Module 7 M3 — audit log list with category filter chips. Filtering is
// client-side over the server-fetched page (100 most recent); metadata
// rendering is allowlist-only via auditMetadataPreview.

const CHIP_ON =
  "rounded-full border px-2.5 py-1 text-xs font-bold transition border-[var(--dn-creek-mid)] bg-[var(--dn-creek-mid)]/15 text-[var(--dn-creek-deep)]";
const CHIP_OFF =
  "rounded-full border px-2.5 py-1 text-xs font-bold transition border-black/10 bg-white text-black/60 hover:border-[var(--dn-creek-mid)] hover:text-black";

const CATEGORY_CHIP_STYLE: Record<string, string> = {
  billing: "bg-[var(--dn-creek-mid)]/15 text-[var(--dn-creek-deep)]",
  cameras: "bg-black/[0.06] text-black/70",
  tokens: "bg-[#8a6d1f]/15 text-[#8a6d1f]",
  rules: "bg-black/[0.06] text-black/70",
  workflows: "bg-black/[0.06] text-black/70",
  limits: "bg-red-700/10 text-red-700",
};

export function AuditLogsClient({ items }: { items: AuditLogItem[] }) {
  const [category, setCategory] = useState<AuditCategory>("all");

  const visible = useMemo(
    () =>
      category === "all"
        ? items
        : items.filter((item) => auditEventCategory(item.event_type) === category),
    [items, category],
  );

  return (
    <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
      <div className="flex flex-wrap items-center gap-1.5">
        {AUDIT_CATEGORIES.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setCategory(value)}
            className={category === value ? CHIP_ON : CHIP_OFF}
          >
            {AUDIT_CATEGORY_LABELS[value]}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 py-10 text-center">
          <ScrollText className="h-8 w-8 text-[var(--dn-text-15)]" aria-hidden />
          <p className="text-sm text-[var(--dn-text-50)]">
            {items.length === 0
              ? "No audit activity yet. Changes to cameras, tokens, rules, workflows, and billing will show up here."
              : "Nothing in this category yet."}
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {visible.map((item) => {
            const itemCategory = auditEventCategory(item.event_type);
            const preview = auditMetadataPreview(item.metadata);
            return (
              <li
                key={item.id}
                className="flex flex-wrap items-start gap-3 rounded-xl border border-black/10 bg-black/[0.02] p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide " +
                        (CATEGORY_CHIP_STYLE[itemCategory ?? ""] ??
                          "bg-black/[0.06] text-black/70")
                      }
                    >
                      {auditEventLabel(item.event_type)}
                    </span>
                    <span className="text-xs font-mono text-[var(--dn-text-50)]">
                      {auditActorLabel(item)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-black/80">{item.summary}</p>
                  {preview.length > 0 ? (
                    <p className="mt-0.5 text-xs font-mono text-[var(--dn-text-50)]">
                      {preview.join(" · ")}
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 text-xs text-[var(--dn-text-50)]">
                  <RelativeTime value={item.created_at} />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { RelativeTime } from "@/components/data/relative-time";
import type { ReliabilitySource } from "@/lib/api/types";
import {
  HEALTH_DOT,
  HEALTH_LABEL,
  KIND_LABEL,
  formatExpected,
  healthExplanation,
} from "./collector-health";
import { ConfigureLivenessModal } from "./configure-liveness-modal";
import { StatusDot } from "./status-dot";

// The durable source registry (M2a) with M2b liveness health + the M2c Configure
// action. One row per collector/external source: its real HEALTH state, the
// EXPECTED reporting cadence, latest model, open issues, and (owner/admin) a
// Configure button that opens the liveness settings modal. These are EXTERNAL
// collector/CV sources, not managed Upstream cameras.

const TH = "px-4 py-3 text-left font-bold uppercase tracking-wide";
const TD = "whitespace-nowrap px-4 py-3";

function modelLabel(s: ReliabilitySource): string {
  if (!s.last_model_name) return "—";
  return s.last_model_version
    ? `${s.last_model_name} · ${s.last_model_version}`
    : s.last_model_name;
}

export function CollectorSourcesTable({
  sources,
  canConfigure,
  onConfigured,
}: {
  sources: ReliabilitySource[];
  canConfigure: boolean;
  onConfigured: () => void;
}) {
  const [configuring, setConfiguring] = useState<ReliabilitySource | null>(null);

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="font-bold text-[clamp(1rem,1.2vw,1.15rem)] text-white">
          Sources
        </h2>
        <p className="text-sm text-[var(--dn-text-50)]">
          External collector and CV sources sending observations to Upstream —
          not managed Upstream cameras. Health is monitored by the liveness sweep.
        </p>
      </div>
      {sources.length === 0 ? (
        <div className="dn-tile p-[clamp(1.3rem,2.5vw,2rem)] text-center text-sm text-[var(--dn-text-50)]">
          No sources have sent observations yet.
        </div>
      ) : (
        <div className="dn-tile overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[clamp(0.8rem,1vw,0.95rem)]">
              <thead>
                <tr className="text-[var(--dn-text-50)]">
                  <th className={TH}>Source</th>
                  <th className={TH}>External key</th>
                  <th className={TH}>Kind</th>
                  <th className={TH}>Health</th>
                  <th className={TH}>Expected</th>
                  <th className={TH}>Last seen</th>
                  <th className={TH}>Last data</th>
                  <th className={TH}>Model</th>
                  <th className={TH}>Open issues</th>
                  <th className={TH}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr
                    key={s.id}
                    className="border-t border-white/10 hover:bg-[rgba(0,0,0,0.03)]"
                  >
                    <td className={`${TD} font-bold`}>{s.source}</td>
                    <td className={TD}>{s.external_camera_key ?? "—"}</td>
                    <td className={TD}>{KIND_LABEL[s.source_kind]}</td>
                    <td className={TD}>
                      <span
                        className="inline-flex items-center gap-1.5"
                        title={healthExplanation(s)}
                      >
                        <StatusDot status={HEALTH_DOT[s.health_status]} />
                        {HEALTH_LABEL[s.health_status]}
                      </span>
                    </td>
                    <td className={TD}>{formatExpected(s)}</td>
                    <td className={TD}>
                      <RelativeTime value={s.last_seen_at} />
                    </td>
                    <td className={TD}>
                      <RelativeTime value={s.last_observation_at} />
                    </td>
                    <td className={TD}>{modelLabel(s)}</td>
                    <td className={`${TD} font-bold`}>
                      {s.open_issue_count > 0 ? (
                        <span className="text-[#ff8f57]">{s.open_issue_count}</span>
                      ) : (
                        0
                      )}
                    </td>
                    <td className={TD}>
                      {canConfigure ? (
                        <button
                          type="button"
                          onClick={() => setConfiguring(s)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] border border-white/10 px-3 py-1 text-xs text-white hover:bg-white/[0.08] transition"
                        >
                          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
                          Configure
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {configuring ? (
        <ConfigureLivenessModal
          key={configuring.id}
          source={configuring}
          open
          onOpenChange={(o) => {
            if (!o) setConfiguring(null);
          }}
          onConfigured={onConfigured}
        />
      ) : null}
    </section>
  );
}

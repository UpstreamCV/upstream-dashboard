import { RelativeTime } from "@/components/data/relative-time";
import type {
  ReliabilitySource,
  SourceHealthStatus,
  SourceKind,
} from "@/lib/api/types";
import { StatusDot, type DotStatus } from "./status-dot";

// The durable source registry (M2a) with M2b liveness health. One row per
// collector/external source: when it last sent data, its real HEALTH state
// (healthy/delayed/silent/collector_offline/unknown/disabled), expected
// interval, latest model, lifetime totals, and open issues. These are EXTERNAL
// collector/CV sources, not managed Upstream cameras. Reads from
// /v1/reliability/sources (health is computed by the scheduled liveness sweep).

const TH = "px-4 py-3 text-left font-bold uppercase tracking-wide";
const TD = "whitespace-nowrap px-4 py-3";

const KIND_LABEL: Record<SourceKind, string> = {
  collector: "Collector",
  external_camera: "External source",
  observation_source: "Observation source",
  unknown: "Unknown",
};

// Health → StatusDot color, reusing the redesign's status-accent system:
// healthy green, delayed yellow, silent/offline red, unknown/disabled neutral.
const HEALTH_DOT: Record<SourceHealthStatus, DotStatus> = {
  healthy: "green",
  delayed: "yellow",
  silent: "red",
  collector_offline: "red",
  unknown: "neutral",
  disabled: "neutral",
};

const HEALTH_LABEL: Record<SourceHealthStatus, string> = {
  healthy: "Healthy",
  delayed: "Delayed",
  silent: "Silent",
  collector_offline: "Collector offline",
  unknown: "Unknown",
  disabled: "Disabled",
};

function modelLabel(s: ReliabilitySource): string {
  if (!s.last_model_name) return "—";
  return s.last_model_version
    ? `${s.last_model_name} · ${s.last_model_version}`
    : s.last_model_name;
}

function intervalLabel(s: ReliabilitySource): string {
  if (!s.liveness_enabled) return "Off";
  const sec = s.expected_interval_seconds;
  return sec >= 60 ? `${Math.round(sec / 60)}m` : `${sec}s`;
}

export function CollectorSourcesTable({
  sources,
}: {
  sources: ReliabilitySource[];
}) {
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
                  <th className={TH}>Last seen</th>
                  <th className={TH}>Last data</th>
                  <th className={TH}>Expected interval</th>
                  <th className={TH}>Model</th>
                  <th className={TH}>Events</th>
                  <th className={TH}>Detection summaries</th>
                  <th className={TH}>Open issues</th>
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
                        title={s.health_message ?? undefined}
                      >
                        <StatusDot status={HEALTH_DOT[s.health_status]} />
                        {HEALTH_LABEL[s.health_status]}
                      </span>
                    </td>
                    <td className={TD}>
                      <RelativeTime value={s.last_seen_at} />
                    </td>
                    <td className={TD}>
                      <RelativeTime value={s.last_observation_at} />
                    </td>
                    <td className={TD}>{intervalLabel(s)}</td>
                    <td className={TD}>{modelLabel(s)}</td>
                    <td className={TD}>{s.event_count_total.toLocaleString()}</td>
                    <td className={TD}>
                      {s.detection_summary_count_total.toLocaleString()}
                    </td>
                    <td className={`${TD} font-bold`}>
                      {s.open_issue_count > 0 ? (
                        <span className="text-[#ff8f57]">{s.open_issue_count}</span>
                      ) : (
                        0
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

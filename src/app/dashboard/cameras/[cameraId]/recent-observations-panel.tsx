"use client";

import { Fragment, useState } from "react";
import { Activity, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import clsx from "clsx";
import { CopyButton } from "@/components/data/copy-button";
import { RelativeTime } from "@/components/data/relative-time";
import { UpstreamApiError, friendlyMessage } from "@/lib/api/errors";
import { useUpstreamList } from "@/lib/api/use-list";
import type {
  ObservationRecord,
  RecentObservationsResponse,
} from "@/lib/api/types";
import {
  buildRecentObservationsPath,
  DEFAULT_OBSERVATION_LIMIT,
  OBSERVATION_LIMITS,
  OBSERVATION_TYPES,
  summarizeObservation,
} from "./summarize-observation";

const CONTROL_CLASS =
  "rounded-lg bg-glass-bg border border-glass-stroke px-2.5 py-1.5 text-sm text-ink transition focus:outline-none focus:border-accent/60";

function typeLabel(type: string): string {
  return type.startsWith("processor.")
    ? type.slice("processor.".length)
    : type;
}

function shortId(value: string | null): string {
  if (!value) return "—";
  return value.length > 8 ? `${value.slice(0, 8)}…` : value;
}

/**
 * Recent processor observations for one camera (P5-B). Server-rendered initial
 * rows are handed in via `initialObservations`; the panel then refreshes on
 * demand (and optionally on a 5 s poll) through the dashboard proxy. No
 * `accountId` prop — the proxy injects account scoping, same as LatestFrameCard.
 */
export function RecentObservationsPanel({
  cameraId,
  initialObservations,
}: {
  cameraId: string;
  initialObservations: ObservationRecord[];
}) {
  const [type, setType] = useState<string>("all");
  const [limit, setLimit] = useState<number>(DEFAULT_OBSERVATION_LIMIT);
  const [pollingOn, setPollingOn] = useState(false);
  const [openRows, setOpenRows] = useState<Set<string>>(() => new Set());

  const queryType = type === "all" ? undefined : type;
  const path = buildRecentObservationsPath(cameraId, {
    type: queryType,
    limit,
  });
  const defaultPath = buildRecentObservationsPath(cameraId, {
    limit: DEFAULT_OBSERVATION_LIMIT,
  });

  const { data, error, isValidating, mutate } =
    useUpstreamList<RecentObservationsResponse>(path, {
      refreshInterval: pollingOn ? 5_000 : 0,
      // Key-scoped: the server-rendered rows are the *default* view only.
      // Supplying them for a filtered key would flash unfiltered rows.
      fallbackData:
        path === defaultPath
          ? { observations: initialObservations }
          : undefined,
    });

  const observations = data?.observations ?? [];

  function toggleRow(id: string) {
    setOpenRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const errorText =
    error instanceof UpstreamApiError
      ? friendlyMessage(error)
      : "Couldn't load recent observations.";
  const emptyMessage = queryType
    ? `No ${typeLabel(queryType)} observations for this camera.`
    : "No processor observations recorded for this camera yet.";

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-accent mono">
            recent observations
          </p>
          <p className="text-sm text-ink-soft mt-1">
            {observations.length} shown
            {isValidating ? " · refreshing…" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            aria-label="Filter by observation type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={CONTROL_CLASS}
          >
            <option value="all">All types</option>
            {OBSERVATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {typeLabel(t)}
              </option>
            ))}
          </select>
          <select
            aria-label="Rows to show"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className={CONTROL_CLASS}
          >
            {OBSERVATION_LIMITS.map((n) => (
              <option key={n} value={n}>
                {n} rows
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setPollingOn((p) => !p)}
            aria-pressed={pollingOn}
            className={clsx(
              "rounded-lg border px-2.5 py-1.5 text-sm transition",
              pollingOn
                ? "border-accent/60 text-accent bg-accent/10"
                : "border-glass-stroke text-ink-soft hover:text-ink",
            )}
          >
            {pollingOn ? "Live: on" : "Live: off"}
          </button>
          <button
            type="button"
            onClick={() => void mutate()}
            disabled={isValidating}
            className="inline-flex items-center gap-1.5 rounded-lg bg-glass-bg border border-glass-stroke px-2.5 py-1.5 text-sm text-ink hover:bg-white/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw
              className={clsx("w-3.5 h-3.5", isValidating && "animate-spin")}
            />
            Refresh
          </button>
        </div>
      </div>

      {error && observations.length > 0 ? (
        <p className="text-xs text-[#e89e93] mb-2">
          Couldn&rsquo;t refresh — showing last results.
        </p>
      ) : null}

      {observations.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-mute mono text-[11px] uppercase tracking-wider border-b border-glass-stroke-2">
                <th className="py-2 pr-3 font-normal">Time</th>
                <th className="py-2 pr-3 font-normal">Type</th>
                <th className="py-2 pr-3 font-normal">Summary</th>
                <th className="py-2 pr-3 font-normal">Session</th>
                <th className="py-2 pr-3 font-normal">Processor</th>
                <th className="py-2 font-normal text-right">JSON</th>
              </tr>
            </thead>
            <tbody>
              {observations.map((obs) => {
                const open = openRows.has(obs.id);
                return (
                  <Fragment key={obs.id}>
                    <tr className="border-b border-glass-stroke-2/60">
                      <td className="py-2 pr-3 align-top whitespace-nowrap">
                        <RelativeTime
                          value={obs.observed_at}
                          className="text-ink-soft"
                        />
                      </td>
                      <td className="py-2 pr-3 align-top">
                        <span
                          className="mono text-xs text-ink"
                          title={obs.type}
                        >
                          {typeLabel(obs.type)}
                        </span>
                      </td>
                      <td className="py-2 pr-3 align-top text-ink-soft">
                        {summarizeObservation(obs)}
                      </td>
                      <td className="py-2 pr-3 align-top whitespace-nowrap">
                        <span className="mono text-xs text-ink-soft inline-flex items-center gap-1.5">
                          {shortId(obs.stream_session_id)}
                          <CopyButton
                            value={obs.stream_session_id}
                            label="session id"
                          />
                        </span>
                      </td>
                      <td className="py-2 pr-3 align-top whitespace-nowrap">
                        <span className="mono text-xs text-ink-mute">
                          {shortId(obs.processor_id)}
                        </span>
                      </td>
                      <td className="py-2 align-top text-right">
                        <button
                          type="button"
                          onClick={() => toggleRow(obs.id)}
                          aria-expanded={open}
                          aria-label={
                            open ? "Hide raw JSON" : "View raw JSON"
                          }
                          className="inline-flex items-center gap-1 text-[11px] mono uppercase tracking-wider text-ink-mute hover:text-ink transition"
                        >
                          {open ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronRight className="w-3 h-3" />
                          )}
                          JSON
                        </button>
                      </td>
                    </tr>
                    {open ? (
                      <tr className="border-b border-glass-stroke-2/60">
                        <td colSpan={6} className="pb-3">
                          <pre className="mono text-[11px] text-ink-soft bg-black/20 rounded-lg p-3 overflow-x-auto max-h-64">
                            {JSON.stringify(obs.payload, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-sm text-ink-soft">{errorText}</p>
          <button
            type="button"
            onClick={() => void mutate()}
            className="mt-3 text-[11px] mono uppercase tracking-wider text-ink-mute hover:text-ink transition"
          >
            Retry
          </button>
        </div>
      ) : data === undefined && isValidating ? (
        <div className="text-center py-12">
          <RefreshCw className="w-6 h-6 mx-auto text-ink-mute animate-spin" />
          <p className="text-sm text-ink-mute mt-3">Loading…</p>
        </div>
      ) : (
        <div className="text-center py-12">
          <Activity className="w-7 h-7 mx-auto text-ink-mute" />
          <p className="text-sm text-ink-soft mt-3">{emptyMessage}</p>
        </div>
      )}
    </div>
  );
}

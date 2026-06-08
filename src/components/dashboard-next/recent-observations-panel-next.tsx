"use client";

import { Fragment, useMemo, useState } from "react";
import { Activity, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import clsx from "clsx";
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
} from "@/lib/perception/summarize-observation";
import { ObservationSummaryTiles } from "./observation-summary-tiles";

const SELECT_CLASS =
  "rounded-full border border-black/10 bg-white px-2.5 py-1.5 text-sm text-black transition focus:border-[var(--dn-creek-mid)] focus:outline-none";

const CHIP_ACTIVE =
  "border-[var(--dn-creek-mid)]/40 bg-[var(--dn-creek-mid)]/15 text-[var(--dn-creek-deep)]";
const CHIP_INACTIVE =
  "border-black/10 bg-white text-[var(--dn-text-50)] hover:text-black hover:bg-black/[0.04]";

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
 * Dashboard-next port of the Recent Observations panel (P5-B). Server-rendered
 * initial rows are handed in via `initialObservations`; the panel then
 * refreshes on demand (and optionally on a 5 s poll) through the dashboard
 * proxy. No `accountId` prop — the proxy injects account scoping.
 *
 * All raw observation/debug fields stay accessible: processor id, package id,
 * stream session id, type, timestamp, and a per-row JSON expand for the full
 * payload. Reliability work needs this — separation by tab is the IA fix, not
 * hiding fields.
 */
export function RecentObservationsPanelNext({
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

  // Stable empty-array identity when data is undefined so the `rows` memo below
  // (and SWR deep-compared data) don't recompute on every render.
  const observations = useMemo(() => data?.observations ?? [], [data]);

  // Derive the always-rendered per-row fields once per observation set rather
  // than on every re-render (row expand/collapse, refresh spinner, and 5 s
  // polls that return deep-equal data all re-render this component, but the
  // rows themselves are unchanged). JSON.stringify stays lazy in the expanded
  // branch below so unopened payloads are never stringified.
  const rows = useMemo(
    () =>
      observations.map((obs) => ({
        obs,
        summary: summarizeObservation(obs),
        typeText: typeLabel(obs.type),
        sessionShort: shortId(obs.stream_session_id),
        processorShort: shortId(obs.processor_id),
      })),
    [observations],
  );

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
    <div className="space-y-4 md:space-y-5">
      <ObservationSummaryTiles observations={observations} />

      <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
            recent observations
          </p>
          <p className="mt-1 text-sm text-[var(--dn-text-50)]">
            {observations.length} shown
            {isValidating ? " · refreshing…" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter by observation type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={SELECT_CLASS}
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
            className={SELECT_CLASS}
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
              "rounded-full border px-2.5 py-1.5 text-sm transition",
              pollingOn ? CHIP_ACTIVE : CHIP_INACTIVE,
            )}
          >
            {pollingOn ? "Live: on" : "Live: off"}
          </button>
          <button
            type="button"
            onClick={() => void mutate()}
            disabled={isValidating}
            className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-2.5 py-1.5 text-sm text-black transition hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              className={clsx("h-3.5 w-3.5", isValidating && "animate-spin")}
            />
            Refresh
          </button>
        </div>
      </div>

      {error && observations.length > 0 ? (
        <p className="mb-2 text-xs text-[#c0473b]">
          Couldn&rsquo;t refresh — showing last results.
        </p>
      ) : null}

      {observations.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left text-[11px] font-mono uppercase tracking-wider text-[var(--dn-text-50)]">
                <th className="py-2 pr-3 font-normal">Time</th>
                <th className="py-2 pr-3 font-normal">Type</th>
                <th className="py-2 pr-3 font-normal">Summary</th>
                <th className="py-2 pr-3 font-normal">Session</th>
                <th className="py-2 pr-3 font-normal">Processor</th>
                <th className="py-2 text-right font-normal">JSON</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ obs, summary, typeText, sessionShort, processorShort }) => {
                const open = openRows.has(obs.id);
                return (
                  <Fragment key={obs.id}>
                    <tr className="border-b border-black/5">
                      <td className="py-2 pr-3 align-top whitespace-nowrap">
                        <RelativeTime
                          value={obs.observed_at}
                          className="text-[var(--dn-text-50)]"
                        />
                      </td>
                      <td className="py-2 pr-3 align-top">
                        <span
                          className="font-mono text-xs text-black"
                          title={obs.type}
                        >
                          {typeText}
                        </span>
                      </td>
                      <td className="py-2 pr-3 align-top text-black/80">
                        {summary}
                      </td>
                      <td className="py-2 pr-3 align-top whitespace-nowrap">
                        <span className="font-mono text-xs text-[var(--dn-text-50)]">
                          {sessionShort}
                        </span>
                      </td>
                      <td className="py-2 pr-3 align-top whitespace-nowrap">
                        <span className="font-mono text-xs text-[var(--dn-text-50)]">
                          {processorShort}
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
                          className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)] transition hover:text-black"
                        >
                          {open ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                          JSON
                        </button>
                      </td>
                    </tr>
                    {open ? (
                      <tr className="border-b border-black/5">
                        <td colSpan={6} className="pb-3">
                          <pre className="max-h-64 overflow-x-auto rounded-lg bg-black/[0.04] p-3 font-mono text-[11px] text-black/80">
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
        <div className="py-12 text-center">
          <p className="text-sm text-[var(--dn-text-50)]">{errorText}</p>
          <button
            type="button"
            onClick={() => void mutate()}
            className="mt-3 font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)] transition hover:text-black"
          >
            Retry
          </button>
        </div>
      ) : data === undefined && isValidating ? (
        <div className="py-12 text-center">
          <RefreshCw className="mx-auto h-6 w-6 animate-spin text-[var(--dn-text-50)]" />
          <p className="mt-3 text-sm text-[var(--dn-text-50)]">Loading…</p>
        </div>
      ) : (
        <div className="py-12 text-center">
          <Activity className="mx-auto h-7 w-7 text-[var(--dn-text-50)]" />
          <p className="mt-3 text-sm text-[var(--dn-text-50)]">{emptyMessage}</p>
        </div>
      )}
      </div>
    </div>
  );
}

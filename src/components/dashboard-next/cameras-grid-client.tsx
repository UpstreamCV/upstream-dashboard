"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { CameraCard } from "./camera-card";
import { CameraBucketStatTile } from "./cameras/camera-bucket-stat-tile";
import {
  CameraControls,
  type CameraFilter,
  type CameraSort,
  type CameraView,
} from "./cameras/camera-controls";
import { CameraPagination } from "./cameras/camera-pagination";
import {
  BUCKET_ORDER,
  deriveCameraBucket,
  type CameraBucket,
} from "./dn-status";
import { useUpstreamList } from "@/lib/api/use-list";
import { isDemoMode } from "@/lib/demo/demo-mode";
import { AddCameraPanel } from "@/lib/demo/add-camera-panel";
import type {
  Agent,
  AgentListResponse,
  Alert,
  AlertListResponse,
  Camera,
  CameraListResponse,
} from "@/lib/api/types";

// Stateful body for the DarkMode cameras page (Figma frame 409:403). Polls
// three lists through the proxy:
//   • /v1/cameras — live status. Demo polls fast (1.5s) so a freshly-added
//     camera appears right after the add flow; prod keeps the 10s default.
//   • /v1/agents  — names + last_seen_at (heartbeat proxy). Names rarely
//     change, so 60s (6× slower than camera status).
//   • /v1/alerts?status=open — drives the "needs review" bucket. 10s default.
// The server hands in initialData for instant first paint.
//
// The fleet is grouped into the four Figma buckets via
// deriveCameraBucket(status, hasOpenAlert). Counts per bucket feed the chips +
// summary tiles; the filtered/sorted set is paginated client-side (pageSize 6).

const PAGE_SIZE = 6;

const SORT_ORDER: Record<CameraBucket, number> = {
  offline: 0,
  review: 1,
  live: 2,
  idle: 3,
};

export function CamerasGridClient({
  initialCameras,
  initialAgents,
  initialAlerts,
}: {
  initialCameras: Camera[];
  initialAgents: Agent[];
  initialAlerts: Alert[];
}) {
  const demo = isDemoMode();
  const [showAdd, setShowAdd] = useState(false);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CameraFilter>("all");
  const [sort, setSort] = useState<CameraSort>("status");
  const [view, setView] = useState<CameraView>("grid");
  const [page, setPage] = useState(1);

  const cameras =
    useUpstreamList<CameraListResponse>("/v1/cameras", {
      fallbackData: { cameras: initialCameras },
      refreshInterval: demo ? 1500 : undefined,
    }).data?.cameras ?? initialCameras;

  const agents =
    useUpstreamList<AgentListResponse>("/v1/agents", {
      refreshInterval: 60_000,
      fallbackData: { agents: initialAgents },
    }).data?.agents ?? initialAgents;

  // Open alerts → the "needs review" bucket. Tolerant of an empty/missing
  // surface (fallbackData seeds the server's pre-filtered open list).
  const openAlerts =
    useUpstreamList<AlertListResponse>("/v1/alerts?status=open&limit=200", {
      refreshInterval: 10_000,
      fallbackData: { alerts: initialAlerts },
    }).data?.alerts ?? initialAlerts;

  const agentsById = useMemo(
    () => new Map(agents.map((a) => [a.id, a])),
    [agents],
  );

  // Cameras with at least one OPEN alert (status guarded — the open filter is
  // server-side, but re-check so a tolerant/empty response can't misclassify).
  const openAlertCameraIds = useMemo(() => {
    const set = new Set<string>();
    for (const a of openAlerts) {
      if (a.status === "open") set.add(a.camera_id);
    }
    return set;
  }, [openAlerts]);

  // Decorate every camera with its derived bucket + heartbeat proxy once.
  const decorated = useMemo(
    () =>
      cameras.map((camera) => {
        const agent =
          camera.agent_id !== null
            ? agentsById.get(camera.agent_id)
            : undefined;
        return {
          camera,
          bucket: deriveCameraBucket(
            camera.status,
            openAlertCameraIds.has(camera.id),
          ),
          agentName:
            camera.agent_id === null
              ? "unassigned"
              : (agent?.name ?? camera.agent_id.slice(0, 8)),
          lastHeartbeat: agent?.last_seen_at ?? null,
        };
      }),
    [cameras, agentsById, openAlertCameraIds],
  );

  const total = decorated.length;

  const counts = useMemo(() => {
    const c: Record<CameraBucket, number> = {
      live: 0,
      review: 0,
      offline: 0,
      idle: 0,
    };
    for (const d of decorated) c[d.bucket] += 1;
    return c;
  }, [decorated]);

  // Filter → search → sort. Sorting "status" follows the triage order
  // (offline → review → live → idle); "name" alpha; "updated" newest first.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = decorated;
    if (filter !== "all") rows = rows.filter((d) => d.bucket === filter);
    if (q) {
      rows = rows.filter((d) => {
        const c = d.camera;
        return (
          c.name.toLowerCase().includes(q) ||
          (c.external_id?.toLowerCase().includes(q) ?? false) ||
          d.agentName.toLowerCase().includes(q)
        );
      });
    }
    const sorted = [...rows];
    if (sort === "name") {
      sorted.sort((a, b) => a.camera.name.localeCompare(b.camera.name));
    } else if (sort === "updated") {
      sorted.sort(
        (a, b) =>
          new Date(b.camera.updated_at).getTime() -
          new Date(a.camera.updated_at).getTime(),
      );
    } else {
      sorted.sort((a, b) => {
        const d = SORT_ORDER[a.bucket] - SORT_ORDER[b.bucket];
        return d !== 0 ? d : a.camera.name.localeCompare(b.camera.name);
      });
    }
    return sorted;
  }, [decorated, filter, query, sort]);

  // Pagination, clamped so a filter/sort change that shrinks the list can't
  // strand the view on an empty page.
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageRows = visible.slice(pageStart, pageStart + PAGE_SIZE);
  const rangeStart = visible.length === 0 ? 0 : pageStart + 1;
  const rangeEnd = pageStart + pageRows.length;

  // Reset to page 1 whenever the working set changes (filter/sort/search).
  function resetTo<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Search cameras (LEFT, wired to the client filter) + Add camera
          (RIGHT). Stacks on narrow screens. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="dn-glow-soft relative w-full rounded-full sm:w-[clamp(220px,26vw,340px)]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-white/75"
            aria-hidden
          />
          <input
            type="search"
            aria-label="Search cameras"
            placeholder="Search cameras…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            className="dn-field relative z-[1] w-full py-2 pl-9 pr-4 text-[clamp(0.85rem,1vw,1rem)]"
          />
        </div>
        {/* Add camera — Figma: transparent fill + 1.5px white-40% border pill. */}
        <Link
          href="/cameras/new"
          className="dn-glow-soft inline-flex shrink-0 items-center gap-2 self-start rounded-full px-4 py-2 font-bold text-white sm:self-auto"
          style={{ border: "1.5px solid rgba(255,255,255,0.4)" }}
        >
          <Plus className="relative z-10 h-4 w-4" aria-hidden />
          <span className="relative z-10">Add camera</span>
        </Link>
      </div>

      {/* (A) Controls */}
      {cameras.length > 0 && (
        <CameraControls
          filter={filter}
          onFilterChange={resetTo(setFilter)}
          counts={counts}
          total={total}
          sort={sort}
          onSortChange={resetTo(setSort)}
          view={view}
          onViewChange={setView}
        />
      )}

      {/* (B) Summary stat tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 md:gap-4">
        {BUCKET_ORDER.map((b) => (
          <CameraBucketStatTile
            key={b}
            bucket={b}
            count={counts[b]}
            total={total}
          />
        ))}
      </div>

      {cameras.length === 0 ? (
        <div className="dn-tile p-[clamp(1.5rem,3vw,2.5rem)] text-center">
          <p className="font-bold text-[clamp(1rem,1.4vw,1.3rem)]">
            {demo ? "Connect your first camera" : "No cameras registered yet"}
          </p>
          <p className="mt-2 text-[var(--dn-text-50)] text-[clamp(0.85rem,1vw,1rem)]">
            {demo
              ? "Install the agent on a camera host — it registers and appears here automatically."
              : "Once an upstream-agent registers a camera, it will appear here."}
          </p>
          {demo ? (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="dn-btn dn-glow-soft mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 font-bold"
            >
              <Plus className="relative z-10 h-4 w-4" />
              <span className="relative z-10">Add camera</span>
            </button>
          ) : null}
        </div>
      ) : visible.length === 0 ? (
        // Cameras exist, but the active filter/search matched none.
        <div className="dn-card p-[clamp(1.5rem,3vw,2.5rem)] text-center">
          <p className="font-bold text-[clamp(0.95rem,1.3vw,1.2rem)] text-white">
            No cameras match this view
          </p>
          <p className="mt-2 text-[var(--dn-text-50)] text-[clamp(0.82rem,1vw,0.95rem)]">
            Try a different status filter or clear your search.
          </p>
        </div>
      ) : (
        <>
          {/* (C) Card grid / list */}
          <div
            className={
              view === "list"
                ? "grid grid-cols-1 gap-3 md:gap-4"
                : "grid grid-cols-1 gap-4 xl:grid-cols-2 md:gap-5"
            }
          >
            {pageRows.map((d) => (
              <CameraCard
                key={d.camera.id}
                camera={d.camera}
                agentName={d.agentName}
                bucket={d.bucket}
                lastHeartbeat={d.lastHeartbeat}
                previewSrc={demo ? "/demo/dock-frame.jpg" : undefined}
                list={view === "list"}
              />
            ))}
          </div>

          <CameraPagination
            page={safePage}
            pageCount={pageCount}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            total={visible.length}
            onPageChange={setPage}
          />
        </>
      )}

      {showAdd ? <AddCameraPanel onClose={() => setShowAdd(false)} /> : null}
    </div>
  );
}

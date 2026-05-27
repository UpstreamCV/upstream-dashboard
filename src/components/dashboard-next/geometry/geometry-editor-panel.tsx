"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import clsx from "clsx";
import {
  MousePointer2,
  PencilLine,
  Save,
  Trash2,
  Undo2,
} from "lucide-react";
import { saveGeometryAction } from "@/app/dashboard-next/(app)/cameras/[cameraId]/configure/geometry/actions";
import type { GeometryConfig, GeometryLine, LatestFrame } from "@/lib/api/types";
import {
  type GeometryValidationIssue,
  createGeometryValidationSummary,
  validateGeometryConfig,
} from "@/lib/perception/geometry-schema";
import { FrameCanvas } from "@/components/dashboard-next/geometry/frame-canvas";
import { GeometryEditorSvg } from "@/components/dashboard-next/geometry/geometry-editor-svg";
import {
  type EditorShapesState,
  type EditorTool,
  type NormalizedPoint,
  clampNormalized,
  createLine,
  editorStateToGeometryConfig,
  geometryConfigToEditorState,
} from "@/components/dashboard-next/geometry/geometry-editor-model";

// P6-B1 — the geometry editor's brains. Owns ALL editor-local state and
// drives the Server Action. Composes FrameCanvas (image + coord
// translation) with GeometryEditorSvg (shape rendering + per-element
// pointer events). The persistence boundary is enforced by
// `editorStateToGeometryConfig` from geometry-editor-model.ts — only the
// `GeometryConfig` shape is ever sent to the api-server.
//
// Scope: line authoring only. Existing ROIs render read-only inside
// GeometryEditorSvg and pass through saves unchanged via the model's
// passthrough — see ROI-preservation test in geometry-editor-model.test.ts.

interface GeometryEditorPanelProps {
  cameraId: string;
  latestFrame: LatestFrame;
  initialConfig: GeometryConfig;
  // True when the server returned the probe-default (is_default: true) — we
  // ignore those starter shapes and let the operator author from scratch.
  startEmpty: boolean;
}

type Draft = { start: NormalizedPoint; current: NormalizedPoint };

export function GeometryEditorPanel({
  cameraId,
  latestFrame,
  initialConfig,
  startEmpty,
}: GeometryEditorPanelProps) {
  const router = useRouter();

  // Snapshot the initial editor state once. Discard reverts to this; the
  // memo prevents accidental re-derivation on every render.
  const initialShapes = useMemo<EditorShapesState>(
    () =>
      geometryConfigToEditorState(initialConfig, {
        ignoreDefault: startEmpty,
      }),
    [initialConfig, startEmpty],
  );

  const [shapes, setShapes] = useState<EditorShapesState>(initialShapes);
  const [tool, setTool] = useState<EditorTool>("select");
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveIssues, setSaveIssues] = useState<GeometryValidationIssue[]>([]);
  const [saving, startTransition] = useTransition();

  // Escape cancels an in-flight draft without finalizing.
  useEffect(() => {
    if (!draft) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDraft(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draft]);

  // --- canvas pointer handlers ---------------------------------------------

  const handleCanvasPointerDown = useCallback(
    (p: NormalizedPoint) => {
      // Draw tool: first click sets start, second click finalizes.
      if (tool === "draw") {
        if (!draft) {
          setDraft({ start: p, current: p });
          return;
        }
        // Reject zero-length lines (the api-server would 422 these anyway
        // through the points-out-of-range or duplicate-point rules; better
        // to silently skip than create garbage).
        if (
          Math.abs(p.x - draft.start.x) < 0.005 &&
          Math.abs(p.y - draft.start.y) < 0.005
        ) {
          return;
        }
        setShapes((prev) => {
          const fresh = createLine(draft.start, p, prev.lines);
          return { ...prev, lines: [...prev.lines, fresh] };
        });
        setDraft(null);
        setDirty(true);
        setSelectedLineId(null);
        setTool("select");
        return;
      }
      // Select tool: clicking background deselects.
      setSelectedLineId(null);
    },
    [tool, draft],
  );

  const handleCanvasPointerMove = useCallback(
    (p: NormalizedPoint) => {
      // Live-update the draft's second endpoint while drawing.
      if (tool === "draw" && draft) {
        setDraft({ start: draft.start, current: p });
      }
    },
    [tool, draft],
  );

  // --- endpoint drag (window-level listeners, mirroring scroll-area.tsx) ---

  const startEndpointDrag = useCallback(
    (lineId: string, endpoint: "a" | "b", e: React.PointerEvent) => {
      e.preventDefault();
      // Snapshot the FrameCanvas rect at drag-start. The endpoint handle
      // is INSIDE FrameCanvas, so `closest` finds the canvas container —
      // not the SVG (which doesn't carry pointer-event geometry we want).
      const canvas = (e.target as Element).closest(
        "[data-frame-canvas]",
      ) as HTMLElement | null;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();

      // Select the line so the toolbar's Delete button is enabled
      // immediately and the SVG visually highlights the dragged line.
      setSelectedLineId(lineId);

      const move = (ev: PointerEvent) => {
        const p = clampNormalized({
          x: rect.width === 0 ? 0 : (ev.clientX - rect.left) / rect.width,
          y: rect.height === 0 ? 0 : (ev.clientY - rect.top) / rect.height,
        });
        setShapes((prev) => updateLineEndpoint(prev, lineId, endpoint, p));
        setDirty(true);
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    },
    [],
  );

  // --- toolbar actions -----------------------------------------------------

  const handleDelete = useCallback(() => {
    if (!selectedLineId) return;
    setShapes((prev) => ({
      ...prev,
      lines: prev.lines.filter((l) => l.id !== selectedLineId),
    }));
    setSelectedLineId(null);
    setDirty(true);
  }, [selectedLineId]);

  const handleDiscard = useCallback(() => {
    setShapes(initialShapes);
    setSelectedLineId(null);
    setDraft(null);
    setSaveError(null);
    setSaveIssues([]);
    setDirty(false);
  }, [initialShapes]);

  const handleSave = useCallback(() => {
    const nextConfig = editorStateToGeometryConfig(shapes);

    // Client-side validation first — keeps a structurally broken save off
    // the network. The Server Action re-runs the same validator as
    // defense-in-depth.
    const issues = validateGeometryConfig(nextConfig);
    if (issues.length > 0) {
      const summary = createGeometryValidationSummary(issues);
      setSaveIssues(issues);
      setSaveError(
        summary.firstError?.message ?? "Fix validation issues before saving.",
      );
      return;
    }

    setSaveIssues([]);
    setSaveError(null);

    const form = new FormData();
    form.set("camera_id", cameraId);
    form.set("config", JSON.stringify(nextConfig));

    startTransition(async () => {
      const result = await saveGeometryAction(form);
      if (result.ok) {
        toast.success("Geometry saved");
        setDirty(false);
        // router.refresh() so the sidebar's server-rendered status panel
        // re-fetches and shows the bumped revision.
        router.refresh();
        return;
      }
      if (result.issues) {
        setSaveIssues(result.issues);
      }
      setSaveError(result.message);
      toast.error(result.message);
    });
  }, [cameraId, router, shapes]);

  const handleToolSelect = useCallback(() => {
    setTool("select");
    setDraft(null);
  }, []);

  const handleToolDraw = useCallback(() => {
    setTool("draw");
    setSelectedLineId(null);
  }, []);

  // --- render --------------------------------------------------------------

  const lineCount = shapes.lines.length;
  const roiCount = shapes.rois.length;

  return (
    <div className="space-y-3 md:space-y-4">
      <Toolbar
        tool={tool}
        dirty={dirty}
        saving={saving}
        selectedLineId={selectedLineId}
        lineCount={lineCount}
        roiCount={roiCount}
        onToolSelect={handleToolSelect}
        onToolDraw={handleToolDraw}
        onDelete={handleDelete}
        onDiscard={handleDiscard}
        onSave={handleSave}
      />

      <div data-frame-canvas>
        <FrameCanvas
          src={latestFrame.signed_url}
          alt={`Latest frame for camera ${cameraId}`}
          frameWidth={latestFrame.width}
          frameHeight={latestFrame.height}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          className={clsx(
            "rounded-xl",
            tool === "draw" ? "cursor-crosshair" : "cursor-default",
          )}
        >
          <GeometryEditorSvg
            lines={shapes.lines}
            rois={shapes.rois}
            selectedLineId={selectedLineId}
            draft={draft}
            onLineSelect={setSelectedLineId}
            onEndpointPointerDown={startEndpointDrag}
          />
        </FrameCanvas>
      </div>

      <Hint tool={tool} draft={draft} selectedLineId={selectedLineId} />

      {saveIssues.length > 0 ? (
        <ValidationList issues={saveIssues} />
      ) : saveError ? (
        <p
          className="rounded-lg border border-[#c0473b]/30 bg-[#c0473b]/[0.08] p-3 text-sm text-[#c0473b]"
          role="alert"
        >
          {saveError}
        </p>
      ) : null}
    </div>
  );
}

// --- toolbar ----------------------------------------------------------------

interface ToolbarProps {
  tool: EditorTool;
  dirty: boolean;
  saving: boolean;
  selectedLineId: string | null;
  lineCount: number;
  roiCount: number;
  onToolSelect: () => void;
  onToolDraw: () => void;
  onDelete: () => void;
  onDiscard: () => void;
  onSave: () => void;
}

function Toolbar({
  tool,
  dirty,
  saving,
  selectedLineId,
  lineCount,
  roiCount,
  onToolSelect,
  onToolDraw,
  onDelete,
  onDiscard,
  onSave,
}: ToolbarProps) {
  return (
    <div className="dn-tile flex flex-wrap items-center gap-2 p-2.5">
      <ToolChip
        active={tool === "select"}
        onClick={onToolSelect}
        icon={MousePointer2}
        label="Select"
      />
      <ToolChip
        active={tool === "draw"}
        onClick={onToolDraw}
        icon={PencilLine}
        label="Draw line"
      />
      <button
        type="button"
        onClick={onDelete}
        disabled={!selectedLineId}
        className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-2.5 py-1.5 text-sm text-black transition hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete line
      </button>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
          {lineCount} line{lineCount === 1 ? "" : "s"} · {roiCount} ROI
          {roiCount === 1 ? "" : "s"} (read-only)
        </span>
        {dirty ? (
          <span className="rounded-full bg-[#8a6d1f]/15 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-[#8a6d1f]">
            unsaved
          </span>
        ) : null}
        <button
          type="button"
          onClick={onDiscard}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-2.5 py-1.5 text-sm text-black transition hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Undo2 className="h-3.5 w-3.5" />
          Discard changes
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--dn-creek-mid)] px-3 py-1.5 text-sm font-bold text-white transition hover:bg-[var(--dn-creek-deep)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function ToolChip({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof MousePointer2;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-sm transition",
        active
          ? "border-[var(--dn-creek-mid)]/40 bg-[var(--dn-creek-mid)]/15 text-[var(--dn-creek-deep)]"
          : "border-black/10 bg-white text-[var(--dn-text-50)] hover:bg-black/[0.04] hover:text-black",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function Hint({
  tool,
  draft,
  selectedLineId,
}: {
  tool: EditorTool;
  draft: Draft | null;
  selectedLineId: string | null;
}) {
  let message: string;
  if (tool === "draw" && draft) {
    message = "Click to place the second endpoint. Esc cancels.";
  } else if (tool === "draw") {
    message = "Click on the frame to place the line's first endpoint.";
  } else if (selectedLineId) {
    message =
      "Drag an endpoint to move it, or use Delete line to remove this line.";
  } else {
    message = "Click a line to select it, or switch to Draw line to add one.";
  }
  return (
    <p className="text-xs text-[var(--dn-text-50)]">{message}</p>
  );
}

function ValidationList({ issues }: { issues: GeometryValidationIssue[] }) {
  return (
    <div
      className="rounded-lg border border-[#c0473b]/30 bg-[#c0473b]/[0.08] p-3"
      role="alert"
    >
      <p className="font-bold text-sm text-[#c0473b]">
        Fix these before saving
      </p>
      <ul className="mt-2 space-y-1 text-xs text-[#c0473b]">
        {issues.slice(0, 8).map((issue, idx) => (
          <li key={`${issue.code}-${idx}`} className="font-mono">
            {issue.path ? `${issue.path}: ` : ""}
            {issue.message}
          </li>
        ))}
        {issues.length > 8 ? (
          <li className="font-mono opacity-70">
            … and {issues.length - 8} more
          </li>
        ) : null}
      </ul>
    </div>
  );
}

// --- helpers ----------------------------------------------------------------

function updateLineEndpoint(
  state: EditorShapesState,
  lineId: string,
  endpoint: "a" | "b",
  p: NormalizedPoint,
): EditorShapesState {
  return {
    ...state,
    lines: state.lines.map((line) => {
      if (line.id !== lineId) return line;
      const next: GeometryLine = {
        ...line,
        points:
          endpoint === "a"
            ? [p, line.points[1]]
            : [line.points[0], p],
      };
      return next;
    }),
  };
}

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
  CheckCheck,
  MousePointer2,
  PencilLine,
  Pentagon,
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
  type SelectedGeometry,
  clampNormalized,
  createLine,
  createRoi,
  editorStateToGeometryConfig,
  geometryConfigToEditorState,
  updateRoiPoint,
} from "@/components/dashboard-next/geometry/geometry-editor-model";

// P6-B1 / P6-B2 — the geometry editor's brains. Owns ALL editor-local
// state and drives the Server Action. Composes FrameCanvas (image + coord
// translation) with GeometryEditorSvg (shape rendering + per-element
// pointer events). The persistence boundary is enforced by
// `editorStateToGeometryConfig` from geometry-editor-model.ts — only the
// `GeometryConfig` shape is ever sent to the api-server.
//
// Scope: line and polygon ROI authoring. Selection is shape-typed via
// SelectedGeometry so the toolbar / Delete button can adapt to either
// kind. Vertex / endpoint drag uses window-level pointer listeners
// (mirroring scroll-area.tsx).

interface GeometryEditorPanelProps {
  cameraId: string;
  latestFrame: LatestFrame;
  initialConfig: GeometryConfig;
  // True when the server returned the probe-default (is_default: true) —
  // we ignore those starter shapes and let the operator author from
  // scratch.
  startEmpty: boolean;
}

type LineDraft = { start: NormalizedPoint; current: NormalizedPoint };

// ROI draft accumulates placed vertices and tracks the cursor while
// hovering for the dashed preview. Once `points.length >= 3` the user
// can finalize via Finish button or by clicking the first vertex.
type RoiDraft = {
  points: NormalizedPoint[];
  current: NormalizedPoint | null;
};

export function GeometryEditorPanel({
  cameraId,
  latestFrame,
  initialConfig,
  startEmpty,
}: GeometryEditorPanelProps) {
  const router = useRouter();

  const initialShapes = useMemo<EditorShapesState>(
    () =>
      geometryConfigToEditorState(initialConfig, {
        ignoreDefault: startEmpty,
      }),
    [initialConfig, startEmpty],
  );

  const [shapes, setShapes] = useState<EditorShapesState>(initialShapes);
  const [tool, setTool] = useState<EditorTool>("select");
  const [selected, setSelected] = useState<SelectedGeometry>(null);
  const [lineDraft, setLineDraft] = useState<LineDraft | null>(null);
  const [roiDraft, setRoiDraft] = useState<RoiDraft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveIssues, setSaveIssues] = useState<GeometryValidationIssue[]>([]);
  const [saving, startTransition] = useTransition();

  // --- ROI draft finalization (used by both the Finish button and the
  // close-on-first-vertex SVG hit target) ---------------------------------

  const finalizeRoiDraft = useCallback(() => {
    setRoiDraft((draft) => {
      if (!draft || draft.points.length < 3) return draft;
      setShapes((prev) => {
        const fresh = createRoi(draft.points, prev.rois);
        const next = { ...prev, rois: [...prev.rois, fresh] };
        // Defer selection of the new ROI so the toolbar's Delete button
        // immediately points at it.
        setSelected({ kind: "roi", id: fresh.id });
        return next;
      });
      setDirty(true);
      setTool("select");
      return null;
    });
  }, []);

  const cancelRoiDraft = useCallback(() => setRoiDraft(null), []);

  // Keyboard shortcuts while a draft is in flight: Escape cancels either
  // draft; Backspace pops the last ROI vertex during ROI drawing.
  useEffect(() => {
    if (!lineDraft && !roiDraft) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLineDraft(null);
        setRoiDraft(null);
        return;
      }
      if (
        roiDraft &&
        (e.key === "Backspace" || e.key === "Delete") &&
        // Don't steal Backspace from a focused input (none in the editor
        // today, but a forward-looking guard).
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        setRoiDraft((draft) => {
          if (!draft) return draft;
          if (draft.points.length <= 1) return null;
          return { ...draft, points: draft.points.slice(0, -1) };
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lineDraft, roiDraft]);

  // --- canvas pointer handlers ---------------------------------------------

  const handleCanvasPointerDown = useCallback(
    (p: NormalizedPoint) => {
      if (tool === "draw") {
        if (!lineDraft) {
          setLineDraft({ start: p, current: p });
          return;
        }
        // Reject near-zero-length lines (api-server would reject too via
        // point-out-of-range adjacency; better to silently skip than
        // create garbage).
        if (
          Math.abs(p.x - lineDraft.start.x) < 0.005 &&
          Math.abs(p.y - lineDraft.start.y) < 0.005
        ) {
          return;
        }
        setShapes((prev) => {
          const fresh = createLine(lineDraft.start, p, prev.lines);
          return { ...prev, lines: [...prev.lines, fresh] };
        });
        setLineDraft(null);
        setDirty(true);
        setSelected(null);
        setTool("select");
        return;
      }

      if (tool === "draw-roi") {
        setRoiDraft((draft) => {
          if (!draft) return { points: [p], current: null };
          // Reject duplicate-adjacent points (a misclick at the same
          // spot). The api-server's coord validation would let these
          // through, but a degenerate polygon helps nobody.
          const last = draft.points[draft.points.length - 1];
          if (
            Math.abs(p.x - last.x) < 0.005 &&
            Math.abs(p.y - last.y) < 0.005
          ) {
            return draft;
          }
          return { ...draft, points: [...draft.points, p] };
        });
        return;
      }

      // Select tool: clicking background deselects.
      setSelected(null);
    },
    [tool, lineDraft],
  );

  const handleCanvasPointerMove = useCallback(
    (p: NormalizedPoint) => {
      if (tool === "draw" && lineDraft) {
        setLineDraft({ start: lineDraft.start, current: p });
        return;
      }
      if (tool === "draw-roi" && roiDraft) {
        setRoiDraft((draft) => (draft ? { ...draft, current: p } : draft));
      }
    },
    [tool, lineDraft, roiDraft],
  );

  // --- line endpoint + ROI vertex drag (window-level listeners) ------------

  const startEndpointDrag = useCallback(
    (lineId: string, endpoint: "a" | "b", e: React.PointerEvent) => {
      e.preventDefault();
      const canvas = (e.target as Element).closest(
        "[data-frame-canvas]",
      ) as HTMLElement | null;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();

      setSelected({ kind: "line", id: lineId });

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

  const startRoiVertexDrag = useCallback(
    (roiId: string, vertexIndex: number, e: React.PointerEvent) => {
      e.preventDefault();
      const canvas = (e.target as Element).closest(
        "[data-frame-canvas]",
      ) as HTMLElement | null;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();

      setSelected({ kind: "roi", id: roiId });

      const move = (ev: PointerEvent) => {
        const p = clampNormalized({
          x: rect.width === 0 ? 0 : (ev.clientX - rect.left) / rect.width,
          y: rect.height === 0 ? 0 : (ev.clientY - rect.top) / rect.height,
        });
        setShapes((prev) => updateRoiPoint(prev, roiId, vertexIndex, p));
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
    if (!selected) return;
    if (selected.kind === "line") {
      const id = selected.id;
      setShapes((prev) => ({
        ...prev,
        lines: prev.lines.filter((l) => l.id !== id),
      }));
    } else {
      const id = selected.id;
      setShapes((prev) => ({
        ...prev,
        rois: prev.rois.filter((r) => r.id !== id),
      }));
    }
    setSelected(null);
    setDirty(true);
  }, [selected]);

  const handleDiscard = useCallback(() => {
    setShapes(initialShapes);
    setSelected(null);
    setLineDraft(null);
    setRoiDraft(null);
    setSaveError(null);
    setSaveIssues([]);
    setDirty(false);
  }, [initialShapes]);

  const handleSave = useCallback(() => {
    const nextConfig = editorStateToGeometryConfig(shapes);

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
    setLineDraft(null);
    setRoiDraft(null);
  }, []);

  const handleToolDraw = useCallback(() => {
    setTool("draw");
    setSelected(null);
    setRoiDraft(null);
  }, []);

  const handleToolDrawRoi = useCallback(() => {
    setTool("draw-roi");
    setSelected(null);
    setLineDraft(null);
    setRoiDraft({ points: [], current: null });
  }, []);

  // --- render --------------------------------------------------------------

  const lineCount = shapes.lines.length;
  const roiCount = shapes.rois.length;
  const draftCanFinish = (roiDraft?.points.length ?? 0) >= 3;
  const cursorClass =
    tool === "draw" || tool === "draw-roi" ? "cursor-crosshair" : "cursor-default";

  return (
    <div className="space-y-3 md:space-y-4">
      <Toolbar
        tool={tool}
        dirty={dirty}
        saving={saving}
        selected={selected}
        draftCanFinish={draftCanFinish}
        lineCount={lineCount}
        roiCount={roiCount}
        onToolSelect={handleToolSelect}
        onToolDraw={handleToolDraw}
        onToolDrawRoi={handleToolDrawRoi}
        onDelete={handleDelete}
        onDiscard={handleDiscard}
        onSave={handleSave}
        onFinishRoi={finalizeRoiDraft}
        onCancelRoi={cancelRoiDraft}
      />

      <div data-frame-canvas>
        <FrameCanvas
          src={latestFrame.signed_url}
          alt={`Latest frame for camera ${cameraId}`}
          frameWidth={latestFrame.width}
          frameHeight={latestFrame.height}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          className={clsx("rounded-xl", cursorClass)}
        >
          <GeometryEditorSvg
            lines={shapes.lines}
            rois={shapes.rois}
            selected={selected}
            lineDraft={lineDraft}
            roiDraft={roiDraft}
            onLineSelect={(id) => setSelected({ kind: "line", id })}
            onRoiSelect={(id) => setSelected({ kind: "roi", id })}
            onLineEndpointPointerDown={startEndpointDrag}
            onRoiVertexPointerDown={startRoiVertexDrag}
            onRoiDraftClose={finalizeRoiDraft}
          />
        </FrameCanvas>
      </div>

      <Hint
        tool={tool}
        lineDraft={lineDraft}
        roiDraft={roiDraft}
        selected={selected}
      />

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
  selected: SelectedGeometry;
  draftCanFinish: boolean;
  lineCount: number;
  roiCount: number;
  onToolSelect: () => void;
  onToolDraw: () => void;
  onToolDrawRoi: () => void;
  onDelete: () => void;
  onDiscard: () => void;
  onSave: () => void;
  onFinishRoi: () => void;
  onCancelRoi: () => void;
}

function Toolbar({
  tool,
  dirty,
  saving,
  selected,
  draftCanFinish,
  lineCount,
  roiCount,
  onToolSelect,
  onToolDraw,
  onToolDrawRoi,
  onDelete,
  onDiscard,
  onSave,
  onFinishRoi,
  onCancelRoi,
}: ToolbarProps) {
  const deleteLabel =
    selected?.kind === "roi"
      ? "Delete ROI"
      : selected?.kind === "line"
        ? "Delete line"
        : "Delete";
  const drawingRoi = tool === "draw-roi";

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
      <ToolChip
        active={tool === "draw-roi"}
        onClick={onToolDrawRoi}
        icon={Pentagon}
        label="Draw ROI"
      />

      {drawingRoi ? (
        <>
          <button
            type="button"
            onClick={onFinishRoi}
            disabled={!draftCanFinish}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--dn-creek-mid)] px-2.5 py-1.5 text-sm font-bold text-white transition hover:bg-[var(--dn-creek-deep)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Finish ROI
          </button>
          <button
            type="button"
            onClick={onCancelRoi}
            className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-2.5 py-1.5 text-sm text-black transition hover:bg-black/[0.04]"
          >
            Cancel
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={onDelete}
          disabled={!selected}
          className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-2.5 py-1.5 text-sm text-black transition hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {deleteLabel}
        </button>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
          {lineCount} line{lineCount === 1 ? "" : "s"} · {roiCount} ROI
          {roiCount === 1 ? "" : "s"}
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
  lineDraft,
  roiDraft,
  selected,
}: {
  tool: EditorTool;
  lineDraft: LineDraft | null;
  roiDraft: RoiDraft | null;
  selected: SelectedGeometry;
}) {
  let message: string;
  if (tool === "draw" && lineDraft) {
    message = "Click to place the second endpoint. Esc cancels.";
  } else if (tool === "draw") {
    message = "Click on the frame to place the line's first endpoint.";
  } else if (tool === "draw-roi") {
    const n = roiDraft?.points.length ?? 0;
    if (n === 0) {
      message = "Click to add polygon points. ROIs need at least 3 vertices.";
    } else if (n < 3) {
      message = `${n} of 3 minimum vertices placed. Keep clicking. Esc cancels, Backspace removes last.`;
    } else {
      message =
        "Click Finish ROI, or click the first vertex to close the polygon. Esc cancels, Backspace removes last.";
    }
  } else if (selected?.kind === "line") {
    message =
      "Drag an endpoint to move it, or use Delete line to remove this line.";
  } else if (selected?.kind === "roi") {
    message =
      "Drag a vertex to move it, or use Delete ROI to remove this ROI.";
  } else {
    message =
      "Click a shape to select it. Use Draw line or Draw ROI to add new geometry.";
  }
  return <p className="text-xs text-[var(--dn-text-50)]">{message}</p>;
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

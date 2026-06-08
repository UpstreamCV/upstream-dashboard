"use client";

// Model & Detection — inline card on the camera Configure index. Lets the
// operator pick the inference model and tune the detection thresholds applied
// to this camera. Optimistic save + toast, same posture as ProcessingToggleNext
// and the geometry editor (the Server Action short-circuits in demo mode).

import { useState, useTransition } from "react";
import { Cpu } from "lucide-react";
import { toast } from "sonner";
import { saveModelDetectionAction } from "@/app/dashboard/(app)/cameras/[cameraId]/configure/actions";

const MODELS = [
  { value: "people-counter@1", label: "people-counter@1 — balanced" },
  {
    value: "people-counter-highrecall@2",
    label: "people-counter-highrecall@2 — high recall",
  },
];

export function ModelDetectionCard({
  cameraId,
  initialModel = "people-counter@1",
  initialConfidence = 0.5,
  initialIou = 0.5,
}: {
  cameraId: string;
  initialModel?: string;
  initialConfidence?: number;
  initialIou?: number;
}) {
  const [model, setModel] = useState(initialModel);
  const [confidence, setConfidence] = useState(initialConfidence);
  const [iou, setIou] = useState(initialIou);
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await saveModelDetectionAction({
        cameraId,
        model,
        confidence,
        iou,
      });
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  return (
    <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
      <div className="flex items-start gap-4">
        <Cpu
          className="h-7 w-7 shrink-0 text-[var(--dn-creek-mid)]"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-[clamp(1rem,1.4vw,1.2rem)] text-black">
            Model &amp; Detection
          </h3>
          <p className="mt-1 text-sm text-[var(--dn-text-50)]">
            Choose the inference model and tune the detection thresholds applied
            to this camera.
          </p>

          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
                Model
              </span>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={isPending}
                className="mt-1.5 w-full rounded-lg border border-[var(--dn-text-15)] bg-white px-3 py-2 text-sm text-black focus:border-[var(--dn-creek-mid)] focus:outline-none disabled:opacity-60"
              >
                {MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>

            <ThresholdSlider
              label="Confidence threshold"
              value={confidence}
              onChange={setConfidence}
              disabled={isPending}
            />
            <ThresholdSlider
              label="IoU / NMS threshold"
              value={iou}
              onChange={setIou}
              disabled={isPending}
            />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--dn-creek-mid)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--dn-creek-deep)] disabled:opacity-60"
            >
              {isPending ? "Saving…" : "Save model settings"}
            </button>
            <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
              {model} · conf ≥ {confidence.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ThresholdSlider({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
        <span>{label}</span>
        <span className="text-black">{value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-full accent-[var(--dn-creek-mid)] disabled:opacity-60"
      />
    </label>
  );
}

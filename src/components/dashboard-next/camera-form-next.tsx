"use client";

// Camera create/edit form. Server-controlled stream settings: the account's
// limits are rendered inline as caps and the api-server enforces them — this
// form is UX, not the security boundary. `limit_exceeded.*` rejections from
// the server are surfaced verbatim via the action result.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { CameraFormResult } from "@/app/(dash)/(app)/cameras/new/actions";
import type { AccountLimits, Camera } from "@/lib/api/types";

export function CameraFormNext({
  action,
  limits,
  camera,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<CameraFormResult>;
  limits: AccountLimits;
  camera?: Camera;
  submitLabel: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const sourceTypes = limits.allowed_stream_types ?? ["webcam", "rtsp"];

  const onSubmit = (formData: FormData) => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await action(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      if (!camera) {
        router.push(`/cameras/${result.cameraId}`);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <form action={onSubmit} className="space-y-4">
      {camera ? (
        <input type="hidden" name="camera_id" value={camera.id} />
      ) : null}

      <Field label="Name">
        <input
          name="name"
          defaultValue={camera?.name ?? ""}
          placeholder="Front Door"
          required
          className="w-full rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-sm text-white transition focus:border-[var(--dn-creek-mid)] focus:outline-none"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Source type">
          <select
            name="source_type"
            defaultValue={camera?.source_type ?? sourceTypes[0]}
            className="w-full rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-sm text-white transition focus:border-[var(--dn-creek-mid)] focus:outline-none"
          >
            {sourceTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Source"
          hint="Webcam: device index (e.g. webcam:0). RTSP: rtsp:<url>."
        >
          <input
            name="device_path"
            defaultValue={camera?.device_path ?? ""}
            placeholder="webcam:0"
            className="w-full rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-sm text-white transition focus:border-[var(--dn-creek-mid)] focus:outline-none"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Field label={`Width (max ${limits.max_width})`}>
          <input
            name="default_width"
            type="number"
            min={1}
            max={limits.max_width}
            defaultValue={camera?.default_width ?? 1280}
            className="w-full rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-sm text-white transition focus:border-[var(--dn-creek-mid)] focus:outline-none"
          />
        </Field>
        <Field label={`Height (max ${limits.max_height})`}>
          <input
            name="default_height"
            type="number"
            min={1}
            max={limits.max_height}
            defaultValue={camera?.default_height ?? 720}
            className="w-full rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-sm text-white transition focus:border-[var(--dn-creek-mid)] focus:outline-none"
          />
        </Field>
        <Field label={`FPS (max ${limits.max_fps})`}>
          <input
            name="default_fps"
            type="number"
            min={1}
            max={limits.max_fps}
            defaultValue={camera?.default_fps ?? 30}
            className="w-full rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-sm text-white transition focus:border-[var(--dn-creek-mid)] focus:outline-none"
          />
        </Field>
        <Field label={`Bitrate kbps (max ${limits.max_bitrate_kbps})`}>
          <input
            name="default_bitrate_kbps"
            type="number"
            min={1}
            max={limits.max_bitrate_kbps}
            defaultValue={camera?.default_bitrate_kbps ?? 3000}
            className="w-full rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-sm text-white transition focus:border-[var(--dn-creek-mid)] focus:outline-none"
          />
        </Field>
      </div>

      {error ? (
        <p role="alert" className="text-sm font-semibold text-red-500">
          {error}
        </p>
      ) : null}
      {saved && camera ? (
        <p className="text-sm font-semibold text-emerald-600">Saved.</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="dn-btn dn-glow-soft rounded-full px-5 py-2 font-bold disabled:opacity-60"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="block text-[11px] text-[var(--dn-text-50)]">{hint}</span>
      ) : null}
    </label>
  );
}

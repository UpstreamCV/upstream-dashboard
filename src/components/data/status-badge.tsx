import clsx from "clsx";

type Tone = "positive" | "warn" | "danger" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  positive:
    "bg-[rgba(95,184,134,0.14)] text-accent border-[rgba(95,184,134,0.35)]",
  warn:
    "bg-[rgba(212,201,138,0.14)] text-[#d4c98a] border-[rgba(212,201,138,0.4)]",
  danger:
    "bg-[rgba(225,90,76,0.16)] text-[#e89e93] border-[rgba(225,90,76,0.4)]",
  neutral:
    "bg-[rgba(245,241,231,0.06)] text-ink-soft border-glass-stroke",
};

const STATUS_TONE: Record<string, Tone> = {
  // agents/cameras
  active: "positive",
  online: "positive",
  streaming: "positive",
  approved: "positive",
  idle: "neutral",
  offline: "neutral",
  disabled: "neutral",
  ended: "neutral",
  expired: "neutral",
  // transitional
  validating: "warn",
  reconnecting: "warn",
  connecting: "warn",
  pending: "warn",
  // bad
  error: "danger",
  failed: "danger",
  rejected: "danger",
  revoked: "danger",
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const tone = STATUS_TONE[status] ?? "neutral";
  return (
    <span
      role="status"
      aria-label={`Status: ${status}`}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] tracking-wide mono uppercase",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <span
        className={clsx(
          "w-1.5 h-1.5 rounded-full",
          tone === "positive" && "bg-accent",
          tone === "warn" && "bg-[#d4c98a]",
          tone === "danger" && "bg-[#e89e93]",
          tone === "neutral" && "bg-ink-mute",
        )}
      />
      {status}
    </span>
  );
}

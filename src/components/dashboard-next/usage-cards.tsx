import { USAGE_STATE_LABELS } from "@/lib/usage/usage-format";

// Small presentational cards shared by the Plan & Usage and Billing pages
// (factored out when /billing split into /plan-usage + /billing so both could
// reuse them without duplicating markup).

const STATE_CHIP: Record<string, string> = {
  ok: "bg-white/[0.05] text-white/60",
  near_limit: "bg-[#8a6d1f]/15 text-[#8a6d1f]",
  at_limit: "bg-red-700/10 text-red-700",
  over_limit: "bg-red-700/15 text-red-700",
};

export function StateChip({ state }: { state: string }) {
  return (
    <span
      className={
        "rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide " +
        (STATE_CHIP[state] ?? STATE_CHIP.ok)
      }
    >
      {USAGE_STATE_LABELS[state as keyof typeof USAGE_STATE_LABELS] ?? state}
    </span>
  );
}

export function CountCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.05] p-3">
      <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-white">
        {value.toLocaleString()}
      </p>
      <p className="mt-0.5 text-xs text-[var(--dn-text-50)]">{hint}</p>
    </div>
  );
}

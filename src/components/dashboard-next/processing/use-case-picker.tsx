"use client";

import clsx from "clsx";
import {
  getUseCase,
  USE_CASES,
  type UseCaseId,
} from "@/lib/perception/package-recommendation";

// P5-I guided setup — "what do you want this camera to do?". Selecting a use
// case drives the metadata-driven package recommendation. Optional: with none
// selected, the Processing tab behaves exactly as it did in P5-H.

export function UseCasePicker({
  selected,
  onSelect,
}: {
  selected: UseCaseId | null;
  onSelect: (id: UseCaseId | null) => void;
}) {
  const selectedDef = selected ? getUseCase(selected) : undefined;

  return (
    <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
      <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
        guided setup
      </p>
      <h2 className="mt-1 font-bold text-[clamp(1.05rem,1.5vw,1.4rem)] text-white">
        What do you want this camera to do?
      </h2>
      <p className="mt-1.5 text-sm text-[var(--dn-text-50)]">
        Pick a use case and we&rsquo;ll recommend a package. Optional — you can
        still browse every package below.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {USE_CASES.map((uc) => {
          const active = uc.id === selected;
          return (
            <button
              key={uc.id}
              type="button"
              onClick={() => onSelect(active ? null : uc.id)}
              aria-pressed={active}
              title={uc.description}
              className={clsx(
                "rounded-full px-3 py-1.5 text-sm font-bold transition",
                active
                  ? "bg-[var(--dn-creek-mid)] text-white"
                  : "border border-white/15 bg-white/[0.06] text-white/80 hover:border-[var(--dn-creek-mid)] hover:text-white",
              )}
            >
              {uc.label}
            </button>
          );
        })}
      </div>
      {selectedDef ? (
        <p className="mt-2.5 text-xs text-[var(--dn-text-50)]">
          {selectedDef.description} Packages below are ranked for this use case.
        </p>
      ) : null}
    </div>
  );
}

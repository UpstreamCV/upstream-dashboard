"use client";

import { useEffect, useId, useRef, useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown } from "lucide-react";
import type { ModelOption } from "@/lib/perception/advanced-resolution";
import { ModelStatLine } from "./model-stats";

// P5-L — rich model picker. A button trigger (showing the selected model + its
// headline stats) that opens a listbox of all models, each row showing stats +
// status/BYOM badges so the operator compares in place. Accessible: the trigger
// is aria-haspopup=listbox; options are role=option; ArrowUp/Down roves focus;
// Enter/click selects; Escape / click-outside closes.

function Badges({ model }: { model: ModelOption }) {
  const status = model.representative.status;
  return (
    <span className="flex shrink-0 items-center gap-1">
      {status === "experimental" ? (
        <span className="rounded-full bg-[var(--dn-orange-soft)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--dn-orange)]">
          exp
        </span>
      ) : null}
      {!model.firstParty ? (
        <span
          className="rounded-full bg-[var(--dn-yellow-soft)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--dn-yellow)]"
          title="Bring your own license — not an Upstream-provided model"
        >
          BYOM
        </span>
      ) : null}
    </span>
  );
}

export function ModelPicker({
  models,
  selectedModelId,
  onSelect,
}: {
  models: ModelOption[];
  selectedModelId: string | null;
  onSelect: (modelId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const listId = useId();

  const selected = models.find((m) => m.modelId === selectedModelId) ?? null;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      const idx = Math.max(
        0,
        models.findIndex((m) => m.modelId === selectedModelId),
      );
      optionRefs.current[idx]?.focus();
    }
  }, [open, models, selectedModelId]);

  const choose = (modelId: string) => {
    onSelect(modelId);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onOptionKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      optionRefs.current[Math.min(index + 1, models.length - 1)]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      optionRefs.current[Math.max(index - 1, 0)]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-left transition hover:border-[var(--dn-creek-mid)] focus:border-[var(--dn-creek-mid)] focus:outline-none"
      >
        <span className="min-w-0 flex-1">
          {selected ? (
            <>
              <span className="flex items-center gap-2">
                <span className="font-bold text-white">{selected.label}</span>
                <Badges model={selected} />
              </span>
              <ModelStatLine
                metrics={selected.metrics}
                computeTier={selected.representative.compute_tier}
              />
            </>
          ) : (
            <span className="text-[var(--dn-text-50)]">Choose a model…</span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[var(--dn-text-50)]" aria-hidden />
      </button>

      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-label="Detection model"
          className="dn-tile absolute z-20 mt-1 flex max-h-80 w-full flex-col gap-0.5 overflow-auto p-1"
        >
          {models.map((m, i) => {
            const isSel = m.modelId === selectedModelId;
            return (
              <button
                key={m.modelId}
                ref={(el) => {
                  optionRefs.current[i] = el;
                }}
                type="button"
                role="option"
                aria-selected={isSel}
                onClick={() => choose(m.modelId)}
                onKeyDown={(e) => onOptionKeyDown(e, i)}
                className={clsx(
                  "flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left transition",
                  isSel ? "bg-[var(--dn-creek-mid)]/15" : "hover:bg-white/[0.06]",
                )}
              >
                <Check
                  className={clsx(
                    "mt-0.5 h-3.5 w-3.5 shrink-0",
                    isSel ? "text-[var(--dn-creek-mid)]" : "text-transparent",
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-white">{m.label}</span>
                    <Badges model={m} />
                  </span>
                  <ModelStatLine
                    metrics={m.metrics}
                    computeTier={m.representative.compute_tier}
                  />
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Cpu, SlidersHorizontal, Sparkles, Sun } from "lucide-react";
import clsx from "clsx";
import { applyRecommendedModelAction, setDemoSceneAction } from "./actions";
import { demoSuggestedFixes, type DemoFixKind } from "./fixtures";

// Part 4: the actionable remediation surface on the Reliability tab. Lists the
// suggested fixes (a model swap, a parameter tweak, a scene change). Any Apply
// runs the same flow: advance to `fixing`, then auto-advance to `fixed` — so the
// recovery plays out from one click. (Single apply surface; the finding card no
// longer carries its own button in demo.)

const KIND_ICON: Record<DemoFixKind, typeof Cpu> = {
  model: Cpu,
  parameter: SlidersHorizontal,
  scene: Sun,
};
const KIND_LABEL: Record<DemoFixKind, string> = {
  model: "Model",
  parameter: "Parameter",
  scene: "Scene",
};

export function SuggestedFixesCard() {
  const router = useRouter();
  const [pending, start] = useTransition();

  const apply = () =>
    start(async () => {
      await applyRecommendedModelAction(); // → fixing
      toast.success("Applying high-recall model…");
      router.refresh();
      await new Promise((r) => setTimeout(r, 1600));
      await setDemoSceneAction("fixed"); // → fixed (auto-advance through recovery)
      router.refresh();
    });

  return (
    <section className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-full" style={{ background: "rgba(75,129,108,0.16)" }}>
          <Sparkles className="h-4 w-4" style={{ color: "#344c2c" }} />
        </span>
        <div>
          <h3 className="font-bold text-[clamp(1rem,1.2vw,1.15rem)] text-black">Suggested fixes</h3>
          <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
            Upstream applies it for you
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-2.5">
        {demoSuggestedFixes.map((fix) => {
          const Icon = KIND_ICON[fix.kind];
          return (
            <li
              key={fix.id}
              className={clsx(
                "flex flex-wrap items-center gap-3 rounded-xl border p-3",
                fix.primary
                  ? "border-[#4b816c]/45 bg-[rgba(75,129,108,0.08)]"
                  : "border-black/10",
              )}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: "rgba(75,129,108,0.14)" }}>
                <Icon className="h-4 w-4" style={{ color: "#344c2c" }} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[10px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
                    {KIND_LABEL[fix.kind]}
                  </span>
                  {fix.primary ? (
                    <span className="rounded-full bg-[#4b816c] px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold text-white">
                      Recommended
                    </span>
                  ) : null}
                  <span className="font-bold text-[0.95rem] text-black">{fix.title}</span>
                </div>
                <p className="mt-1 text-[clamp(0.8rem,0.95vw,0.9rem)] text-[var(--dn-text-50)]">
                  {fix.detail}
                </p>
              </div>
              <button
                type="button"
                onClick={apply}
                disabled={pending}
                className={clsx(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60",
                  fix.primary
                    ? "bg-[var(--dn-creek-deep)] text-white hover:opacity-90"
                    : "border border-black/15 bg-white text-black hover:bg-black/[0.04]",
                )}
              >
                {pending ? "Applying…" : "Apply"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

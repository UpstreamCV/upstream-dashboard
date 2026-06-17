import Link from "next/link";
import { StatusDot } from "../status-dot";

// Onboarding checklist for new accounts. Derived ENTIRELY from data the Home
// page already fetches (camera / agent / token counts) — no new backend, no new
// fetch. Renders nothing once every step is done, so it never clutters an
// established account. Steps are ordered the way you'd actually onboard: mint a
// token, connect an agent with it, then register a camera.
export function SetupChecklist({
  cameraCount,
  agentCount,
  tokenCount,
}: {
  cameraCount: number;
  agentCount: number;
  tokenCount: number;
}) {
  const steps = [
    {
      label: "Create an API token",
      done: tokenCount > 0,
      href: "/api-tokens",
      cta: "Create token",
    },
    {
      label: "Connect an agent",
      done: agentCount > 0,
      href: "/agents",
      cta: "View agents",
    },
    {
      label: "Add a camera",
      done: cameraCount > 0,
      href: "/cameras/new",
      cta: "Add camera",
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  return (
    <section className="dn-tile p-[clamp(1.25rem,2.2vw,2.25rem)]">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="font-bold text-[clamp(1.05rem,1.5vw,1.45rem)] text-white">
          Finish setting up
        </h2>
        <span className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
          {doneCount}/{steps.length} done
        </span>
      </header>
      <ul className="mt-4 flex flex-col gap-2.5">
        {steps.map((s) => (
          <li
            key={s.label}
            className="flex items-center justify-between gap-3"
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <StatusDot status={s.done ? "green" : "neutral"} />
              <span
                className={
                  s.done
                    ? "text-[var(--dn-text-50)] line-through"
                    : "font-bold text-white"
                }
              >
                {s.label}
              </span>
            </span>
            {s.done ? null : (
              <Link
                href={s.href}
                className="dn-btn dn-glow-soft shrink-0 rounded-full px-3 py-1.5 text-[clamp(0.78rem,0.95vw,0.9rem)] font-bold"
              >
                <span className="relative z-10">{s.cta}</span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

import {
  Database,
  GitBranch,
  Radio,
  Server,
  type LucideIcon,
} from "lucide-react";
import { StatusDot } from "../status-dot";

// System Status (Figma "Some Issues" / "All Good" — bottom-right card). The
// Figma mock shows per-service health + latencies, but there is NO
// service-health endpoint in upstream-api-server today. This card is therefore
// FULLY ILLUSTRATIVE: it renders the four service rows with a neutral dot and a
// "—" value, and the header reads "Monitoring coming soon". We deliberately do
// NOT show invented "Healthy 128ms" figures (HARD RULE: no fabricated
// telemetry) — the layout lights up once a real status endpoint exists.

const SERVICES: { name: string; icon: LucideIcon }[] = [
  { name: "API Server", icon: Server },
  { name: "Streaming", icon: Radio },
  { name: "Pipeline", icon: GitBranch },
  { name: "Database", icon: Database },
];

export function SystemStatus() {
  return (
    <section className="dn-tile flex flex-col gap-[clamp(0.5rem,1vw,1rem)] p-[clamp(1.25rem,2.2vw,2.25rem)] min-w-0">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-[clamp(1.05rem,1.5vw,1.45rem)] font-bold leading-tight">
          System Status
        </h2>
        <span className="font-bold text-[clamp(0.82rem,1vw,0.95rem)] text-[var(--dn-text-50)] shrink-0">
          Monitoring coming soon
        </span>
      </header>

      <ul className="flex flex-col">
        {SERVICES.map(({ name, icon: Icon }) => (
          <li
            key={name}
            className="flex items-center gap-3 py-[clamp(0.6rem,1vw,0.85rem)]"
          >
            <Icon
              className="h-[clamp(1.1rem,1.5vw,1.3rem)] w-[clamp(1.1rem,1.5vw,1.3rem)] text-[var(--dn-text-50)] shrink-0"
              strokeWidth={1.75}
              aria-hidden
            />
            <span className="flex-1 min-w-0 truncate font-bold text-[clamp(0.88rem,1.1vw,1.05rem)]">
              {name}
            </span>
            <StatusDot status="neutral" />
            <span className="shrink-0 w-6 text-right text-[clamp(0.85rem,1.05vw,1rem)] text-[var(--dn-text-50)] tabular-nums">
              —
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

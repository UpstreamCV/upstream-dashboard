"use client";

import Link from "next/link";
import { Activity, AlertTriangle, Cpu, Video } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useUpstreamList } from "@/lib/api/use-list";
import type { DashboardSummary } from "@/lib/api/types";

function Card({
  href,
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  value: number;
  sub?: string;
  tone: "positive" | "warn" | "danger" | "neutral";
}) {
  const toneColor =
    tone === "positive"
      ? "text-accent"
      : tone === "warn"
        ? "text-[#d4c98a]"
        : tone === "danger"
          ? "text-[#e89e93]"
          : "text-ink";
  return (
    <Link
      href={href}
      className="glass rounded-3xl px-6 py-5 flex flex-col gap-2 hover:bg-white/5 transition group"
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.18em] text-ink-mute mono">
          {label}
        </p>
        <Icon className="w-4 h-4 text-ink-mute group-hover:text-ink transition" />
      </div>
      <p className={`display text-4xl font-semibold ${toneColor}`}>{value}</p>
      <p className="text-xs text-ink-mute mono">{sub ?? " "}</p>
    </Link>
  );
}

export function OverviewCards({
  initialSummary,
}: {
  initialSummary: DashboardSummary;
}) {
  const { data } = useUpstreamList<DashboardSummary>("/v1/dashboard/summary", {
    fallbackData: initialSummary,
  });
  const s = data ?? initialSummary;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {/* Reads online_agents/total_agents. This card used to read
          `online_cameras`, which was correct only because that field secretly
          held the online-AGENT count; the api-server fixed it to mean cameras
          on 2026-07-16, which would have made this read "38 agents online" on a
          2-agent/40-camera account. The agent counts are now exposed directly. */}
      <Card
        href="/dashboard-legacy/agents"
        icon={Cpu}
        label="Agents online"
        value={s.online_agents}
        sub={`of ${s.total_agents} total agents`}
        tone="positive"
      />
      <Card
        href="/dashboard-legacy/cameras"
        icon={Video}
        label="Cameras streaming"
        value={s.streaming_cameras}
        sub={`of ${s.total_cameras} cameras`}
        tone="positive"
      />
      <Card
        href="/dashboard-legacy/stream-sessions"
        icon={Activity}
        label="Active sessions"
        value={s.active_streams}
        sub="approved or streaming"
        tone="positive"
      />
      <Card
        href="/dashboard-legacy/cameras"
        icon={AlertTriangle}
        label="Cameras with errors"
        value={s.cameras_with_errors}
        sub={
          s.validation_errors_24h > 0
            ? `${s.validation_errors_24h} validation errors (24h)`
            : s.cameras_with_errors === 0
              ? "all clear"
              : "needs attention"
        }
        tone={
          s.cameras_with_errors > 0 || s.validation_errors_24h > 0
            ? "danger"
            : "neutral"
        }
      />
    </div>
  );
}

import { RelativeTime } from "@/components/data/relative-time";
import type { StreamSession, StreamSessionState } from "@/lib/api/types";
import { StatusDot, type DotStatus } from "./status-dot";

// Stream sessions as rows (mirrors the prod sessions-table columns) but in the
// dashboard-next light vibe: a white .dn-tile holding a table, dot+word state,
// RelativeTime for started/ended. Horizontally scrollable on narrow screens.
// Server Component; the page scrolls vertically inside the layout's ScrollArea.

// Aligned with prod StatusBadge tones; approved shown amber (queued) to set it
// apart from live "streaming" in a dense list.
const STATE_DOT: Record<StreamSessionState, DotStatus> = {
  streaming: "green",
  approved: "yellow",
  ended: "neutral",
  expired: "neutral",
  failed: "red",
};
const STATE_TEXT: Record<StreamSessionState, string> = {
  streaming: "#3f7d4e",
  approved: "#8a6d1f",
  ended: "var(--dn-text-50)",
  expired: "var(--dn-text-50)",
  failed: "#c0473b",
};

function approvedSummary(s: StreamSession): string {
  const a = s.approved;
  return `${a.width}×${a.height} · ${a.fps} fps · ${a.codec} · ${a.bitrate_kbps} kbps`;
}

const short = (id: string) => `${id.slice(0, 8)}…`;

export function SessionsTable({
  sessions,
  cameraNames,
  agentNames,
}: {
  sessions: StreamSession[];
  cameraNames: Record<string, string>;
  agentNames: Record<string, string>;
}) {
  return (
    <div className="dn-tile overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[clamp(0.78rem,1vw,0.92rem)]">
          <thead>
            <tr className="text-[var(--dn-text-50)] [&>th]:whitespace-nowrap [&>th]:px-4 [&>th]:py-3 [&>th]:text-[0.72em] [&>th]:font-bold [&>th]:uppercase [&>th]:tracking-wide">
              <th>ID</th>
              <th>State</th>
              <th>Camera</th>
              <th>Agent</th>
              <th>Approved</th>
              <th>Started</th>
              <th>Ended</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr
                key={s.id}
                className="border-t border-[rgba(0,0,0,0.07)] transition-colors hover:bg-[rgba(0,0,0,0.03)] [&>td]:whitespace-nowrap [&>td]:px-4 [&>td]:py-3 [&>td]:align-middle"
              >
                <td className="font-mono text-[var(--dn-text-50)]">
                  {short(s.id)}
                </td>
                <td>
                  <span className="inline-flex items-center gap-1.5">
                    <StatusDot status={STATE_DOT[s.state]} />
                    <span
                      className="font-bold capitalize"
                      style={{ color: STATE_TEXT[s.state] }}
                    >
                      {s.state}
                    </span>
                  </span>
                </td>
                <td className="font-bold">
                  {cameraNames[s.camera_id] ?? short(s.camera_id)}
                </td>
                <td className="font-bold">
                  {agentNames[s.agent_id] ?? short(s.agent_id)}
                </td>
                <td className="font-mono text-[var(--dn-text-50)]">
                  {approvedSummary(s)}
                </td>
                <td>
                  <RelativeTime
                    value={s.started_at ?? s.created_at}
                    className="text-[var(--dn-text-50)]"
                  />
                </td>
                <td>
                  <RelativeTime
                    value={s.ended_at}
                    className="text-[var(--dn-text-50)]"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

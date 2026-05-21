import type { ReactNode } from "react";
import { RelativeTime } from "@/components/data/relative-time";
import type { ApiToken } from "@/lib/api/types";
import { StatusDot, type DotStatus } from "./status-dot";

// API tokens as rows (mirrors the prod settings/api-tokens columns) in the
// dashboard-next light vibe. Server Component; scrolls inside the layout's
// ScrollArea. The token secret is never present here — only the public
// prefix + last_four, exactly like prod.

export const TOKEN_EXPIRING_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export type TokenStatus = "active" | "expiring" | "expired" | "revoked";

// Mirrors prod tokenStatus() precedence (revoked → expired → active), plus an
// "expiring soon" signal. Single source of truth — the page derives the
// summary counts from this too.
export function tokenStatus(t: ApiToken): TokenStatus {
  if (t.revoked_at) return "revoked";
  if (t.expires_at) {
    const exp = Date.parse(t.expires_at);
    if (exp < Date.now()) return "expired";
    if (exp - Date.now() < TOKEN_EXPIRING_WINDOW_MS) return "expiring";
  }
  return "active";
}

// Prod StatusBadge tones: active=positive, revoked=danger, expired=neutral;
// expiring=warn (transitional).
const STATUS_DOT: Record<TokenStatus, DotStatus> = {
  active: "green",
  expiring: "yellow",
  expired: "neutral",
  revoked: "red",
};
const STATUS_TEXT: Record<TokenStatus, string> = {
  active: "#3f7d4e",
  expiring: "#8a6d1f",
  expired: "var(--dn-text-50)",
  revoked: "#c0473b",
};

export function TokensTable({
  tokens,
  renderRowActions,
}: {
  tokens: ApiToken[];
  // Optional inline actions cell (revoke, etc.) injected per row. When
  // omitted, the actions column is hidden — keeping the table usable as a
  // read-only view for non-admin roles.
  renderRowActions?: (token: ApiToken) => ReactNode;
}) {
  const showActions = !!renderRowActions;
  return (
    <div className="dn-tile overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[clamp(0.78rem,1vw,0.92rem)]">
          <thead>
            <tr className="text-[var(--dn-text-50)] [&>th]:whitespace-nowrap [&>th]:px-4 [&>th]:py-3 [&>th]:text-[0.72em] [&>th]:font-bold [&>th]:uppercase [&>th]:tracking-wide">
              <th>Name</th>
              <th>Key</th>
              <th>Scopes</th>
              <th>Status</th>
              <th>Created</th>
              <th>Last used</th>
              <th>Expires</th>
              {showActions && <th className="text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {tokens.map((t) => {
              const st = tokenStatus(t);
              return (
                <tr
                  key={t.id}
                  className="border-t border-[rgba(0,0,0,0.07)] transition-colors hover:bg-[rgba(0,0,0,0.03)] [&>td]:whitespace-nowrap [&>td]:px-4 [&>td]:py-3 [&>td]:align-middle"
                >
                  <td className="font-bold">{t.name}</td>
                  <td className="font-mono text-[var(--dn-text-50)]">
                    {t.prefix}…{t.last_four}
                  </td>
                  <td className="font-mono text-[var(--dn-text-50)]">
                    {t.scopes.join(", ") || "—"}
                  </td>
                  <td>
                    <span className="inline-flex items-center gap-1.5">
                      <StatusDot status={STATUS_DOT[st]} />
                      <span
                        className="font-bold capitalize"
                        style={{ color: STATUS_TEXT[st] }}
                      >
                        {st}
                      </span>
                    </span>
                  </td>
                  <td>
                    <RelativeTime
                      value={t.created_at}
                      className="text-[var(--dn-text-50)]"
                    />
                  </td>
                  <td>
                    <RelativeTime
                      value={t.last_used_at}
                      className="text-[var(--dn-text-50)]"
                    />
                  </td>
                  <td>
                    {t.expires_at ? (
                      <RelativeTime
                        value={t.expires_at}
                        className="text-[var(--dn-text-50)]"
                      />
                    ) : (
                      <span className="text-[var(--dn-text-50)]">never</span>
                    )}
                  </td>
                  {showActions && <td>{renderRowActions!(t)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

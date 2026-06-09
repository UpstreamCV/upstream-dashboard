"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Bell, CheckCircle2, Info, X } from "lucide-react";
import { RelativeTime } from "@/components/data/relative-time";
import {
  CAMERA_ID,
  demoNotifications,
  demoUnreadCount,
  type DemoNotification,
} from "./fixtures";
import type { DemoScene } from "./scene";

// Parts 3 & 6: the in-app notification system — a topbar bell (unread badge), a
// right slide-in drawer of notifications, and arrival toasts. The SINGLE source
// of arrival toasts (entering `problem` → issue, `fixed` → all-good), driven by
// the `scene` prop the (app) layout passes from getDemoScene().

const KIND_ICON: Record<DemoNotification["kind"], typeof Bell> = {
  issue: AlertTriangle,
  success: CheckCircle2,
  info: Info,
};
const KIND_COLOR: Record<DemoNotification["kind"], { fg: string; bg: string }> = {
  issue: { fg: "#c0473b", bg: "rgba(192,71,59,0.12)" },
  success: { fg: "#3f7d4e", bg: "rgba(63,157,90,0.14)" },
  info: { fg: "#4b816c", bg: "rgba(75,129,108,0.14)" },
};

export function DemoNotifications({ scene }: { scene: DemoScene }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const items = demoNotifications(scene);
  const unread = demoUnreadCount(scene);
  const prev = useRef(scene);

  // Fire the arrival toast on transition into problem / fixed (not on initial mount).
  useEffect(() => {
    if (scene === prev.current) return;
    prev.current = scene;
    if (scene === "problem") {
      toast("Dock Door — Bay 3: detection unstable", {
        description: "Confidence is dropping in low light. Review the suggested fixes.",
        duration: 6000,
        action: {
          label: "Review",
          onClick: () => router.push(`/dashboard/cameras/${CAMERA_ID}/reliability`),
        },
      });
    } else if (scene === "fixed") {
      toast.success("Dock Door — Bay 3 is healthy", {
        description: "Detections recovered after the model upgrade.",
        duration: 6000,
      });
    }
  }, [scene, router]);

  const go = (href?: string) => {
    setOpen(false);
    if (href) router.push(href);
  };

  return (
    <>
      {/* Relative wrapper (no overflow) so the unread badge can sit ON TOP of the
          bell, poking past its corner. The button itself is `dn-glow-soft`, which
          is overflow:hidden — a badge inside it would be clipped — so the badge is
          a sibling here. For visual unity with the search field beside it, the bell
          reuses `.dn-field` (same frosted fill, white border, and blur as the search
          pill) and is sized to the search field's EXACT height via the shared
          formula below — line-height(1.5) × font clamp + py-2 (1rem) + border (2px) —
          with aspect-ratio:1 keeping it a circle. (The search input inherits
          line-height:1.5 from <body> and its `text-[clamp(.85rem,1vw,1rem)]` sets
          font-size only, so this tracks it 1:1 across every viewport.) */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
          className="dn-field dn-glow-soft grid place-items-center"
          style={{
            height: "calc(clamp(1.275rem, 1.5vw, 1.5rem) + 1rem + 2px)",
            aspectRatio: "1 / 1",
          }}
        >
          <Bell
            className="text-white"
            style={{ width: "clamp(15px,1.6vw,18px)", height: "clamp(15px,1.6vw,18px)" }}
          />
        </button>
        {unread > 0 ? (
          <span
            className="pointer-events-none absolute grid place-items-center rounded-full font-bold text-white"
            style={{
              top: -4,
              right: -4,
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              fontSize: 10,
              lineHeight: 1,
              background: "#e15a4c",
              boxShadow: "0 0 0 2px var(--dn-creek-mid)",
            }}
          >
            {unread}
          </span>
        ) : null}
      </div>

      {open ? (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[9997]"
          style={{ background: "rgba(10,14,9,0.4)", animation: "notifFade 200ms ease both" }}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 bottom-0 flex flex-col bg-white"
            style={{
              width: "clamp(320px,92vw,400px)",
              boxShadow: "-20px 0 60px -20px rgba(0,0,0,0.45)",
              animation: "notifIn 320ms cubic-bezier(.2,.7,.2,1) both",
            }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-black/10 p-4">
              <span className="inline-flex items-center gap-2">
                <span className="font-bold text-[clamp(1rem,1.2vw,1.15rem)] text-black">Notifications</span>
                {unread > 0 ? (
                  <span className="rounded-full bg-[#e15a4c] px-2 py-0.5 text-[11px] font-bold text-white">
                    {unread} new
                  </span>
                ) : null}
              </span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="dn-btn rounded-full p-2" style={{ lineHeight: 0 }}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-3">
              {items.length === 0 ? (
                <p className="px-2 py-10 text-center text-sm text-[var(--dn-text-50)]">
                  No notifications yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {items.map((n) => {
                    const Icon = KIND_ICON[n.kind];
                    const c = KIND_COLOR[n.kind];
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => go(n.href)}
                          className="flex w-full gap-3 rounded-xl p-3 text-left transition hover:bg-black/[0.04]"
                          style={{ background: n.unread ? c.bg : undefined }}
                        >
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ background: c.bg }}>
                            <Icon className="h-4 w-4" style={{ color: c.fg }} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="truncate font-bold text-[0.92rem] text-black">{n.title}</span>
                              {n.unread ? <span className="ml-auto h-2 w-2 shrink-0 rounded-full" style={{ background: c.fg }} /> : null}
                            </span>
                            <span className="mt-0.5 block text-[0.82rem] text-[var(--dn-text-50)]">{n.body}</span>
                            <span className="mt-1 block font-mono text-[11px] text-[var(--dn-text-50)]">
                              <RelativeTime value={n.at} />
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>
          <style>{`@keyframes notifFade{from{opacity:0}to{opacity:1}} @keyframes notifIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
        </div>
      ) : null}
    </>
  );
}

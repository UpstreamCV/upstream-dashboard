"use client";

import { useEffect } from "react";

// One shared pointer tracker for every translucent `.dn-glow-soft` button on
// the dashboard (the tile "View X" actions). A single window listener feeds
// each button its own --mx/--my (pointer position) and --glow (0 far → 1 over,
// fading across a proximity RANGE) so the white glass sheen swells in before
// the cursor arrives — same idea as the login button, scaled to many buttons
// without N listeners. Renders nothing.
export function CursorGlow() {
  useEffect(() => {
    const RANGE = 190; // px from a button's edge where its glow begins
    const els = () =>
      document.querySelectorAll<HTMLElement>(".dn-glow-soft");

    const onMove = (e: MouseEvent) => {
      els().forEach((el) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - r.left}px`);
        el.style.setProperty("--my", `${e.clientY - r.top}px`);
        const dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right);
        const dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom);
        const dist = Math.hypot(dx, dy); // 0 while inside the button
        el.style.setProperty(
          "--glow",
          Math.max(0, 1 - dist / RANGE).toFixed(3),
        );
      });
    };
    const onLeave = () => {
      els().forEach((el) => el.style.setProperty("--glow", "0"));
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return null;
}

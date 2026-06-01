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

    let frame = 0; // pending rAF handle (0 = none scheduled)
    let clientX = 0;
    let clientY = 0;

    // Coalesced once-per-frame update. mousemove fires 60–120+/s; doing the
    // measure+write inline per event interleaved getBoundingClientRect reads
    // with CSS-var writes, forcing synchronous layout many times per frame.
    // Here we batch ALL reads before ANY writes, inside a single rAF.
    const apply = () => {
      frame = 0;
      const nodes = els();
      const rects = new Array<DOMRect>(nodes.length);
      nodes.forEach((el, i) => {
        rects[i] = el.getBoundingClientRect(); // read pass
      });
      nodes.forEach((el, i) => {
        const r = rects[i]; // write pass — no reads interleaved
        el.style.setProperty("--mx", `${clientX - r.left}px`);
        el.style.setProperty("--my", `${clientY - r.top}px`);
        const dx = Math.max(r.left - clientX, 0, clientX - r.right);
        const dy = Math.max(r.top - clientY, 0, clientY - r.bottom);
        const dist = Math.hypot(dx, dy); // 0 while inside the button
        el.style.setProperty(
          "--glow",
          Math.max(0, 1 - dist / RANGE).toFixed(3),
        );
      });
    };

    const onMove = (e: MouseEvent) => {
      clientX = e.clientX;
      clientY = e.clientY;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      els().forEach((el) => el.style.setProperty("--glow", "0"));
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return null;
}

"use client";

import { useEffect } from "react";

// Cursor controller for the dashboard's glass buttons (.dn-glow-soft). It only
// ever touches the button the pointer is actually OVER — everything (frost,
// white sheen, magnetic lean) is gated on real :hover, never proximity:
//
//   • MAGNETIC LEAN — while the pointer is inside the button, it eases TOWARD
//     the cursor by a fraction of the cursor→center delta (--dn-tx/--dn-ty,
//     consumed by a CSS transform applied on :hover in theme.css). Modelled on
//     upstream-web's useMagnetic (outer 0.08); when the pointer leaves, :hover
//     drops and the button eases back to 0 on its own.
//   • HIGHLIGHT POSITION — --mx/--my track the pointer inside the button for the
//     white sheen (also shown only on :hover).
//
// Reads (getBoundingClientRect) are batched before writes to avoid layout
// thrash. No-ops on coarse (touch) pointers; honours prefers-reduced-motion by
// dropping the lean (the hover sheen still works).
const SELECTOR = ".dn-glow-soft";
const OUTER = 0.08; // magnetic lean strength — fraction of cursor→center delta

export function CursorGlow() {
  useEffect(() => {
    if (window.matchMedia?.("(pointer: coarse)").matches) return; // no hover cursor
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let frame = 0;
    let clientX = 0;
    let clientY = 0;

    // Coalesced once-per-frame: batch ALL getBoundingClientRect reads, THEN all
    // writes — interleaving them would force a synchronous layout per node.
    const apply = () => {
      frame = 0;
      const nodes = document.querySelectorAll<HTMLElement>(SELECTOR);
      const rects = new Array<DOMRect>(nodes.length);
      for (let i = 0; i < nodes.length; i++) {
        rects[i] = nodes[i].getBoundingClientRect();
      }
      for (let i = 0; i < nodes.length; i++) {
        const el = nodes[i];
        const r = rects[i];
        if (r.width === 0 || r.height === 0) continue;
        // Only the button under the pointer reacts — CSS :hover owns visibility,
        // so far / merely-nearby buttons are left untouched (no proximity glow).
        if (
          clientX < r.left ||
          clientX > r.right ||
          clientY < r.top ||
          clientY > r.bottom
        ) {
          continue;
        }
        el.style.setProperty("--mx", `${(clientX - r.left).toFixed(1)}px`);
        el.style.setProperty("--my", `${(clientY - r.top).toFixed(1)}px`);
        if (!reduced) {
          const dx = clientX - (r.left + r.width / 2);
          const dy = clientY - (r.top + r.height / 2);
          const radius = Math.max(r.width, r.height) * 0.9;
          const pull = Math.max(0, 1 - Math.hypot(dx, dy) / (radius * 2));
          el.style.setProperty("--dn-tx", `${(dx * OUTER * pull).toFixed(2)}px`);
          el.style.setProperty("--dn-ty", `${(dy * OUTER * pull).toFixed(2)}px`);
        }
      }
    };

    const onMove = (e: MouseEvent) => {
      clientX = e.clientX;
      clientY = e.clientY;
      if (!frame) frame = requestAnimationFrame(apply);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  return null;
}

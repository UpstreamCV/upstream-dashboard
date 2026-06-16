"use client";

import { useEffect, useRef } from "react";

// Five heavily-blurred creek-color orbs drifting behind the dashboard shell.
// Instead of fixed CSS keyframe loops, a tiny controller hands each orb a fresh
// RANDOM target (translate + scale) every several seconds, so they roam freely
// anywhere on the page along an organic, non-repeating path. The CSS transition
// on .dn-orb (theme.css) eases each move; the intervals are jittered + staggered
// so the orbs never move in lockstep. Honors prefers-reduced-motion (the orbs
// rest at their CSS anchor positions and the controller stays idle).
export function ShellBackdrop() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const orbs = Array.from(root.querySelectorAll<HTMLElement>(".dn-orb"));
    const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
    const timers: ReturnType<typeof setTimeout>[] = [];

    // A random target relative to the orb's resting anchor — wide enough to
    // wander across the whole viewport (orbs are huge + blurred, so spilling
    // past an edge just reads as a soft glow).
    const move = (el: HTMLElement) => {
      el.style.transform = `translate3d(${rand(-60, 60)}vw, ${rand(-55, 55)}vh, 0) scale(${rand(0.85, 1.3).toFixed(3)})`;
    };

    orbs.forEach((el, i) => {
      const loop = () => {
        move(el);
        timers.push(setTimeout(loop, rand(14000, 26000)));
      };
      // Staggered first move; the CSS transition eases it out from the anchor.
      timers.push(setTimeout(loop, 200 + i * 350));
    });

    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  return (
    <div ref={ref} className="dn-backdrop" aria-hidden>
      <span className="dn-orb dn-orb-1" />
      <span className="dn-orb dn-orb-2" />
      <span className="dn-orb dn-orb-3" />
      <span className="dn-orb dn-orb-4" />
      <span className="dn-orb dn-orb-5" />
    </div>
  );
}

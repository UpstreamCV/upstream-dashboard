"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Custom overlay scrollbar for the dashboard-next content area. The native
// scrollbar is hidden (.dn-scroll) and replaced with a faint full-length pill
// track + a FIXED-LENGTH white pill thumb whose position maps scroll progress
// (scrollTop / maxScroll) — constant size regardless of how long the page is,
// unlike a content-proportional native thumb. Track is click/drag-to-scroll.
// Hides itself entirely when there's nothing to scroll.
//
// Mounts inside a `position: relative` parent (the <main> in (app)/layout.tsx).
export function ScrollArea({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1

  const sync = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    if (max <= 1) {
      setScrollable(false);
      return;
    }
    setScrollable(true);
    setProgress(Math.min(1, Math.max(0, el.scrollTop / max)));
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", sync);
      ro.disconnect();
    };
  }, [sync]);

  const startDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const seek = (clientY: number) => {
      const max = el.scrollHeight - el.clientHeight;
      const pct = Math.min(
        1,
        Math.max(0, (clientY - rect.top) / rect.height),
      );
      el.scrollTop = pct * max;
    };
    seek(e.clientY);
    const onMove = (ev: PointerEvent) => seek(ev.clientY);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

  return (
    <>
      <div
        ref={scrollRef}
        className="dn-scroll absolute inset-0 overflow-y-auto p-4 sm:p-6 md:p-8"
      >
        {children}
      </div>
      {scrollable && (
        <div
          className="dn-bar-track"
          aria-hidden
          onPointerDown={startDrag}
        >
          <div
            className="dn-bar-thumb"
            style={{ top: `calc(${progress} * (100% - var(--dn-thumb)))` }}
          />
        </div>
      )}
    </>
  );
}

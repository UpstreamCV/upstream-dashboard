"use client";

import { useEffect, useRef, useState } from "react";

// Reusable animated terminal: reveals `lines` one at a time, shows a blinking
// cursor until done, then calls onDone(). Used by the standalone Act-1 scene
// (with the logo) and the add-camera panel. No synchronous setState in the
// effect — only timer callbacks — so it satisfies react-hooks/set-state-in-effect.
//
// NOTE: pass a STABLE `lines` array (a module const or useMemo) — a new array
// each render would restart the animation.

export const UPSTREAM_LOGO = [
  "  _    _           _",
  " | |  | |         | |",
  " | |  | |_ __  ___| |_ _ __ ___  __ _ _ __ ___",
  " | |  | | '_ \\/ __| __| '__/ _ \\/ _` | '_ ` _ \\",
  " | |__| | |_) \\__ \\ |_| | |  __/ (_| | | | | | |",
  "  \\____/| .__/|___/\\__|_|  \\___|\\__,_|_| |_| |_|",
  "        | |",
  "        |_|",
].join("\n");

function lineColor(text: string): string {
  if (text.startsWith("$")) return "#9ad29f";
  if (text.startsWith("Streaming started") || text.startsWith("Press Ctrl+C"))
    return "#5fb869";
  return "rgba(255,255,255,0.86)";
}

export function TerminalLog({
  lines,
  showLogo = false,
  onDone,
}: {
  lines: { text: string; delayMs: number }[];
  showLogo?: boolean;
  onDone?: () => void;
}) {
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    // Local (not a ref) so the cleanup closes over a stable list — no
    // react-hooks/refs staleness. The timer callbacks (not the effect body)
    // are the only place state is set.
    const ids: ReturnType<typeof setTimeout>[] = [];
    let acc = 400;
    lines.forEach((line, i) => {
      acc += line.delayMs;
      ids.push(setTimeout(() => setCount(i + 1), acc));
    });
    ids.push(
      setTimeout(() => {
        setDone(true);
        onDoneRef.current?.();
      }, acc + 250),
    );
    return () => ids.forEach(clearTimeout);
  }, [lines]);

  const shown = lines.slice(0, count);

  return (
    <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
      {showLogo ? (
        <pre
          style={{
            color: "rgba(95,184,105,0.85)",
            margin: 0,
            fontSize: "clamp(9px,1vw,13px)",
            lineHeight: 1.2,
          }}
        >
          {UPSTREAM_LOGO}
        </pre>
      ) : null}
      <div style={{ marginTop: showLogo ? 24 : 0 }}>
        {shown.map((line, i) => (
          <div key={i} style={{ color: lineColor(line.text), whiteSpace: "pre-wrap" }}>
            {line.text}
          </div>
        ))}
        {!done ? (
          <span
            style={{
              display: "inline-block",
              width: 9,
              height: "1.1em",
              background: "#5fb869",
              verticalAlign: "text-bottom",
              animation: "demoBlink 1s steps(2) infinite",
            }}
          />
        ) : null}
      </div>
      <style>{`@keyframes demoBlink { 0%,50%{opacity:1} 50.01%,100%{opacity:0} }`}</style>
    </div>
  );
}

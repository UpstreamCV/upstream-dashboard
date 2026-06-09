"use client";

import type { CSSProperties } from "react";
import { Activity, CheckCircle2, Loader2, Radio, TriangleAlert } from "lucide-react";
import { DEMO_SCENES, sceneIndex, type DemoScene } from "./scene";
import { MOOD_PRESENTATION, SCENE_META, type SceneMood } from "./scene-meta";

// The narrative made visible. A bold status strip on the camera detail (above
// the tabs, so it persists across Monitor/Observations/Reliability). Color +
// icon + copy change dramatically per scene, it re-animates on every step, and
// alert/working moods pulse — so each state reads instantly and the flow is
// obvious on camera.

const ICON: Record<
  SceneMood,
  React.ComponentType<{ className?: string; style?: CSSProperties }>
> = {
  calm: Radio,
  active: Activity,
  alert: TriangleAlert,
  working: Loader2,
  success: CheckCircle2,
};

export function DemoSceneBanner({ scene }: { scene: DemoScene }) {
  const meta = SCENE_META[scene];
  const c = MOOD_PRESENTATION[meta.mood];
  const Icon = ICON[meta.mood];
  const idx = sceneIndex(scene);
  const pulsing = meta.mood === "alert" || meta.mood === "working";

  const box = {
    display: "flex",
    alignItems: "center",
    gap: "clamp(12px,1.6vw,18px)",
    padding: "clamp(12px,1.5vw,18px) clamp(16px,2vw,22px)",
    borderRadius: 18,
    background: c.tint,
    border: `1px solid ${c.accent}55`,
    boxShadow: `0 14px 44px -16px ${c.glow}`,
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    animation: pulsing ? "demoBannerPulse 2.4s ease-in-out infinite" : undefined,
    "--demo-glow": c.glow,
  } as CSSProperties;

  return (
    <div key={scene} data-demo-banner style={{ animation: "demoBannerIn 460ms cubic-bezier(.2,.7,.2,1) both" }}>
      <div style={box}>
        <span
          style={{
            display: "grid",
            placeItems: "center",
            width: "clamp(40px,4vw,50px)",
            height: "clamp(40px,4vw,50px)",
            borderRadius: 999,
            background: `${c.accent}26`,
            flexShrink: 0,
          }}
        >
          <Icon
            className={meta.mood === "working" ? "animate-spin" : ""}
            style={{
              width: "clamp(20px,2.2vw,26px)",
              height: "clamp(20px,2.2vw,26px)",
              color: c.accent,
            }}
          />
        </span>

        <div style={{ minWidth: 0, flex: 1 }}>
          <p
            style={{
              fontWeight: 800,
              color: c.accent,
              fontSize: "clamp(1.05rem,1.6vw,1.4rem)",
              lineHeight: 1.12,
              letterSpacing: "-0.01em",
            }}
          >
            {meta.title}
          </p>
          <p
            style={{
              color: "rgba(255,255,255,0.78)",
              fontSize: "clamp(0.82rem,1vw,0.98rem)",
              marginTop: 3,
            }}
          >
            {meta.caption}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 7,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: 11,
              color: "rgba(255,255,255,0.6)",
              letterSpacing: "0.08em",
            }}
          >
            STEP {idx + 1} / {DEMO_SCENES.length}
          </span>
          <span style={{ display: "flex", gap: 5 }} aria-hidden>
            {DEMO_SCENES.map((s, i) => (
              <span
                key={s}
                style={{
                  width: i === idx ? 20 : 7,
                  height: 7,
                  borderRadius: 999,
                  background:
                    i === idx
                      ? c.accent
                      : i < idx
                        ? "rgba(255,255,255,0.42)"
                        : "rgba(255,255,255,0.16)",
                  boxShadow: i === idx ? `0 0 10px ${c.glow}` : undefined,
                  transition: "width 320ms ease, background 320ms ease",
                }}
              />
            ))}
          </span>
        </div>
      </div>

      <style>{`
        @keyframes demoBannerIn { from { opacity: 0; transform: translateY(-8px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes demoBannerPulse {
          0%, 100% { box-shadow: 0 14px 44px -16px var(--demo-glow) }
          50% { box-shadow: 0 16px 54px -10px var(--demo-glow), 0 0 0 3px var(--demo-glow) }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-demo-banner], [data-demo-banner] * { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

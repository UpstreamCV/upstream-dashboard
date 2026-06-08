// Human-facing copy + "mood" for each demo scene. Shared by the on-screen scene
// banner and the recorder's stepper so the narrative reads consistently.
// Isomorphic (no I/O) — safe to import anywhere.

import type { DemoScene } from "./scene";

export type SceneMood = "calm" | "active" | "alert" | "working" | "success";

export interface SceneMeta {
  title: string;
  caption: string;
  mood: SceneMood;
}

export const SCENE_META: Record<DemoScene, SceneMeta> = {
  adding: {
    title: "Connect a camera",
    caption: "Run the agent on the camera host to bring it online.",
    mood: "working",
  },
  connected: {
    title: "Camera connected",
    caption: "Live feed from Dock Door — Bay 3.",
    mood: "calm",
  },
  "line-saved": {
    title: "Counting line active",
    caption: "Counting anyone crossing into the bay.",
    mood: "calm",
  },
  counting: {
    title: "Counting crossings",
    caption: "Entries are logging in real time.",
    mood: "active",
  },
  problem: {
    title: "Detection unstable",
    caption: "A crossing was missed — confidence is falling in the low light.",
    mood: "alert",
  },
  fixing: {
    title: "Upgrading detection model",
    caption: "Switching to the high-recall model tuned for this scene.",
    mood: "working",
  },
  fixed: {
    title: "Resolved",
    caption: "Confidence recovered — every crossing is counted again.",
    mood: "success",
  },
};

// Presentation tuned for the dark creek shell the camera header sits on:
// a bright accent (text/icon), a glow (shadow), and a translucent tint (bg).
export const MOOD_PRESENTATION: Record<
  SceneMood,
  { accent: string; glow: string; tint: string }
> = {
  calm: { accent: "#7fd08a", glow: "rgba(95,184,105,0.28)", tint: "rgba(95,184,105,0.10)" },
  active: { accent: "#7fd08a", glow: "rgba(95,184,105,0.36)", tint: "rgba(95,184,105,0.14)" },
  alert: { accent: "#f1786a", glow: "rgba(225,90,76,0.48)", tint: "rgba(225,90,76,0.17)" },
  working: { accent: "#ecc06a", glow: "rgba(207,146,51,0.44)", tint: "rgba(207,146,51,0.17)" },
  success: { accent: "#7fd08a", glow: "rgba(95,184,105,0.50)", tint: "rgba(95,184,105,0.18)" },
};

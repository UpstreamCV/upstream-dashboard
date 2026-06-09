// The demo "scene cursor" — the single source of truth for where we are in the
// 60s narrative. Isomorphic (no I/O, no next/headers) so it's safe to import
// from server code, the route handler, AND the client stepper. The cursor value
// itself lives in the `demo_scene` cookie; read it server-side with
// getDemoScene() (scene-cookie.ts) and write it with setDemoSceneAction
// (actions.ts).
//
// Narrative spine (see upstream-demo/main-demo/02-storyboard.md):
//   adding → connected → line-saved → counting → problem → fixing → fixed

export const DEMO_SCENES = [
  "adding",
  "connected",
  "line-saved",
  "counting",
  "problem",
  "fixing",
  "fixed",
] as const;

export type DemoScene = (typeof DEMO_SCENES)[number];

// Cold start begins at `adding` (empty Cameras page) so the in-app "Add camera"
// modal is the genuine connect beat — and an unknown/missing cookie coerces to
// the true start of the narrative rather than mid-story.
export const DEFAULT_SCENE: DemoScene = "adding";
export const DEMO_SCENE_COOKIE = "demo_scene";

/** Tolerant parse: any unknown/missing value falls back to the default scene. */
export function coerceScene(value: string | null | undefined): DemoScene {
  return (DEMO_SCENES as readonly string[]).includes(value ?? "")
    ? (value as DemoScene)
    : DEFAULT_SCENE;
}

export function sceneIndex(scene: DemoScene): number {
  return DEMO_SCENES.indexOf(scene);
}

export function nextScene(scene: DemoScene): DemoScene {
  return DEMO_SCENES[Math.min(sceneIndex(scene) + 1, DEMO_SCENES.length - 1)];
}

export function prevScene(scene: DemoScene): DemoScene {
  return DEMO_SCENES[Math.max(sceneIndex(scene) - 1, 0)];
}

// --- narrative predicates the fixtures/router branch on -----------------------
// Expressed as "scene N or later" where the state, once reached, persists.

/** The camera is added + live from `connected` on (the cameras list is empty at `adding`). */
export function cameraAdded(scene: DemoScene): boolean {
  return sceneIndex(scene) >= sceneIndex("connected");
}

/** The operator's counting line exists (drawn + saved) from `line-saved` on. */
export function lineSaved(scene: DemoScene): boolean {
  return sceneIndex(scene) >= sceneIndex("line-saved");
}

/** Line-crossing observations have started accumulating from `counting` on. */
export function counting(scene: DemoScene): boolean {
  return sceneIndex(scene) >= sceneIndex("counting");
}

/** The reliability finding is OPEN during `problem` and `fixing`. */
export function findingOpen(scene: DemoScene): boolean {
  return scene === "problem" || scene === "fixing";
}

/** Everything is healthy again and the missed crossing now counts. */
export function fixed(scene: DemoScene): boolean {
  return scene === "fixed";
}

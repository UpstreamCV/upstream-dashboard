"use server";

import { cookies } from "next/headers";
import { demoCookieOptionsForRequest } from "./demo-mode.server";
import { DEMO_SCENE_COOKIE, type DemoScene } from "./scene";

// Write the demo scene cursor. Called by the floating stepper (client component)
// and by demo-mode write actions (e.g. saving geometry advances to "line-saved",
// applying the recommended model advances to "fixing"). Not httpOnly so the
// stepper can read the current value client-side to compute next/prev.
// Attributes come from demoCookieOptions (SameSite=None; Secure over https) so
// the cursor keeps working when the demo is framed by another site.
export async function setDemoSceneAction(scene: DemoScene): Promise<void> {
  const store = await cookies();
  store.set(DEMO_SCENE_COOKIE, scene, await demoCookieOptionsForRequest());
}

// "Apply recommended model" on the reliability finding card → advance to the
// `fixing` beat. The stepper then steps to `fixed` for the recovery + payoff.
export async function applyRecommendedModelAction(): Promise<{ ok: true }> {
  const store = await cookies();
  store.set(DEMO_SCENE_COOKIE, "fixing", await demoCookieOptionsForRequest());
  return { ok: true };
}

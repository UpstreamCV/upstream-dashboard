// In-memory write store for demo mode.
//
// The fixtures (fixtures.ts) are pure functions of the scene, which keeps every
// take of the recorded demo identical. The embeddable demo also wants writes to
// stick — mark an alert read, toggle a rule, create a token — so this module
// layers per-collection PATCHES over those pure results: items created, fields
// overridden by id, ids deleted. `materialize()` applies them in the router.
//
// Scope: one object per server process, hung off globalThis so the RSC bundle
// (Server Actions writing) and the Route Handler bundle (client polls reading)
// see the same instance. It is shared by every demo visitor on that process and
// lost on restart/redeploy — acceptable for a demo, and why nothing here is
// ever treated as real. It self-resets after a quiet period so one visitor's
// walkthrough doesn't linger for the next.

import type { Alert, ApiToken, Camera, Rule, Workflow } from "@/lib/api/types";

export interface Collection<T extends { id: string }> {
  created: T[];
  overrides: Map<string, Partial<T>>;
  deleted: Set<string>;
}

export interface DemoState {
  alerts: Collection<Alert>;
  rules: Collection<Rule>;
  workflows: Collection<Workflow>;
  tokens: Collection<ApiToken>;
  cameras: Collection<Camera>;
  /** null = untouched, fall back to the fixture default (enabled). */
  processingEnabled: boolean | null;
  touchedAt: number;
}

/** Idle time after which the store forgets everything (30 minutes). */
export const DEMO_STATE_IDLE_RESET_MS = 30 * 60_000;

function emptyCollection<T extends { id: string }>(): Collection<T> {
  return { created: [], overrides: new Map(), deleted: new Set() };
}

function fresh(): DemoState {
  return {
    alerts: emptyCollection(),
    rules: emptyCollection(),
    workflows: emptyCollection(),
    tokens: emptyCollection(),
    cameras: emptyCollection(),
    processingEnabled: null,
    touchedAt: Date.now(),
  };
}

const KEY = Symbol.for("upstream.dashboard.demoState");
type Holder = { [KEY]?: DemoState };

export function getDemoState(now: number = Date.now()): DemoState {
  const holder = globalThis as unknown as Holder;
  let state = holder[KEY];
  if (!state || now - state.touchedAt > DEMO_STATE_IDLE_RESET_MS) {
    state = fresh();
    holder[KEY] = state;
  }
  state.touchedAt = now;
  return state;
}

/** Test/reset hook — also what a fresh /demo visit could call if ever needed. */
export function resetDemoState(): void {
  (globalThis as unknown as Holder)[KEY] = fresh();
}

/** Base fixtures + patches → what the "API" returns. Created items lead. */
export function materialize<T extends { id: string }>(
  base: readonly T[],
  collection: Collection<T>,
): T[] {
  return [...collection.created, ...base]
    .filter((item) => !collection.deleted.has(item.id))
    .map((item) => {
      const patch = collection.overrides.get(item.id);
      return patch ? { ...item, ...patch } : item;
    });
}

export function createItem<T extends { id: string }>(
  collection: Collection<T>,
  item: T,
): T {
  collection.created.unshift(item);
  return item;
}

export function patchItem<T extends { id: string }>(
  collection: Collection<T>,
  id: string,
  changes: Partial<T>,
): void {
  const prev = collection.overrides.get(id) ?? {};
  collection.overrides.set(id, { ...prev, ...changes });
}

export function deleteItem<T extends { id: string }>(
  collection: Collection<T>,
  id: string,
): void {
  collection.deleted.add(id);
}

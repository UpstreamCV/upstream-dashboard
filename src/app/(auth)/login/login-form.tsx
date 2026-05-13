"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signInAction, type LoginState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-ink text-base-2 font-medium py-3 px-5 transition hover:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState<LoginState | undefined, FormData>(
    signInAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div className="space-y-1.5">
        <label
          htmlFor="email"
          className="text-xs uppercase tracking-wider text-ink-mute mono"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full rounded-xl bg-glass-bg border border-glass-stroke px-4 py-3 text-ink placeholder:text-ink-mute focus:outline-none focus:border-accent/60 transition"
          placeholder="you@example.com"
        />
      </div>
      <div className="space-y-1.5">
        <label
          htmlFor="password"
          className="text-xs uppercase tracking-wider text-ink-mute mono"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-xl bg-glass-bg border border-glass-stroke px-4 py-3 text-ink placeholder:text-ink-mute focus:outline-none focus:border-accent/60 transition"
        />
      </div>
      {state?.error ? (
        <p className="text-sm text-red-300/90 mono">{state.error}</p>
      ) : null}
      <SubmitButton />
    </form>
  );
}

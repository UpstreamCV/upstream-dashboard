"use client";

import { MailCheck } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signUpAction, type SignUpState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-ink text-[#0f1809] font-medium py-3 px-5 transition hover:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {pending ? "Creating account…" : "Create account"}
    </button>
  );
}

export function SignUpForm({ next }: { next: string }) {
  const [state, formAction] = useActionState<SignUpState | undefined, FormData>(
    signUpAction,
    undefined,
  );

  if (state?.confirmationRequired) {
    return (
      <div className="text-center">
        <MailCheck className="w-7 h-7 mx-auto text-accent" />
        <h2 className="display text-xl font-semibold mt-3">
          Check your <em>email</em>
        </h2>
        <p className="text-sm text-ink-soft mt-3">
          We sent a confirmation link to{" "}
          <span className="text-ink mono">{state.email}</span>. Click it to
          finish creating your account, then sign in.
        </p>
        <p className="text-xs text-ink-mute mt-4">
          Didn&rsquo;t get the email? Check spam, or try{" "}
          <a href="/signup" className="text-accent hover:underline">
            signing up again
          </a>
          .
        </p>
      </div>
    );
  }

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
          autoComplete="new-password"
          required
          minLength={8}
          className="w-full rounded-xl bg-glass-bg border border-glass-stroke px-4 py-3 text-ink placeholder:text-ink-mute focus:outline-none focus:border-accent/60 transition"
          placeholder="At least 8 characters"
        />
      </div>
      <div className="space-y-1.5">
        <label
          htmlFor="workspace_name"
          className="text-xs uppercase tracking-wider text-ink-mute mono"
        >
          Workspace name <span className="text-ink-mute/60">(optional)</span>
        </label>
        <input
          id="workspace_name"
          name="workspace_name"
          type="text"
          autoComplete="organization"
          maxLength={64}
          className="w-full rounded-xl bg-glass-bg border border-glass-stroke px-4 py-3 text-ink placeholder:text-ink-mute focus:outline-none focus:border-accent/60 transition"
          placeholder="Acme Vision"
        />
        <p className="text-[11px] text-ink-mute">
          Defaults to the part before <span className="mono">@</span> in your
          email.
        </p>
      </div>
      {state?.error ? (
        <p className="text-sm text-red-300/90 mono">{state.error}</p>
      ) : null}
      <SubmitButton />
    </form>
  );
}

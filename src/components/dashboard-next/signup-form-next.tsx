"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MailCheck } from "lucide-react";
import { signUpAction, type SignUpState } from "@/app/(auth)/signup/actions";

// Dark signup form — the sibling of LoginFormNext, same glass card / dn-field
// pills / dn-grad-btn + dn-glow-soft "magnify" button (driven by the page's
// <CursorGlow />). Wired to the same `signUpAction` the old /signup used; on
// success the action either redirects (confirmation off) or returns
// `{ confirmationRequired, email }`, which flips this to a dark "check your
// email" screen. `next` is preserved via useSearchParams → hidden field, and
// the "Sign in" link carries it back to /login.

export function SignUpFormNext() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const loginHref =
    next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`;
  const [state, formAction, pending] = useActionState<
    SignUpState | undefined,
    FormData
  >(signUpAction, undefined);

  // Live "double-check" of the two password fields: mirror the server's
  // password !== confirm guard in the browser so a mismatch shows as you type
  // and the submit is blocked before the round-trip. The Server Action re-checks
  // (authoritative — survives a disabled-JS / tampered client). Inputs stay
  // uncontrolled; we read their values by ref on change.
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const [mismatch, setMismatch] = useState(false);
  const checkMatch = () => {
    const pw = passwordRef.current?.value ?? "";
    const confirm = confirmRef.current?.value ?? "";
    setMismatch(confirm.length > 0 && confirm !== pw);
  };

  if (state?.confirmationRequired) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <MailCheck
          className="h-12 w-12 text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.25)]"
          strokeWidth={1.75}
          aria-hidden
        />
        <h1 className="text-white font-bold text-[clamp(1.6rem,4vw,2.35rem)] [text-shadow:0_1px_14px_rgba(0,0,0,0.22)]">
          Check your email
        </h1>
        <p className="text-white/85 text-[clamp(0.9rem,1.2vw,1.05rem)]">
          We sent a confirmation link to{" "}
          <span className="font-bold text-white">{state.email}</span>. Click it
          to finish creating your account, then sign in.
        </p>
        <Link
          href={loginHref}
          className="dn-grad-btn dn-glow-soft mt-3 block w-full text-center font-bold py-3.5 text-[clamp(0.95rem,1.1vw,1.1rem)]"
        >
          <span className="relative z-10">Back to login</span>
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 sm:gap-5">
      <div className="text-center mb-1 sm:mb-2">
        <h1 className="text-white font-bold text-[clamp(2rem,5vw,3rem)] [text-shadow:0_1px_14px_rgba(0,0,0,0.22)]">
          Upstream
        </h1>
        <p className="mt-1 text-white/90 font-bold text-[clamp(0.95rem,1.6vw,1.25rem)] [text-shadow:0_1px_10px_rgba(0,0,0,0.18)]">
          Create your account
        </p>
      </div>

      <input type="hidden" name="next" value={next} />

      <input
        name="email"
        type="email"
        autoComplete="email"
        required
        placeholder="Email"
        aria-label="Email"
        className="dn-field w-full px-6 py-3.5 text-[clamp(0.95rem,1.1vw,1.05rem)]"
      />
      <input
        ref={passwordRef}
        onChange={checkMatch}
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        placeholder="Password (8+ characters)"
        aria-label="Password"
        className="dn-field w-full px-6 py-3.5 text-[clamp(0.95rem,1.1vw,1.05rem)]"
      />
      <div className="flex flex-col gap-1.5">
        <input
          ref={confirmRef}
          onChange={checkMatch}
          name="confirm_password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="Confirm password"
          aria-label="Confirm password"
          aria-invalid={mismatch}
          aria-describedby={mismatch ? "confirm-password-error" : undefined}
          className="dn-field w-full px-6 py-3.5 text-[clamp(0.95rem,1.1vw,1.05rem)]"
        />
        {/* Always mounted so the polite live region announces the text change
            (a region inserted at the same moment as its text is not reliably
            announced); sr-only + empty while the passwords match. */}
        <p
          id="confirm-password-error"
          aria-live="polite"
          className={
            mismatch
              ? "px-2 text-[#ffd9d2] text-[clamp(0.72rem,0.9vw,0.82rem)]"
              : "sr-only"
          }
        >
          {mismatch ? "Passwords do not match." : ""}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <input
          name="workspace_name"
          type="text"
          autoComplete="organization"
          maxLength={64}
          placeholder="Workspace name (optional)"
          aria-label="Workspace name"
          className="dn-field w-full px-6 py-3.5 text-[clamp(0.95rem,1.1vw,1.05rem)]"
        />
        <p className="px-2 text-white/55 text-[clamp(0.72rem,0.9vw,0.82rem)]">
          Defaults to the part before @ in your email.
        </p>
      </div>

      <label className="flex items-center gap-2.5 text-white/85 text-[clamp(0.8rem,0.95vw,0.95rem)] select-none">
        <input
          type="checkbox"
          name="terms"
          required
          className="size-4 rounded accent-[var(--dn-creek-mid)]"
        />
        <span>
          I accept the{" "}
          <a
            href="#"
            className="!underline underline-offset-2 hover:text-white"
          >
            Terms and Conditions of Use
          </a>
        </span>
      </label>

      {state?.error ? (
        <p
          role="alert"
          className="text-center text-[#ffd9d2] bg-[rgba(225,90,76,0.18)] border border-[rgba(225,90,76,0.45)] rounded-full px-4 py-2 text-[clamp(0.78rem,0.95vw,0.9rem)]"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || mismatch}
        className="dn-grad-btn dn-glow-soft w-full font-bold py-3.5 text-[clamp(0.95rem,1.1vw,1.1rem)] mt-1 disabled:opacity-70 disabled:cursor-not-allowed"
      >
        <span className="relative z-10">
          {pending ? "Creating account…" : "Create account"}
        </span>
      </button>

      <p className="text-center text-white/85 text-[clamp(0.8rem,0.95vw,0.95rem)] mt-1">
        Already have an account?{" "}
        <Link
          href={loginHref}
          className="!underline underline-offset-2 hover:text-white"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}

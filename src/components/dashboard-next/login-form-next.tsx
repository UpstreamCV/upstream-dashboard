"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signInAction, type LoginState } from "@/app/(auth)/login/actions";

// Login form, wired to the same `signInAction` Server Action the live /login
// page uses. The action `redirect`s on success (so we never reach the
// state-rendering branch in that case); on failure it returns
// `{ error: string }` which we surface inline.
//
// The `next` param is preserved end-to-end: read from useSearchParams() here,
// shipped to the action via a hidden form field, and validated in the action
// with safeNextPath() before redirecting. If absent we default to
// /dashboard-next so the new shell handles its own login.
//
// The login button uses the shared .dn-glow-soft glass hover — frost + a white
// sheen that tracks the cursor + a magnetic lean — driven by <CursorGlow />
// mounted on the login page. Same "magnify" microinteraction as the dashboard's
// glass buttons, replacing the old cursor-proximity orb.
export function LoginFormNext() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const [state, formAction, pending] = useActionState<
    LoginState | undefined,
    FormData
  >(signInAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4 sm:gap-5">
      <div className="text-center mb-1 sm:mb-2">
        <h1 className="text-white font-bold text-[clamp(2rem,5vw,3rem)] [text-shadow:0_1px_14px_rgba(0,0,0,0.22)]">
          Upstream
        </h1>
        <p className="mt-1 text-white/90 font-bold text-[clamp(0.95rem,1.6vw,1.25rem)] [text-shadow:0_1px_10px_rgba(0,0,0,0.18)]">
          Login to continue
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
        name="password"
        type="password"
        autoComplete="current-password"
        required
        placeholder="Password"
        aria-label="Password"
        className="dn-field w-full px-6 py-3.5 text-[clamp(0.95rem,1.1vw,1.05rem)]"
      />

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
        disabled={pending}
        className="dn-grad-btn dn-glow-soft w-full font-bold py-3.5 text-[clamp(0.95rem,1.1vw,1.1rem)] mt-1 disabled:opacity-70 disabled:cursor-not-allowed"
      >
        <span className="relative z-10">
          {pending ? "Signing in…" : "Login"}
        </span>
      </button>

      <p className="text-center text-white/85 text-[clamp(0.8rem,0.95vw,0.95rem)] mt-1">
        Don&rsquo;t have an account?{" "}
        <Link
          href="/signup"
          className="!underline underline-offset-2 hover:text-white"
        >
          Sign up
        </Link>
      </p>
    </form>
  );
}

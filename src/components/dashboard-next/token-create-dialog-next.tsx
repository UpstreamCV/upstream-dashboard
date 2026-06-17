"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Check, Copy, KeyRound, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { CodeBlock } from "./code-block";
import {
  createTokenAction,
  type CreateTokenResult,
} from "@/app/(dash)/(app)/(dev-settings)/api-tokens/actions";

// Faithful port of src/components/tokens/token-create-dialog.tsx restyled for
// the dashboard-next light theme.
//
// SECURITY: plaintext lives ONLY in this component's `secret` state. It is
// wiped on dialog close, route change, tab blur, visibility-hidden,
// beforeunload — identical matrix to the dark dialog so the security review
// posture is preserved.
//
// The Radix Portal mounts outside the (app) layout's .dashboard-next scope, so
// the Overlay and Content are each wrapped in their own `dashboard-next`
// container to re-apply the .dn-* class scoping.

function InstallSnippet() {
  const lines = [
    // The agent's real CLI: the console script is `upstream` (not
    // `upstream-agent`), and tokens are entered via the shell's `login`
    // prompt (hidden input) rather than a CLI flag — flags would leak the
    // token into shell history. The plaintext shown above is what gets
    // pasted at the prompt.
    "pip install upstream-agent",
    "upstream   # opens the agent shell",
    "# in the shell: type `login` and paste your token, then `start`",
  ];
  // copyable stays OFF here: the dialog already exposes a dedicated copy
  // affordance for the raw secret, and the plaintext must not gain extra
  // copy paths beyond the audited ones.
  return <CodeBlock code={lines.join("\n")} />;
}

/**
 * Light-theme token-creation dialog. Owns the **only** spot in the entire
 * dashboard codebase that ever holds the plaintext API token — kept in this
 * component's `secret` state, wiped on every plausible "user looked away"
 * signal. Keep this contract in lockstep with the dark dialog at
 * `src/components/tokens/token-create-dialog.tsx`.
 *
 * Wipe matrix — five paths, all must remain wired:
 *   1. **Dialog close** — `handleOpenChange(false)` clears `secret`.
 *   2. **Window blur** — `window.addEventListener("blur", wipe)`.
 *   3. **Document visibility hidden** — `document.visibilitychange` fires,
 *      `wipe()` runs when `visibilityState === "hidden"`.
 *   4. **Before-unload** — `window.addEventListener("beforeunload", wipe)`.
 *   5. **Route change** — `usePathname()` effect wipes on segment change.
 *
 * Never lift `secret` to a parent, persist to storage, log via `reportError`,
 * cache in SWR, or place in a URL. The plaintext is shown once; on close it
 * is gone for good.
 *
 * See `docs/architecture.md` "Token plaintext hygiene" for the platform-level
 * posture and `docs/dashboard-next.md` "Token security" for the dashboard-next
 * implementation notes (including the `<div className="dashboard-next">`
 * Portal wrapper that re-establishes the `.dn-*` cascade inside Radix's
 * portal).
 */
export function TokenCreateDialogNext({
  disabled,
  disabledReason,
}: {
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState<{
    plaintext: string;
    prefix: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [expiresEnabled, setExpiresEnabled] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Aggressive wipe: clear plaintext on tab hide, window blur, beforeunload.
  // See AGENTS.md — only this component is ever allowed to hold the secret.
  useEffect(() => {
    if (!secret) return;
    const wipe = () => setSecret(null);
    const onVis = () => {
      if (document.visibilityState === "hidden") wipe();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", wipe);
    window.addEventListener("beforeunload", wipe);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", wipe);
      window.removeEventListener("beforeunload", wipe);
    };
  }, [secret]);

  // Wipe on route change too — usePathname re-renders when the segment
  // changes, so we just compare to the previous pathname ref.
  const wipedPathname = useRef(pathname);
  useEffect(() => {
    if (wipedPathname.current !== pathname && secret) {
      setSecret(null);
    }
    wipedPathname.current = pathname;
  }, [pathname, secret]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSecret(null);
      setError(null);
      setCopied(false);
      // router.refresh() picks up the new row that revalidatePath() flagged.
      router.refresh();
    }
  }

  async function copy() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret.plaintext);
      setCopied(true);
      toast.success("Token copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Select manually with ⌘A.");
    }
  }

  function onSubmit(form: FormData) {
    setError(null);
    startTransition(async () => {
      const result: CreateTokenResult = await createTokenAction(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSecret({ plaintext: result.plaintext, prefix: result.prefix });
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild disabled={disabled} title={disabledReason}>
        <button
          type="button"
          disabled={disabled}
          className="dn-glow-soft relative flex items-center gap-2 whitespace-nowrap rounded-full bg-white/[0.1] px-4 py-2 font-bold text-white transition hover:bg-white/[0.16] disabled:opacity-50 disabled:cursor-not-allowed text-[clamp(0.85rem,1vw,1rem)]"
        >
          <KeyRound className="relative z-10 h-4 w-4" aria-hidden />
          <span className="relative z-10">New Key</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <div className="dashboard-next">
          <Dialog.Overlay className="fixed inset-0 bg-[rgba(20,32,18,0.55)] backdrop-blur-sm z-40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(560px,calc(100vw-2rem))] dn-tile p-6 text-white">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <Dialog.Title className="font-bold text-[clamp(1.1rem,1.6vw,1.4rem)] leading-tight">
                  {secret ? "Token ready" : "Generate API token"}
                </Dialog.Title>
                <Dialog.Description className="text-sm text-[var(--dn-text-50)] mt-1">
                  {secret
                    ? "Copy this token now. It will not be shown again."
                    : "Tokens let your upstream-agent installs talk to the API on behalf of this account."}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  aria-label="Close"
                  className="rounded-full p-1.5 text-[var(--dn-text-50)] hover:text-white hover:bg-white/[0.08] transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </Dialog.Close>
            </div>

            {secret ? (
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
                    Token
                  </label>
                  <div className="flex items-stretch gap-2 mt-1.5">
                    <input
                      ref={inputRef}
                      type="text"
                      value={secret.plaintext}
                      readOnly
                      autoComplete="off"
                      spellCheck={false}
                      onClick={(e) => e.currentTarget.select()}
                      className="flex-1 min-w-0 font-mono text-sm rounded-xl bg-white/[0.06] border border-white/15 px-3 py-2.5 text-white focus:outline-none focus:border-white/30 transition"
                    />
                    <button
                      type="button"
                      onClick={copy}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--dn-creek-mid)] text-white font-bold px-3 py-2 text-sm transition hover:brightness-110"
                    >
                      {copied ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="text-[11px] text-[var(--dn-text-50)] font-mono mt-1.5">
                    prefix: {secret.prefix}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)] mb-1.5">
                    Install snippet
                  </p>
                  <InstallSnippet />
                </div>
                <div className="rounded-xl border border-[#eedc68] bg-[#eedc68]/20 px-3.5 py-2.5 text-xs text-[#8a6d1f]">
                  Save this token now. We never store the plaintext. Close this
                  dialog and it&rsquo;s gone for good.
                </div>
                <div className="flex justify-end">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="rounded-full bg-white/[0.05] border border-white/10 px-4 py-2 text-sm text-white hover:bg-white/[0.08] transition"
                    >
                      Done
                    </button>
                  </Dialog.Close>
                </div>
              </div>
            ) : (
              <form action={onSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="token-name"
                    className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]"
                  >
                    Name
                  </label>
                  <input
                    id="token-name"
                    name="name"
                    type="text"
                    required
                    autoComplete="off"
                    placeholder="warehouse-cam-01"
                    className="w-full rounded-xl bg-white/[0.06] border border-white/15 px-4 py-2.5 text-white placeholder:text-[var(--dn-text-50)] focus:outline-none focus:border-white/30 transition"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={expiresEnabled}
                      onChange={(e) => setExpiresEnabled(e.target.checked)}
                      className="accent-[var(--dn-creek-mid)] w-3.5 h-3.5"
                    />
                    Set expiration date
                  </label>
                  {expiresEnabled ? (
                    <input
                      id="token-expires"
                      name="expires_at"
                      type="datetime-local"
                      required
                      className="w-full rounded-xl bg-white/[0.06] border border-white/15 px-4 py-2.5 text-white focus:outline-none focus:border-white/30 transition mt-1"
                    />
                  ) : (
                    <p className="text-[11px] text-[var(--dn-text-50)] pt-0.5">
                      Token won&rsquo;t expire on its own. Revoke it any time
                      from this page.
                    </p>
                  )}
                </div>
                {error ? (
                  <p className="text-sm text-[#c0473b] font-mono">{error}</p>
                ) : null}
                <div className="flex justify-end gap-3">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="rounded-full bg-white/[0.05] border border-white/10 px-4 py-2 text-sm text-white hover:bg-white/[0.08] transition"
                    >
                      Cancel
                    </button>
                  </Dialog.Close>
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-full bg-[var(--dn-creek-mid)] text-white font-bold px-4 py-2 text-sm transition hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {pending ? "Generating…" : "Generate"}
                  </button>
                </div>
              </form>
            )}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

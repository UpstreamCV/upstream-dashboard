"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Check, Copy, KeyRound, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createTokenAction,
  type CreateTokenResult,
} from "@/app/dashboard-legacy/settings/api-tokens/actions";

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
  return (
    <pre className="mono text-[12px] leading-relaxed text-ink-soft bg-glass-bg-2 border border-glass-stroke-2 rounded-xl p-4 overflow-x-auto">
      {lines.join("\n")}
    </pre>
  );
}

export function TokenCreateDialog({
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

  // Wipe the plaintext aggressively. Per the security review: clear on dialog
  // close, route change, tab hide, blur, beforeunload. Never persist.
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
      // Clear all sensitive state on close.
      setSecret(null);
      setError(null);
      setCopied(false);
      // Make sure the page refreshes to pick up the new row.
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
      <Dialog.Trigger
        asChild
        disabled={disabled}
        title={disabledReason}
      >
        <button
          type="button"
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-full bg-ink text-[#0f1809] font-medium px-4 py-2 text-sm transition hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <KeyRound className="w-4 h-4" />
          Generate token
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-[rgba(8,14,5,0.6)] backdrop-blur-sm z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(560px,calc(100vw-2rem))] glass rounded-3xl p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <Dialog.Title className="display text-xl font-semibold">
                {secret ? (
                  <>
                    Token <em>ready</em>
                  </>
                ) : (
                  <>
                    Generate <em>API token</em>
                  </>
                )}
              </Dialog.Title>
              <Dialog.Description className="text-sm text-ink-soft mt-1">
                {secret
                  ? "Copy this token now. It will not be shown again."
                  : "Tokens let your upstream-agent installs talk to the API on behalf of this account."}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                aria-label="Close"
                className="rounded-full p-1.5 text-ink-soft hover:text-ink hover:bg-white/5 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          {secret ? (
            <div className="space-y-4">
              <div>
                <label className="text-[11px] uppercase tracking-wider mono text-ink-mute">
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
                    className="flex-1 min-w-0 mono text-sm rounded-xl bg-glass-bg border border-glass-stroke px-3 py-2.5 text-ink"
                  />
                  <button
                    type="button"
                    onClick={copy}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-ink text-[#0f1809] font-medium px-3 py-2 text-sm transition hover:bg-white"
                  >
                    {copied ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="text-[11px] text-ink-mute mono mt-1.5">
                  prefix: {secret.prefix}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider mono text-ink-mute mb-1.5">
                  Install snippet
                </p>
                <InstallSnippet />
              </div>
              <div className="rounded-xl border border-[rgba(212,201,138,0.35)] bg-[rgba(212,201,138,0.07)] px-3.5 py-2.5 text-xs text-[#d4c98a]">
                Save this token now. We never store the plaintext. Close this
                dialog and it&rsquo;s gone for good.
              </div>
              <div className="flex justify-end">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="rounded-full bg-glass-bg border border-glass-stroke px-4 py-2 text-sm text-ink hover:bg-white/10 transition"
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
                  className="text-[11px] uppercase tracking-wider mono text-ink-mute"
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
                  className="w-full rounded-xl bg-glass-bg border border-glass-stroke px-4 py-2.5 text-ink placeholder:text-ink-mute focus:outline-none focus:border-accent/60 transition"
                />
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-[11px] uppercase tracking-wider mono text-ink-mute cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={expiresEnabled}
                    onChange={(e) => setExpiresEnabled(e.target.checked)}
                    className="accent-[#5fb869] w-3.5 h-3.5"
                  />
                  Set expiration date
                </label>
                {expiresEnabled ? (
                  <input
                    id="token-expires"
                    name="expires_at"
                    type="datetime-local"
                    required
                    className="w-full rounded-xl bg-glass-bg border border-glass-stroke px-4 py-2.5 text-ink focus:outline-none focus:border-accent/60 transition mt-1"
                  />
                ) : (
                  <p className="text-[11px] text-ink-mute pt-0.5">
                    Token won&rsquo;t expire on its own. Revoke it any time from this page.
                  </p>
                )}
              </div>
              {error ? (
                <p className="text-sm text-[#e89e93] mono">{error}</p>
              ) : null}
              <div className="flex justify-end gap-3">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="rounded-full bg-glass-bg border border-glass-stroke px-4 py-2 text-sm text-ink hover:bg-white/10 transition"
                  >
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-full bg-ink text-[#0f1809] font-medium px-4 py-2 text-sm transition hover:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {pending ? "Generating…" : "Generate"}
                </button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

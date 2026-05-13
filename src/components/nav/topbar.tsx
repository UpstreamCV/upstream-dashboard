"use client";

import Link from "next/link";
import { LogOut, ArrowLeftRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Props = {
  email: string | null;
  accountName: string;
  accountSlug: string;
  role: string;
  hasMultipleAccounts: boolean;
};

export function Topbar({
  email,
  accountName,
  accountSlug,
  role,
  hasMultipleAccounts,
}: Props) {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const res = await fetch("/api/auth/sign-out", { method: "POST" });
      if (res.ok) {
        window.location.href = "/login";
        return;
      }
      toast.error("Sign out failed. Try again.");
    } catch {
      toast.error("Sign out failed. Check your connection.");
    }
    setSigningOut(false);
  }

  return (
    <header className="glass rounded-2xl px-5 py-3 flex items-center justify-between gap-4">
      <div className="min-w-0 flex items-center gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink-mute mono">
            account
          </p>
          <p className="text-sm text-ink truncate">
            {accountName}{" "}
            <span className="text-ink-mute mono text-xs">· {accountSlug}</span>
          </p>
        </div>
        <span className="hidden sm:inline-block text-[10px] uppercase tracking-wider text-accent mono border border-glass-stroke rounded-full px-2 py-0.5">
          {role}
        </span>
        {hasMultipleAccounts ? (
          <Link
            href="/select-account"
            className="inline-flex items-center gap-1.5 text-xs text-ink-soft hover:text-ink transition"
            title="Switch account"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Switch</span>
          </Link>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        {email ? (
          <span className="hidden md:inline text-sm text-ink-soft truncate max-w-[200px]">
            {email}
          </span>
        ) : null}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="inline-flex items-center gap-2 rounded-full bg-glass-bg border border-glass-stroke px-3.5 py-1.5 text-sm text-ink hover:bg-white/10 transition disabled:opacity-60"
        >
          <LogOut className="w-3.5 h-3.5" />
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </header>
  );
}

"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";

// Reusable monospace code/snippet block — factored from the token dialog's
// InstallSnippet so the API Docs / Event Schema static pages share one style.
// Copy is opt-in (`copyable`): the token install snippet keeps it OFF (the
// dialog has its own copy affordance for the raw secret), docs turn it ON.
export function CodeBlock({
  code,
  copyable = false,
  className,
}: {
  code: string;
  copyable?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy. Select manually with ⌘A.");
    }
  }

  return (
    <div className={clsx("relative group", className)}>
      <pre className="font-mono text-[12px] leading-relaxed text-white/80 bg-white/[0.05] border border-white/10 rounded-xl p-4 overflow-x-auto">
        {code}
      </pre>
      {copyable ? (
        <button
          type="button"
          onClick={copy}
          aria-label="Copy code"
          className="absolute right-2 top-2 rounded-lg bg-white/10 p-1.5 text-white/70 opacity-0 transition hover:bg-white/20 group-hover:opacity-100 focus-visible:opacity-100"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>
      ) : null}
    </div>
  );
}

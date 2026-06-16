"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { revokeTokenAction } from "@/app/(dash)/(app)/api-tokens/actions";

// Light-theme port of src/components/tokens/token-row-actions.tsx — same
// two-step confirm pattern, restyled for the white .dn-tile table.
export function TokenRowActionsNext({
  tokenId,
  tokenName,
}: {
  tokenId: string;
  tokenName: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function revoke() {
    startTransition(async () => {
      const form = new FormData();
      form.set("token_id", tokenId);
      const result = await revokeTokenAction(form);
      if (result.ok) {
        toast.success(`Revoked “${tokenName}”`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
      setConfirming(false);
    });
  }

  if (confirming) {
    return (
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="text-[11px] font-mono uppercase tracking-wider text-[var(--dn-text-50)] hover:text-white px-2 py-1"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={revoke}
          disabled={pending}
          className="text-[11px] font-mono uppercase tracking-wider text-[#c0473b] hover:text-[#a33a30] px-2 py-1 disabled:opacity-50"
        >
          {pending ? "Revoking…" : "Confirm revoke"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        title="Revoke token"
        className="inline-flex items-center gap-1.5 rounded-full text-[11px] font-mono uppercase tracking-wider text-[var(--dn-text-50)] hover:text-[#c0473b] transition px-2 py-1"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Revoke
      </button>
    </div>
  );
}

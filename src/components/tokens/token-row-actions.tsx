"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { revokeTokenAction } from "@/app/(dashboard)/settings/api-tokens/actions";

export function TokenRowActions({
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
          className="text-[11px] mono uppercase tracking-wider text-ink-soft hover:text-ink px-2 py-1"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={revoke}
          disabled={pending}
          className="text-[11px] mono uppercase tracking-wider text-[#e89e93] hover:text-[#f5b5ad] px-2 py-1 disabled:opacity-50"
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
        className="inline-flex items-center gap-1.5 rounded-full text-[11px] mono uppercase tracking-wider text-ink-soft hover:text-[#e89e93] transition px-2 py-1"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Revoke
      </button>
    </div>
  );
}

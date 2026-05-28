"use server";

import { revalidatePath } from "next/cache";
import { getActiveAccount } from "@/lib/account/active";
import { patchProcessingConfig } from "@/lib/api/processing-config";
import { reportError } from "@/lib/error";

/**
 * Server Action behind the processing master switch.
 *
 * Boolean payload, no envelope -- the toggle component just calls
 * setProcessingEnabled(next). Revalidates this segment so the next
 * server render reflects the truth even if the optimistic UI got out
 * of sync.
 */
export async function setProcessingEnabled(
  processingEnabled: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { activeAccountId } = await getActiveAccount();
    await patchProcessingConfig({
      accountId: activeAccountId,
      processingEnabled,
    });
    revalidatePath("/dashboard-next/settings");
    return { ok: true };
  } catch (err) {
    reportError(err, { area: "settings.processing-config.patch" });
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : "Could not update processing setting.",
    };
  }
}

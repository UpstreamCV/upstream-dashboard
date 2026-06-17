import Link from "next/link";
import { CameraFormNext } from "@/components/dashboard-next/camera-form-next";
import { getActiveAccount } from "@/lib/account/active";
import { getAccountLimits } from "@/lib/api/accounts";
import { createCameraAction } from "./actions";

// New-camera form. Cameras are configured here (server is the source of
// truth for stream settings); an upstream-agent claims the camera and
// streams it. Viewers see a read-only notice — the action also rejects
// server-side, and the api-server enforces the role regardless.

export default async function NewCameraPage() {
  const { activeAccountId, activeAccount } = await getActiveAccount();
  const limits = await getAccountLimits({ accountId: activeAccountId });
  const canEdit =
    activeAccount.role === "owner" || activeAccount.role === "admin";

  return (
    <section className="space-y-5 md:space-y-6 max-w-3xl">
      <header>
        <p className="text-[clamp(0.62rem,0.8vw,0.78rem)] font-bold uppercase tracking-wide text-[var(--dn-text-50)]">
          fleet
        </p>
        <h1 className="font-bold text-white text-[clamp(1.6rem,3.2vw,2.4rem)]">
          New camera
        </h1>
        <p className="mt-1 text-sm text-white/70">
          The camera starts unassigned; run <code>upstream</code> on the
          machine with the camera and use <code>start</code> to claim and
          stream it.{" "}
          <Link href="/cameras" className="underline">
            Back to cameras
          </Link>
        </p>
      </header>

      <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
        {canEdit ? (
          <CameraFormNext
            action={createCameraAction}
            limits={limits}
            submitLabel="Create camera"
          />
        ) : (
          <p className="text-sm text-[var(--dn-text-50)]">
            Only owners and admins can add cameras. Ask an account owner for
            access.
          </p>
        )}
      </div>
    </section>
  );
}

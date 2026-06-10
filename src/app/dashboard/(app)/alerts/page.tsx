import { AlertsInboxClient } from "@/components/dashboard-next/alerts/alerts-inbox-client";
import { getActiveAccount } from "@/lib/account/active";
import { listAlerts } from "@/lib/api/alerts";
import { listCameras } from "@/lib/api/cameras";

// Rules/Triggers M1 — the account-wide alert inbox. Alerts are raised by the
// api-server's rule evaluator when a processor observation matches an
// enabled rule (authored per-camera under configure → Triggers & Effects).
//
// Server-renders the initial list; <AlertsInboxClient> polls /v1/alerts via
// the proxy every 10s, filters open/resolved client-side per the selected
// tab (each tab is its own server query), and drives mark-read / resolve
// through Server Actions.

export default async function AlertsPage() {
  const { activeAccountId, activeAccount } = await getActiveAccount();
  const canResolve =
    activeAccount.role === "owner" || activeAccount.role === "admin";

  const [alerts, cameras] = await Promise.all([
    listAlerts({ accountId: activeAccountId, limit: 100 }),
    listCameras({ accountId: activeAccountId }),
  ]);

  const cameraNames: Record<string, string> = {};
  for (const camera of cameras) {
    cameraNames[camera.id] = camera.name;
  }

  return (
    <section className="space-y-5 md:space-y-6">
      <header>
        <p className="text-[clamp(0.62rem,0.8vw,0.78rem)] font-bold uppercase tracking-wide text-[var(--dn-text-50)]">
          monitoring
        </p>
        <h1 className="font-bold text-white text-[clamp(1.6rem,3.2vw,2.4rem)]">
          Alerts
        </h1>
        <p className="mt-1 text-sm text-white/70">
          Raised by your camera rules. Create and edit rules per camera under
          Configure → Triggers &amp; Effects.
        </p>
      </header>

      <AlertsInboxClient
        initialAlerts={alerts}
        cameraNames={cameraNames}
        canResolve={canResolve}
      />
    </section>
  );
}

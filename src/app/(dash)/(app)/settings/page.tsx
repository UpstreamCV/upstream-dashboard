import { ProcessingToggleNext } from "@/components/dashboard-next/processing-toggle-next";
import { getActiveAccount } from "@/lib/account/active";
import { getProcessingConfig } from "@/lib/api/processing-config";

// Account-level settings page. Today it carries one control: the
// processing master switch (M3). Future settings (workspace name, alert
// channels, billing-ish things) slot in as additional sections on this
// same page.
//
// Server Component reads the current value via /v1/account/processing-config
// and hands the boolean to the Client Component toggle, which owns the
// optimistic-update + Server Action call.

export default async function SettingsPage() {
  const { activeAccountId } = await getActiveAccount();
  const config = await getProcessingConfig({ accountId: activeAccountId });

  return (
    <div className="space-y-4 md:space-y-6 p-[clamp(1rem,2vw,1.75rem)]">
      <div>
        <h1 className="text-[clamp(1.3rem,2vw,1.8rem)] font-bold text-white">
          Settings
        </h1>
        <p className="mt-1 text-sm text-[var(--dn-text-50)]">
          Account-wide controls. Per-camera settings live on each camera’s
          page.
        </p>
      </div>

      <section className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
        <p className="mb-4 text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
          processor
        </p>
        <ProcessingToggleNext initialEnabled={config.processing_enabled} />
      </section>
    </div>
  );
}

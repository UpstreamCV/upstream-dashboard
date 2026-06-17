import { ProcessingToggleNext } from "@/components/dashboard-next/processing-toggle-next";
import { getActiveAccount } from "@/lib/account/active";
import { getAccount } from "@/lib/api/accounts";
import { getProcessingConfig } from "@/lib/api/processing-config";

// Account-level settings page. Two sections today:
//   - Workspace — read-only account name / slug / plan. Editing (rename) needs
//     a PATCH /v1/account endpoint that doesn't exist yet, so it's display-only
//     (see docs/sitemap-reorg-plan.md "Backend asks").
//   - Processing — the processing master switch (M3), an interactive toggle.
//
// Server Component reads both values and hands the toggle's boolean to the
// Client Component, which owns the optimistic-update + Server Action call.

export default async function SettingsPage() {
  const { activeAccountId } = await getActiveAccount();
  const [account, config] = await Promise.all([
    getAccount({ accountId: activeAccountId }),
    getProcessingConfig({ accountId: activeAccountId }),
  ]);

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
          workspace
        </p>
        <dl className="flex flex-col gap-1.5 text-[clamp(0.82rem,1vw,0.95rem)]">
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--dn-text-50)]">Name</dt>
            <dd className="truncate font-bold text-white">{account.name}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--dn-text-50)]">Slug</dt>
            <dd className="truncate font-mono text-white/80">{account.slug}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--dn-text-50)]">Plan</dt>
            <dd className="truncate font-bold capitalize text-white">
              {account.plan}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-[11px] text-[var(--dn-text-50)]">
          Renaming a workspace isn’t available yet.
        </p>
      </section>

      <section className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
        <p className="mb-4 text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
          processor
        </p>
        <ProcessingToggleNext initialEnabled={config.processing_enabled} />
      </section>
    </div>
  );
}

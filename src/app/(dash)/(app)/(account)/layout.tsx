import { SectionTabs } from "@/components/dashboard-next/section-tabs";

// Account section shell — a persistent sub-nav strip above the Plan & Usage /
// Billing / Audit Logs / Settings pages (mirrors the camera detail layout's
// CameraTabs). The (account) route group adds NO URL segment, so these pages
// keep their flat URLs (/plan-usage, /billing, /audit-logs, /settings) — the
// group just lets one layout render the shared strip. Team is added here (gated)
// once its backend lands.
const TABS = [
  { label: "Plan & Usage", href: "/plan-usage" },
  { label: "Billing", href: "/billing" },
  { label: "Audit Logs", href: "/audit-logs" },
  { label: "Settings", href: "/settings" },
];

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 md:space-y-6">
      <SectionTabs tabs={TABS} ariaLabel="Account sections" />
      {children}
    </section>
  );
}

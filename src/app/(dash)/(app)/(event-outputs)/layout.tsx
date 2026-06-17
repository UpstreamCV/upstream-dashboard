import { SectionTabs } from "@/components/dashboard-next/section-tabs";

// Event Outputs section shell — persistent sub-nav above the Rules / Workflows /
// Alerts pages (and Alert Detail). The (event-outputs) route group adds NO URL
// segment, so the pages keep their flat URLs (/rules, /workflows, /alerts). The
// gated Destinations + Events areas are added here once their backend lands.
const TABS = [
  { label: "Rules", href: "/rules" },
  { label: "Workflows", href: "/workflows" },
  { label: "Alerts", href: "/alerts" },
];

export default function EventOutputsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 md:space-y-6">
      <SectionTabs tabs={TABS} ariaLabel="Event Outputs sections" />
      {children}
    </section>
  );
}

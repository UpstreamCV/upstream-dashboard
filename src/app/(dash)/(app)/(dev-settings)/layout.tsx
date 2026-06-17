import { SectionTabs } from "@/components/dashboard-next/section-tabs";

// Dev Settings section shell — persistent sub-nav above the API Tokens / Event
// Schema / API Docs pages. The (dev-settings) route group adds NO URL segment,
// so API Tokens keeps its flat URL (/api-tokens). The gated Webhooks + Network
// areas are added here once their backend lands.
const TABS = [
  { label: "API Tokens", href: "/api-tokens" },
  { label: "Event Schema", href: "/event-schema" },
  { label: "API Docs", href: "/api-docs" },
];

export default function DevSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 md:space-y-6">
      <SectionTabs tabs={TABS} ariaLabel="Dev Settings sections" />
      {children}
    </section>
  );
}

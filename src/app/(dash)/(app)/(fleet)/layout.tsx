import { CamerasSectionTabs } from "@/components/dashboard-next/cameras-section-tabs";

// Cameras-section shell — a PERSISTENT Cameras / Agents / Active Streams strip
// above the list pages and the detail pages. The (fleet) route group adds no URL
// segment, so the pages keep their flat URLs (/cameras, /agents,
// /stream-sessions). Because the strip lives in this layout (not inline on each
// page), it stays put across navigation — only the content below reloads (via
// the group's loading.tsx).
//
// On a camera DETAIL page this strip sits ABOVE the camera's own CameraTabs
// (a deliberate two-level nav: section strip → per-camera tabs).
export default function FleetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 md:space-y-6">
      <CamerasSectionTabs />
      {children}
    </section>
  );
}

import { SectionTabs } from "./section-tabs";

// The Cameras-section sub-nav (Cameras / Agents / Active Streams). Rendered by the
// (fleet) route-group layout so it PERSISTS across the section's pages (only the
// content reloads). It therefore also sits above the camera DETAIL pages, stacked
// over their own CameraTabs — a deliberate two-level nav (section strip → per-camera
// tabs).
const TABS = [
  { label: "Cameras", href: "/cameras" },
  { label: "Agents", href: "/agents" },
  { label: "Active Streams", href: "/stream-sessions" },
];

export function CamerasSectionTabs() {
  return <SectionTabs tabs={TABS} ariaLabel="Cameras sections" />;
}

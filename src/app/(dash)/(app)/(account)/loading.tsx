import { SectionContentSkeleton } from "@/components/dashboard-next/section-content-skeleton";

// Loading boundary INSIDE the (account) group, so the layout's SectionTabs
// persist and only the page content reloads. See SectionContentSkeleton.
export default function Loading() {
  return <SectionContentSkeleton />;
}

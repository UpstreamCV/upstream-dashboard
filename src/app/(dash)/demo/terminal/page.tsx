import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/demo/demo-mode.server";
import { DemoTerminal } from "@/lib/demo/demo-terminal";

// Act 1 of the demo: the in-app terminal scene. Lives OUTSIDE the (app) route
// group so it renders full-screen with no dashboard chrome. Only reachable in
// demo mode; otherwise bounce to the dashboard.
export default async function DemoTerminalPage() {
  if (!(await isDemoMode())) redirect("/");
  return <DemoTerminal />;
}

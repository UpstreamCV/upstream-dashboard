import { CursorGlow } from "@/components/dashboard-next/cursor-glow";
import { ShellBackdrop } from "@/components/dashboard-next/shell-backdrop";
import { TopbarTools } from "@/components/nav/topbar-next";
import { getActiveAccount } from "@/lib/account/active";
import { DemoBadge } from "@/lib/demo/demo-badge";
import { DemoModeProvider } from "@/lib/demo/demo-mode-context";
import { isDemoMode } from "@/lib/demo/demo-mode.server";
import { DemoStepper } from "@/lib/demo/demo-stepper";
import { getDemoScene } from "@/lib/demo/scene-cookie";
import { AppShell } from "./app-shell";

// Authed shell for the redesign. The (app) route group adds NO URL segment —
// (app)/page.tsx still resolves to / — it exists purely so this layout
// (auth gate + chrome) wraps Home but NOT /login, which sits outside
// the group. getActiveAccount() keeps the same redirect-to-/login behavior.
//
// The per-route chrome arrangement lives in <AppShell> (a Client Component that
// reads the pathname): on Home the identity sits in the left rail and the
// top-right tools render inside the scrolling panel; elsewhere there's no
// header. This layout stays a Server Component for the auth gate + data fetch;
// the tools (a Server Component) are handed to AppShell as a prop.
export default async function DashboardNextAppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user, activeAccount } = await getActiveAccount();
  const name = user.email?.split("@")[0] ?? activeAccount.accountName;
  // Demo mode is resolved once per request here (build flag OR the /demo
  // cookie) and handed to every Client Component below through the provider —
  // they must not read process.env for it.
  const demo = await isDemoMode();
  const demoScene = demo ? await getDemoScene() : null;

  return (
    // h-dvh + overflow-hidden locks the shell to exactly the viewport so the
    // chrome stays put and only the content area scrolls (inside ScrollArea).
    <DemoModeProvider enabled={demo}>
      <div className="dn-shell-bg relative h-dvh overflow-hidden">
        <ShellBackdrop />
        <CursorGlow />
        <AppShell name={name} tools={<TopbarTools demoScene={demoScene} />}>
          {children}
        </AppShell>
        {demo && <DemoStepper />}
        {demo && <DemoBadge />}
      </div>
    </DemoModeProvider>
  );
}

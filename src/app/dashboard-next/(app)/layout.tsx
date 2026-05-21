import { CursorGlow } from "@/components/dashboard-next/cursor-glow";
import { ScrollArea } from "@/components/dashboard-next/scroll-area";
import { ShellBackdrop } from "@/components/dashboard-next/shell-backdrop";
import { SidebarNext } from "@/components/nav/sidebar-next";
import { TopbarNext } from "@/components/nav/topbar-next";
import { getActiveAccount } from "@/lib/account/active";

// Authed shell for the redesign. The (app) route group adds NO URL segment —
// (app)/page.tsx still resolves to /dashboard-next — it exists purely so this
// layout (auth gate + chrome) wraps Home but NOT /dashboard-next/login, which
// sits outside the group. getActiveAccount() keeps the same redirect-to-/login
// behavior the prod dashboard has.
export default async function DashboardNextAppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user, activeAccount } = await getActiveAccount();
  const name = user.email?.split("@")[0] ?? activeAccount.accountName;

  return (
    // h-dvh + overflow-hidden locks the shell to exactly the viewport so the
    // sidebar/topbar stay put and only the content area scrolls (inside
    // ScrollArea). With min-h-dvh a tall page grew the whole column, dragging
    // the rail's height down with it.
    <div className="dn-shell-bg relative h-dvh overflow-hidden">
      <ShellBackdrop />
      <CursorGlow />
      <div className="relative z-10 flex h-full flex-col gap-3 md:gap-5 p-3 md:p-5">
        <TopbarNext name={name} />
        <div className="flex-1 flex gap-3 md:gap-5 min-h-0">
          <SidebarNext />
          <main className="dn-panel flex-1 min-w-0 relative overflow-hidden">
            <ScrollArea>{children}</ScrollArea>
          </main>
        </div>
      </div>
    </div>
  );
}

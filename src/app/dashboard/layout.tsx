import { Sidebar } from "@/components/nav/sidebar";
import { Topbar } from "@/components/nav/topbar";
import { getActiveAccount } from "@/lib/account/active";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user, memberships, activeAccount } = await getActiveAccount();

  return (
    <div className="min-h-dvh p-4 md:p-6 flex gap-4 md:gap-6">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col gap-4 md:gap-6">
        <Topbar
          email={user.email ?? null}
          accountName={activeAccount.accountName}
          accountSlug={activeAccount.accountSlug}
          role={activeAccount.role}
          hasMultipleAccounts={memberships.length > 1}
        />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}

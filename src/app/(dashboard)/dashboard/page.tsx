import { PageHeader } from "@/components/data/page-header";
import { getActiveAccount } from "@/lib/account/active";
import { getDashboardSummary } from "@/lib/api/dashboard";
import { OverviewCards } from "./overview-cards";

export default async function DashboardPage() {
  const { activeAccountId, activeAccount, user } = await getActiveAccount();
  const summary = await getDashboardSummary({ accountId: activeAccountId });

  return (
    <section>
      <PageHeader
        eyebrow="overview"
        title="Hello,"
        accent={user.email?.split("@")[0] ?? activeAccount.accountName}
        description={`What's happening across ${activeAccount.accountName} right now. Counts refresh every 10 seconds.`}
      />
      <OverviewCards initialSummary={summary} />
    </section>
  );
}

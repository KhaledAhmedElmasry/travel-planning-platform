// Admin home (ACC-04; spec section 2, Admin row): open reports count + list, account stats,
// recent audit log entries (5 each, team leader 24 Nov), quick actions.
// openReports      GET /api/admin/reports?status=open (newest first), openReportsTotal = its `total`
// accounts         `total` of GET /api/admin/accounts?role=user, ?role=airline_moderator + ?role=hotel_moderator, ?status=suspended
// audit            GET /api/admin/audit-logs (newest first)
import { BuildingIcon, FlagIcon, PlaneIcon, ShieldIcon, UserPlusIcon, UserXIcon, UsersIcon } from "lucide-react";
import { HOME_LIST_SIZE, HomeList, HomeListRow, HomeSection, QuickActions } from "@/components/app/home-section";
import { StatCard } from "@/components/app/stat-card";
import { formatDate } from "@/lib/format";

/** One item of GET /api/admin/reports (GEN-09, GEN-10). */
export type OpenReport = {
  id: string;
  contentType: "post" | "comment" | "review" | "itinerary";
  contentId: string;
  contentPreview: string;
  reporter: { id: string; name: string; email: string };
  reason: string;
  status: string;
  createdAt: string;
};
/** One item of GET /api/admin/audit-logs (GEN-07). */
export type AuditEntry = {
  id: string;
  admin: { id: string; name: string; email: string };
  action: string;
  targetType: string;
  targetId: string;
  reason: string | null;
  createdAt: string;
};

type Props = {
  openReports: OpenReport[];
  openReportsTotal: number;
  accounts: { users: number; moderators: number; suspended: number };
  audit: AuditEntry[];
};

/** "suspend_account" -> "Suspend account" */
const sentence = (value: string) => value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ");

export function AdminOverview({ openReports, openReportsTotal, accounts, audit }: Props) {
  return (
    <div className="grid gap-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Open reports"
          value={openReportsTotal}
          icon={FlagIcon}
          tone={openReportsTotal > 0 ? "warning" : "default"}
          href="/admin/reports"
        />
        <StatCard label="Users" value={accounts.users} icon={UsersIcon} href="/admin/accounts" />
        <StatCard label="Moderators" value={accounts.moderators} icon={ShieldIcon} href="/admin/accounts" />
        <StatCard label="Suspended" value={accounts.suspended} icon={UserXIcon} href="/admin/accounts" />
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <HomeSection title="Open reports" seeAll="/admin/reports">
          {openReports.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open reports</p>
          ) : (
            <HomeList>
              {openReports.slice(0, HOME_LIST_SIZE).map((report) => (
                <HomeListRow key={report.id}>
                  <span className="font-semibold">
                    {sentence(report.contentType)}{" "}
                    <span className="font-normal text-muted-foreground">{report.contentPreview}</span>
                  </span>
                  <span className="text-sm text-muted-foreground">{formatDate(report.createdAt)}</span>
                  <span className="w-full text-sm">{report.reason}</span>
                </HomeListRow>
              ))}
            </HomeList>
          )}
        </HomeSection>
        <HomeSection title="Recent audit log" seeAll="/admin/audit-log">
          {audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">No admin actions yet</p>
          ) : (
            <HomeList>
              {audit.slice(0, HOME_LIST_SIZE).map((item) => (
                <HomeListRow key={item.id}>
                  <span className="font-semibold">
                    {sentence(item.action)}{" "}
                    <span className="font-normal text-muted-foreground">
                      {item.targetType} {item.targetId}
                    </span>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {item.admin.name} · {formatDate(item.createdAt)}
                  </span>
                </HomeListRow>
              ))}
            </HomeList>
          )}
        </HomeSection>
      </div>
      <QuickActions
        actions={[
          { label: "Create moderator", href: "/admin/moderators/new", icon: UserPlusIcon },
          { label: "Create airline", href: "/admin/providers", icon: PlaneIcon },
          { label: "Create hotel", href: "/admin/providers", icon: BuildingIcon },
        ]}
      />
    </div>
  );
}

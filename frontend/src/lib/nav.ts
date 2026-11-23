// Navigation for each role (MILESTONE2 spec section 2, GEN-14).
// The shells read these lists, so a new page only needs a line here to appear in
// the menu. Paths are the agreed page routes; create the page under src/app/ at
// the same path.
import {
  BarChart3Icon,
  BedDoubleIcon,
  BriefcaseIcon,
  BuildingIcon,
  CalendarRangeIcon,
  ClipboardListIcon,
  FileTextIcon,
  FlagIcon,
  LayoutDashboardIcon,
  LuggageIcon,
  MessageSquareIcon,
  PlaneIcon,
  ReceiptIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  UserPlusIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/session";

export type NavItem = { label: string; href: string; icon?: LucideIcon };

/** Top navbar for guests (PublicShell). */
export const GUEST_NAV: NavItem[] = [
  { label: "Flights", href: "/flights" },
  { label: "Hotels", href: "/hotels" },
  { label: "Itineraries", href: "/itineraries" },
  { label: "Blog", href: "/blog" },
];

/** Top navbar for registered users (AppShell). */
export const USER_NAV: NavItem[] = [
  { label: "Flights", href: "/flights" },
  { label: "Hotels", href: "/hotels" },
  { label: "My Bookings", href: "/bookings" },
  { label: "My Itineraries", href: "/my/itineraries" },
  { label: "Explore Itineraries", href: "/itineraries" },
  { label: "Blog", href: "/blog" },
  { label: "My Posts", href: "/my/posts" },
  { label: "Favourites", href: "/favourites" },
];

/** Sidebars for moderators and admin (DashboardShell). */
export const DASHBOARD_NAV: Record<Exclude<Role, "user">, NavItem[]> = {
  airline_moderator: [
    { label: "Overview", href: "/airline", icon: LayoutDashboardIcon },
    { label: "My airline", href: "/airline/profile", icon: BuildingIcon },
    { label: "Flights", href: "/airline/flights", icon: PlaneIcon },
    { label: "Baggage policy", href: "/airline/baggage-policy", icon: LuggageIcon },
    { label: "Cancellation policy", href: "/airline/cancellation-policy", icon: ScrollTextIcon },
  ],
  hotel_moderator: [
    { label: "Overview", href: "/hotel", icon: LayoutDashboardIcon },
    { label: "My hotel", href: "/hotel/profile", icon: BuildingIcon },
    { label: "Rooms", href: "/hotel/rooms", icon: BedDoubleIcon },
    { label: "Availability", href: "/hotel/availability", icon: CalendarRangeIcon },
    { label: "Policies", href: "/hotel/policies", icon: ScrollTextIcon },
    { label: "Reservations", href: "/hotel/reservations", icon: ClipboardListIcon },
    { label: "Reviews", href: "/hotel/reviews", icon: MessageSquareIcon },
  ],
  admin: [
    { label: "Overview", href: "/admin", icon: LayoutDashboardIcon },
    { label: "Accounts", href: "/admin/accounts", icon: UsersIcon },
    { label: "Create moderator", href: "/admin/moderators/new", icon: UserPlusIcon },
    { label: "Providers", href: "/admin/providers", icon: BriefcaseIcon },
    { label: "Analytics", href: "/admin/analytics", icon: BarChart3Icon },
    { label: "Bookings", href: "/admin/bookings", icon: ReceiptIcon },
    { label: "Reports", href: "/admin/reports", icon: FlagIcon },
    { label: "Audit log", href: "/admin/audit-log", icon: FileTextIcon },
  ],
};

/** Where each role lands after login (ACC-04). */
export const HOME_FOR_ROLE: Record<Role, string> = {
  user: "/home",
  airline_moderator: "/airline",
  hotel_moderator: "/hotel",
  admin: "/admin",
};

/** Profile menu (all logged-in roles). Log out is added separately, at the bottom. */
export const ACCOUNT_NAV: NavItem[] = [
  { label: "Profile", href: "/account", icon: ShieldCheckIcon },
  { label: "Change password", href: "/account/password" },
  { label: "Notifications", href: "/notifications" },
];

/** True when `href` is the current page or a parent of it ("/admin" stays exact). */
export function isActive(pathname: string, href: string): boolean {
  if (href === pathname) return true;
  const isSectionRoot = ["/airline", "/hotel", "/admin"].includes(href);
  return !isSectionRoot && pathname.startsWith(`${href}/`);
}

// The logged-in account as returned by GET /api/auth/me (openapi `Me`, ACC-04, ACC-19).
// Keep it in memory only (React state or a server fetch per request); never in
// localStorage, sessionStorage or a readable cookie (frontend/README.md).

export type Role = "user" | "admin" | "airline_moderator" | "hotel_moderator";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Only for an airline moderator (ACC-13). */
  airlineId?: string;
  /** Only for a hotel moderator (ACC-13). */
  hotelId?: string;
  /** true after an admin reset (ACC-07a) or for a new moderator (ACC-13): go to the change-password page first. */
  mustChangePassword?: boolean;
  emailVerified?: boolean;
  status?: "active" | "suspended" | "deactivated";
};

export const ROLE_LABEL: Record<Role, string> = {
  user: "Traveler",
  admin: "Admin",
  airline_moderator: "Airline moderator",
  hotel_moderator: "Hotel moderator",
};

/** Two initials for the avatar: "Mona Adel" -> "MA". */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

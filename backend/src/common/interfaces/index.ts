import { Role } from '../enums';

// Shared TypeScript interfaces, e.g. the authenticated user attached to the request.

// The logged-in account, set on request.user by JwtAuthGuard and read with @CurrentUser()
// (ACC-04, ACC-11). The role and provider come from the database on every request, so a
// suspension or role change takes effect at once.
export interface AuthUser {
  id: string;
  role: Role;
  sessionId: string;
  // Set only for moderators (ACC-13): the one airline or hotel they manage.
  airlineId: string | null;
  hotelId: string | null;
}

// Next.js proxy (called "middleware" before Next.js 16): runs before every page request.
// It only passes the current path to server components (requireUser() uses it to bring the
// user back after login, ACC-10). It does not decide who may see a page: requireUser() does,
// and the backend checks every API request anyway (GEN-13).
import { NextResponse, type NextRequest } from "next/server";
import { CURRENT_PATH_HEADER } from "@/lib/return-to";

export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set(CURRENT_PATH_HEADER, request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Pages only: not the API (forwarded to the backend), uploads, Next.js files or static files.
  matcher: ["/((?!api/|uploads/|_next/|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};

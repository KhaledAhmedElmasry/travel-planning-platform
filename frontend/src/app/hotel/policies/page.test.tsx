// P-46 hotel policies server page (HTL-09, HTL-10). The page is rendered directly (it is an async function);
// the session, the backend call and the shell are faked.
import { cleanup, render, screen } from "@testing-library/react";
import { isValidElement, Suspense, type ReactElement, type ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";

const backendJson = vi.hoisted(() => vi.fn());
const requireUser = vi.hoisted(() => vi.fn());
const getUnreadCount = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/backend", () => ({ backendJson }));
vi.mock("@/lib/server/session", () => ({ requireUser, getUnreadCount }));
vi.mock("@/components/layout/dashboard-shell", () => ({ DashboardShell: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));

import Page from "./page";

afterEach(() => {
  cleanup();
  backendJson.mockReset();
  requireUser.mockReset();
  getUnreadCount.mockReset();
});

const MODERATOR = { id: "m1", name: "Hotel Mod", email: "mod@x.io", role: "hotel_moderator", hotelId: "h1", mustChangePassword: false };

// Vitest cannot render the async child inside <Suspense>: find it and await it directly
async function resolve(node: ReactNode): Promise<ReactNode> {
  if (!isValidElement(node)) return node;
  const el = node as ReactElement<{ children?: ReactNode }>;
  if (el.type === Suspense) {
    const child = el.props.children as ReactElement;
    return (child.type as (p: unknown) => Promise<ReactNode>)(child.props);
  }
  if (typeof el.type === "function") return resolve((el.type as (p: unknown) => ReactNode)(el.props));
  const kids = el.props.children;
  if (kids === undefined) return el;
  const resolved = await Promise.all((Array.isArray(kids) ? kids : [kids]).map(resolve));
  return { ...el, props: { ...el.props, children: resolved } };
}

// source: Excel HTL-09 / HTL-10 actor "Hotel Moderator"; PDF .md roles table "Hotel Moderator: manages exactly one
// assigned hotel ... policies"; PDF .md section 8 "GET /api/hotels/:id" (the current values of that hotel)
test("only hotel moderators load the page, and their own hotel's times and tiers fill the form", async () => {
  requireUser.mockResolvedValue(MODERATOR);
  getUnreadCount.mockResolvedValue(0);
  backendJson.mockResolvedValue({
    id: "h1",
    name: "Nile View Hotel",
    checkInTime: "15:00",
    checkOutTime: "11:00",
    cancellationTiers: [
      { daysBefore: 10, refundPercentage: 80 },
      { daysBefore: 1, refundPercentage: 20 },
    ],
  });

  render(await resolve(await Page()));

  expect(requireUser).toHaveBeenCalledWith(["hotel_moderator"]);
  expect(backendJson).toHaveBeenCalledTimes(1);
  expect(backendJson.mock.calls[0][0]).toBe("/api/hotels/h1");
  expect((screen.getByLabelText(/Check-in time/) as HTMLInputElement).value).toBe("15:00");
  expect((screen.getByLabelText(/Check-out time/) as HTMLInputElement).value).toBe("11:00");
  expect((screen.getAllByLabelText("Days before check-in") as HTMLInputElement[]).map((i) => i.value)).toEqual(["10", "1"]);
  expect((screen.getAllByLabelText("Refund %") as HTMLInputElement[]).map((i) => i.value)).toEqual(["80", "20"]);
});

// /terms Terms & Privacy (ACC-01 consent link). The shell is replaced by its children: the header
// and footer have their own tests, this file checks the page text and metadata.
import type { ReactNode } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import TermsPage, { metadata } from "./page";

vi.mock("@/components/layout/public-shell", () => ({
  PublicShell: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

afterEach(cleanup);

const SECTIONS = [
  "Who we are",
  "Your account",
  "Bookings and payments",
  "Cancellations and refunds",
  "Content you post",
  "Privacy",
  "Cookies",
  "Contact",
];

// source: spec D13 / MASTER.md - "Placeholder text written by us, clearly marked"; team leader (24 Nov, Q4A, Q6A)
test("the page is titled Terms & Privacy and is clearly marked as placeholder text", () => {
  render(<TermsPage />);
  expect(screen.getByRole("heading", { level: 1, name: "Terms & Privacy" })).toBeTruthy();
  const notice = screen.getByRole("note");
  expect(within(notice).getByText("Placeholder")).toBeTruthy();
  expect(notice.textContent).toContain("Placeholder text for a student project, not a legal agreement.");
});

// source: team leader (24 Nov, Q5A) - a fixed "Last updated" date in the file
test("the page shows a fixed last-updated date", () => {
  render(<TermsPage />);
  expect(screen.getByText(/Last updated/).textContent).toContain("24 Nov 2026");
});

// source: team leader (24 Nov, Q2A, Q8A) - the 8 sections, each reachable from the table of contents
test("every section has a heading and a table-of-contents link to it", () => {
  render(<TermsPage />);
  const toc = screen.getByRole("navigation", { name: "On this page" });
  for (const title of SECTIONS) {
    const heading = screen.getByRole("heading", { level: 2, name: title });
    const link = within(toc).getByRole("link", { name: title });
    expect(heading.id).not.toBe("");
    expect(link.getAttribute("href")).toBe(`#${heading.id}`);
  }
  expect(within(toc).getAllByRole("link")).toHaveLength(SECTIONS.length);
});

// source: team leader (24 Nov, Q12A) - no email, no names
test("the contact section points to the project team through the course", () => {
  render(<TermsPage />);
  expect(screen.getByText("Questions: contact the project team through the course.")).toBeTruthy();
});

// source: .md section 9 - "Public pages should include appropriate metadata for SEO"; team leader (24 Nov, Q9A)
test("the page has a title and a description and is indexable", () => {
  expect(metadata.title).toBe("Terms & Privacy");
  expect(typeof metadata.description).toBe("string");
  expect(metadata.description).not.toBe("");
  expect(metadata.robots).toBeUndefined();
});

// So3ad's pose set and where each pose shows up.
// source: design-system/yallaway/MASTER.md section 9 (pose / where / line table) and spec section 5.1;
// Khaled chose "all poses + placement" through the shared components (popup, 25 Nov 2026).
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { So3ad, type So3adPose } from "./so3ad";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import { SearchLoading } from "./search-loading";

afterEach(cleanup);

const POSES: So3adPose[] = ["wave", "scroll", "tap", "jump", "shrug", "sit", "lost", "watch", "key", "worried", "avatar"];

// source: MASTER.md section 9 - eleven poses, decorative image gets alt="" (hidden from screen readers)
test.each(POSES)("pose %s draws a decorative image", (pose) => {
  const { container } = render(<So3ad pose={pose} />);
  const svg = container.querySelector("svg")!;
  expect(svg.getAttribute("data-pose")).toBe(pose);
  expect(svg.getAttribute("aria-hidden")).toBe("true");
});

// source: MASTER.md section 9 - only an image that carries meaning is announced
test("a labelled pose is an image with that name", () => {
  render(<So3ad pose="key" label="So3ad holding a key" />);
  expect(screen.getByRole("img", { name: "So3ad holding a key" })).toBeDefined();
});

// source: MASTER.md section 9 - "Shrug, empty map | Empty search"
test("an empty search can show the shrug pose", () => {
  const { container } = render(<EmptyState title="No flights found" pose="shrug" />);
  expect(container.querySelector("svg")!.getAttribute("data-pose")).toBe("shrug");
});

// source: MASTER.md section 9 - "Upside-down map | 404 / error"
test("an error state shows So3ad lost", () => {
  const { container } = render(<ErrorState />);
  expect(container.querySelector("svg[data-pose]")!.getAttribute("data-pose")).toBe("lost");
});

// source: MASTER.md section 9 - "Scrolling fast on her phone | Search loading | Hold on, I'm haggling for you…"
test("search loading shows So3ad scrolling with her line", () => {
  const { container } = render(<SearchLoading />);
  expect(screen.getByRole("status").textContent).toBe("“Hold on, I’m haggling for you…”");
  expect(container.querySelector("svg")!.getAttribute("data-pose")).toBe("scroll");
});

// ConfirmDialog (GEN-03): the description can hold blocks, e.g. the RefundPreview of FLT-26 / HTL-21.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { ConfirmDialog } from "./confirm-dialog";
import { Button } from "@/components/ui/button";

afterEach(cleanup);

// source: refund-preview.tsx header - "Put it inside the ConfirmDialog description" (FLT-26, HTL-21); valid HTML (no block inside <p>)
test("a block description (a section) is not put inside a paragraph", async () => {
  render(
    <ConfirmDialog
      trigger={<Button>Open</Button>}
      title="Cancel this booking?"
      description={<section aria-label="Refund">Refund: $190.00</section>}
      confirmLabel="Cancel booking"
      onConfirm={() => {}}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Open" }));
  const section = (await screen.findByRole("alertdialog")).querySelector("section")!;
  expect(section.closest("p")).toBeNull();
  expect(section.parentElement!.tagName).toBe("DIV");
});

// source: MASTER.md section 9 - "Worried, hands up | Confirm dialogs | Are you sure? No take-backs!"
test("a destructive confirmation shows So3ad worried with her line", async () => {
  render(
    <ConfirmDialog trigger={<Button>Open</Button>} title="Delete this post?" description="It is gone for good." confirmLabel="Delete" onConfirm={() => {}} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Open" }));
  const dialog = await screen.findByRole("alertdialog");

  expect(dialog.querySelector('svg[data-pose="worried"]')).not.toBeNull();
  expect(dialog.textContent).toContain("“Are you sure? No take-backs!”");
});

// source: MASTER.md section 9 lists confirm dialogs for delete/cancel only (GEN-03 destructive actions)
test("a non-destructive confirmation has no worried So3ad", async () => {
  render(
    <ConfirmDialog trigger={<Button>Open</Button>} title="Publish?" description="Everyone can see it." confirmLabel="Publish" tone="default" onConfirm={() => {}} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Open" }));
  const dialog = await screen.findByRole("alertdialog");

  expect(dialog.querySelector("svg[data-pose]")).toBeNull();
});

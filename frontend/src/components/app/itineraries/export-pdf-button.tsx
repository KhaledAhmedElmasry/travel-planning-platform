"use client";

// ExportPdfButton
// Part: Lead (foundation)
// Requirements: ITN-28 (Bonus)
// Used by: P-26
// Endpoints: GET /api/itineraries/{id}/pdf
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
//
// <ExportPdfButton itineraryId={itinerary.id} />   (P-26, in the PageHeader actions; owner only)
// Two buttons (team leader decisions 24 Nov):
// - "Export PDF" downloads the file with the backend's name (itinerary-<title>.pdf), toast "PDF downloaded".
// - "Open / Print" opens the PDF in a new tab so the user can print it from the browser's viewer.
// Each shows a spinner while the PDF is made; an error shows the backend's message in a toast.
// A 401 refreshes the session once, then goes to login (apiBlob).
import { useState } from "react";
import { FileDownIcon, PrinterIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiBlob } from "@/lib/api";

// The new tab or the download still reads the object URL for a moment after the click.
const REVOKE_AFTER_MS = 60_000;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Could not make the PDF. Try again.";
}

export function ExportPdfButton({ itineraryId }: { itineraryId: string }) {
  const [busy, setBusy] = useState<"download" | "open" | null>(null);
  const path = `/api/itineraries/${itineraryId}/pdf`;

  async function download() {
    setBusy("download");
    try {
      const { blob, filename } = await apiBlob(path);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename ?? "itinerary.pdf";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
      toast.success("PDF downloaded");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function openToPrint() {
    // Opened before the request: browsers block tabs opened after an await.
    const tab = window.open("", "_blank");
    if (!tab) {
      toast.error("Allow pop-ups for this site to open the PDF.");
      return;
    }
    setBusy("open");
    try {
      const { blob } = await apiBlob(path);
      const url = URL.createObjectURL(blob);
      tab.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
    } catch (error) {
      tab.close();
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" loading={busy === "download"} disabled={busy !== null} onClick={download}>
        <FileDownIcon aria-hidden="true" />
        Export PDF
      </Button>
      <Button variant="ghost" loading={busy === "open"} disabled={busy !== null} onClick={openToPrint}>
        <PrinterIcon aria-hidden="true" />
        Open / Print
      </Button>
    </div>
  );
}

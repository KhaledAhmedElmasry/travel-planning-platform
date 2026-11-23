"use client";

// P-06 deactivate my account (ACC-12, registered users only), after confirmation (GEN-03).
// Blocked by the backend while there are upcoming Confirmed bookings: its message is shown.
// On success: public home with a message (team leader, 23 Nov); client navigation keeps the toast.
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/api";

export function DeactivateAccountSection() {
  const router = useRouter();
  return <DeactivateAccount navigate={(path) => router.push(path)} />;
}

export function DeactivateAccount({ navigate }: { navigate: (path: string) => void }) {
  async function deactivate() {
    try {
      await apiFetch("/api/users/me", { method: "DELETE" });
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      throw err; // keeps the dialog open
    }
    toast.success("Your account has been deactivated");
    navigate("/");
  }

  return (
    <ConfirmDialog
      trigger={<Button variant="destructive">Deactivate account</Button>}
      title="Deactivate your account?"
      description={
        <>
          You will not be able to log in. Your posts and public itineraries will be hidden. Your comments and reviews
          will show &quot;Deleted user&quot;.
        </>
      }
      confirmLabel="Deactivate account"
      cancelLabel="Keep my account"
      onConfirm={deactivate}
    />
  );
}

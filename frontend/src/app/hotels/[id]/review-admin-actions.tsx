"use client";

// P-18 (GEN-10): admin hide / unhide / delete on one review; the list is read again afterwards.
import { useRouter } from "next/navigation";
import { AdminContentActions } from "@/components/app/shared/admin-content-actions";

export function ReviewAdminActions({ id, hidden }: { id: string; hidden: boolean }) {
  const router = useRouter();
  return <AdminContentActions type="review" id={id} hidden={hidden} onHiddenChange={() => router.refresh()} onDeleted={() => router.refresh()} />;
}

"use client";

// ActivityCard
// Part: T3 Itinerary editor
// Requirements: ITN-10, ITN-12
// Used by: P-26
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BudgetAmount } from "@/components/app/budget-amount";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { FormField } from "@/components/app/form-field";
import { ImageUploader } from "@/components/app/image-uploader";
import { TimeInput } from "@/components/app/time-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiFetch } from "@/lib/api";
import { DeleteEntry, EditorForm, EditorSelect, type Option } from "./editor-form";

export type Activity = {
  id: string; name: string; description: string; time?: string; cost?: number;
  currency?: string; images: { id: string; url: string }[];
};

export function ActivityCard({ dayPath, activity, currencies }: {
  dayPath: string; activity?: Activity; currencies: Option[];
}) {
  const router = useRouter();
  const [name, setName] = useState(activity?.name ?? "");
  const [description, setDescription] = useState(activity?.description ?? "");
  const [time, setTime] = useState(activity?.time ?? "");
  const [cost, setCost] = useState(activity?.cost?.toString() ?? "");
  const [currency, setCurrency] = useState(activity?.currency ?? "");
  const [removingId, setRemovingId] = useState<string>();
  const path = activity ? `/api/activities/${activity.id}` : `${dayPath}/activities`;

  async function upload(files: File[]) {
    try {
      for (const image of files) {
        const body = new FormData();
        body.append("image", image);
        await apiFetch(`${path}/images`, { method: "POST", body });
      }
      toast.success("Photos added");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not upload photos.");
      throw error;
    } finally {
      router.refresh();
    }
  }

  const form = (
    <EditorForm label={activity ? "Edit activity" : "Add activity"} path={path} method={activity ? "PATCH" : "POST"}
      payload={() => ({
        name: name.trim(), description: description.trim(),
        ...(time ? { time } : {}),
        ...(cost !== "" ? { cost: Number(cost), currency } : {}),
      })}>
      {(errors) => (
        <>
          <FormField name="name" label="Name" error={errors.name} required>
            <Input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField name="description" label="Description" error={errors.description} required>
            <Textarea required maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormField>
          <FormField name="time" label="Time" error={errors.time}>
            <TimeInput value={time} onChange={(e) => setTime(e.target.value)} />
          </FormField>
          <FormField name="cost" label="Cost" error={errors.cost}>
            <Input type="number" min={0} step="any" value={cost} onChange={(e) => setCost(e.target.value)} />
          </FormField>
          {cost !== "" && (
            <EditorSelect name="currency" label="Currency" options={currencies} value={currency} onChange={setCurrency} error={errors.currency} required />
          )}
        </>
      )}
    </EditorForm>
  );

  if (!activity) return form;

  return (
    <Card>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="font-semibold">{activity.name}</h4>
          {activity.time && <span>{activity.time}</span>}
          {activity.cost !== undefined && activity.currency && <BudgetAmount amount={activity.cost} currency={activity.currency} />}
        </div>
        <p className="whitespace-pre-wrap">{activity.description}</p>
        <FormField label="Photos" name="photos">
          <ImageUploader max={5} existing={activity.images} onAdd={upload} />
        </FormField>
        {activity.images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {activity.images.map((image, index) => (
              <ConfirmDialog key={image.id}
                trigger={<Button variant="ghost" disabled={removingId !== undefined}>Remove photo {index + 1}</Button>}
                title="Remove this photo?" description="The photo will be removed from the activity." confirmLabel="Remove photo"
                onConfirm={async () => {
                  setRemovingId(image.id);
                  try {
                    await apiFetch(`${path}/images/${image.id}`, { method: "DELETE" });
                    toast.success("Photo removed");
                    router.refresh();
                  } catch (error) {
                    toast.error(error instanceof ApiError ? error.message : "Could not remove the photo.");
                    throw error;
                  } finally {
                    setRemovingId(undefined);
                  }
                }}
              />
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {form}
          <DeleteEntry label="Delete activity" description="This removes the activity and its photos from the day." remove={() => apiFetch(path, { method: "DELETE" })} />
        </div>
      </CardContent>
    </Card>
  );
}

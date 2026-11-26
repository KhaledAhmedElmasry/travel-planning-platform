"use client";

// DayCard
// Part: T3 Itinerary editor
// Requirements: ITN-05, ITN-07, ITN-08
// Used by: P-26
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
import { Children, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/app/empty-state";
import { FormField } from "@/components/app/form-field";
import { Price } from "@/components/app/price";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { formatDay } from "@/lib/dates";
import { ActivityCard, type Activity } from "./activity-card";
import { BudgetRow, type Budget } from "./budget-row";
import { DeleteEntry, EditorForm, EditorSelect, InlinePages, type Option } from "./editor-form";
import { LinkBookingDialog, UnlinkBookingButton, type LinkedBooking } from "./link-booking-dialog";
import { TransportRow, type Transport } from "./transport-row";

export type Day = {
  id: string; number: number; date: string; cityId: string; notes: string;
  activities?: Activity[]; budgets?: Budget[];
};

export function DayForm({ path, cities, day }: { path: string; cities: Option[]; day?: Day }) {
  const [cityId, setCityId] = useState(day?.cityId ?? "");
  const [notes, setNotes] = useState(day?.notes ?? "");

  return (
    <EditorForm label={day ? "Edit day" : "Add day"} path={path} method={day ? "PATCH" : "POST"}
      payload={() => ({ cityId, notes: notes.trim() })}>
      {(errors) => (
        <>
          <EditorSelect name="cityId" label="City" options={cities} value={cityId} onChange={setCityId} error={errors.cityId} required />
          <FormField name="notes" label="Notes" error={errors.notes}>
            <Textarea maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormField>
        </>
      )}
    </EditorForm>
  );
}

export function DayCard({ day, itineraryId, cities, currencies, days, transport, bookings, moving, onMove }: {
  day: Day; itineraryId: string; cities: Option[]; currencies: Option[]; days: Option[];
  transport: Transport[]; bookings: LinkedBooking[];
  moving: boolean; onMove: (dayId: string, position: number) => void;
}) {
  const router = useRouter();
  const itineraryPath = `/api/itineraries/${itineraryId}`;
  const path = `${itineraryPath}/days/${day.id}`;
  const [position, setPosition] = useState(String(day.number));
  const linked = bookings.filter((booking) => booking.dayId === day.id);
  const dayTransport = transport.filter((entry) => entry.dayId === day.id);
  const activities = day.activities ?? [];
  const budgets = day.budgets ?? [];

  return (
    <Card onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
      event.preventDefault();
      const id = event.dataTransfer.getData("text/plain");
      if (id && id !== day.id && days.some((option) => option.value === id)) onMove(id, day.number);
    }}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-baseline justify-between gap-2">
          <span>Day {day.number}</span><span className="text-sm font-normal">{formatDay(day.date)}</span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">{cities.find((city) => city.value === day.cityId)?.label ?? day.cityId}</p>
        {day.notes && <p className="whitespace-pre-wrap">{day.notes}</p>}
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <DayForm path={path} cities={cities} day={day} />
          {days.length > 1 && (
            <>
              <Button variant="ghost" draggable={!moving} onDragStart={(event) => {
                event.dataTransfer.setData("text/plain", day.id);
                event.dataTransfer.effectAllowed = "move";
              }} onClick={() => onMove(day.id, Number(position))} disabled={moving}>Move day</Button>
              <Button variant="outline" size="sm" disabled={moving || day.number === 1}
                aria-label={`Move day ${day.number} up`} onClick={() => onMove(day.id, day.number - 1)}>Move up</Button>
              <Button variant="outline" size="sm" disabled={moving || day.number === days.length}
                aria-label={`Move day ${day.number} down`} onClick={() => onMove(day.id, day.number + 1)}>Move down</Button>
              <EditorSelect name="position" label="Move to position" value={position} onChange={setPosition}
                options={days.map((option, index) => ({ value: String(index + 1), label: option.label }))} />
            </>
          )}
          <DeleteEntry label="Delete day" description="The day and its entries will be removed. The remaining days will be renumbered." remove={() => apiFetch(path, { method: "DELETE" })} />
        </div>
        <DaySection title="Activities" size={activities.length} empty="No activities yet">
          {activities.map((activity) => <ActivityCard key={activity.id} activity={activity} dayPath={path} currencies={currencies} />)}
        </DaySection>
        <div><ActivityCard dayPath={path} currencies={currencies} /></div>
        <DaySection title="Budget entries" size={budgets.length} empty="No budget entries yet">
          {budgets.map((entry) => <BudgetRow key={entry.id} dayPath={path} entry={entry} currencies={currencies} />)}
        </DaySection>
        <div><BudgetRow dayPath={path} currencies={currencies} /></div>
        <DaySection title="Intercity transport" size={dayTransport.length} empty="No transport costs yet">
          {dayTransport.map((entry) => (
            <TransportRow key={entry.id} itineraryPath={itineraryPath} dayId={day.id} entry={entry} days={days} cities={cities} currencies={currencies} />
          ))}
        </DaySection>
        <div><TransportRow dayId={day.id} itineraryPath={itineraryPath} days={days} cities={cities} currencies={currencies} /></div>
        <DaySection title="Linked bookings" size={linked.length} empty="No linked bookings yet">
          {linked.map((booking) => (
            <div key={booking.id} className="flex flex-wrap items-center gap-2">
              <Button asChild variant="link">
                <Link href={`/bookings/${booking.bookingType === "flight" ? "flights" : "hotels"}/${booking.bookingId}`}>{booking.description}</Link>
              </Button>
              <StatusBadge kind="booking" status={booking.status} />
              <Price cents={Math.round(booking.amount * 100)} currency={booking.currency} />
              <UnlinkBookingButton itineraryId={itineraryId} linkId={booking.id} onUnlinked={() => router.refresh()} />
            </div>
          ))}
        </DaySection>
        <div>
          <LinkBookingDialog itineraryId={itineraryId} dayId={day.id} dayNumber={day.number}
            linkedBookingIds={bookings.map((booking) => booking.bookingId)} onLinked={() => router.refresh()} />
        </div>
      </CardContent>
    </Card>
  );
}

function DaySection({ title, size, empty, children }: {
  title: string; size: number; empty: string; children: ReactNode;
}) {
  return (
    <section className="grid gap-2">
      <h3 className="font-semibold">{title}</h3>
      {size === 0 ? <EmptyState title={empty} compact /> : <InlinePages items={Children.toArray(children)} />}
    </section>
  );
}

"use client";

// Gallery content for /kit (see page.tsx). Each section shows a component and the
// code to use it. Sample data only.
import { useState, type ReactNode } from "react";
import { FlagIcon, PlaneIcon, UsersIcon, UserXIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BarChart } from "@/components/app/bar-chart";
import { BudgetAmount } from "@/components/app/budget-amount";
import { DatePicker } from "@/components/app/date-picker";
import { DateRangePicker, type DateRangeValue } from "@/components/app/date-range-picker";
import { DateTimePicker } from "@/components/app/date-time-picker";
import { ImageUploader, type ExistingImage } from "@/components/app/image-uploader";
import { MultiSelect } from "@/components/app/multi-select";
import { ReportButton } from "@/components/app/report-button";
import { TagInput } from "@/components/app/tag-input";
import { TiersEditor, validateTiers, type Tier } from "@/components/app/tiers-editor";
import { TimeInput } from "@/components/app/time-input";
import { formatAmount } from "@/lib/format";
import { todayString } from "@/lib/dates";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { ErrorState } from "@/components/app/error-state";
import { FormErrorSummary } from "@/components/app/form-error-summary";
import { FormField } from "@/components/app/form-field";
import { HoldCountdown } from "@/components/app/hold-countdown";
import { LocalTime } from "@/components/app/local-time";
import { NumberStepper } from "@/components/app/number-stepper";
import { PageHeader } from "@/components/app/page-header";
import { PaginationBar } from "@/components/app/pagination-bar";
import { PasswordInput } from "@/components/app/password-input";
import { Price } from "@/components/app/price";
import { So3ad } from "@/components/app/so3ad";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { PublicShell } from "@/components/layout/public-shell";
import { WizardLayout } from "@/components/layout/wizard-layout";
import { formatDate } from "@/lib/format";
import type { SessionUser } from "@/lib/session";

const DEMO_USER: SessionUser = { id: "demo", name: "Nour Hassan", email: "nour@example.com", role: "user" };

const DEMO_ACCOUNTS = [
  { id: "1", name: "Nour Hassan", email: "nour@example.com", role: "Traveler", status: "active" as const, createdAt: "2026-11-12T10:00:00Z" },
  { id: "2", name: "Karim Adel", email: "karim@example.com", role: "Airline moderator", status: "active" as const, createdAt: "2026-11-08T10:00:00Z" },
  { id: "3", name: "Mariam Fawzy", email: "mariam@example.com", role: "Traveler", status: "suspended" as const, createdAt: "2026-11-02T10:00:00Z" },
];

function Section({ title, req, children }: { title: string; req?: string; children: ReactNode }) {
  return (
    <section className="grid grid-cols-[minmax(0,1fr)] gap-4 border-t border-border py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl font-semibold">{title}</h2>
        {req && <span className="text-xs font-medium text-subtle-foreground">{req}</span>}
      </div>
      {children}
    </section>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-border bg-background p-3 text-[13px] leading-relaxed text-muted-foreground">
      <code>{children}</code>
    </pre>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`min-w-0 content-start rounded-xl border border-border bg-card p-6 ${className}`}>{children}</div>;
}

export function KitDemo() {
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(1);
  const [infants, setInfants] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [holdEnd] = useState(() => new Date(Date.now() + 130_000).toISOString());
  const [startDate, setStartDate] = useState<string | undefined>();
  const [stay, setStay] = useState<DateRangeValue>({});
  const [departure, setDeparture] = useState<string | undefined>();
  const [checkInTime, setCheckInTime] = useState("14:00");
  const [countries, setCountries] = useState<string[]>(["EG", "AE"]);
  const [tags, setTags] = useState<string[]>(["cairo", "food"]);
  const [photos, setPhotos] = useState<ExistingImage[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([
    { daysBefore: 30, refundPercentage: 100 },
    { daysBefore: 7, refundPercentage: 50 },
  ]);

  return (
    <PublicShell user={DEMO_USER} unreadNotifications={3}>
      <PageHeader
        title="Yallaway component kit"
        description="Every ready-made component, with sample data and the code to use it. Pages use these and pass props; they never add their own colors or styles. Rules: frontend/README.md. Design: design-system/yallaway/MASTER.md."
      />

      <Section title="Buttons" req="One primary action per screen · 44px tall · GEN-15">
        <Panel className="grid gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Book now</Button>
            <Button variant="secondary">View details</Button>
            <Button variant="ghost">Cancel</Button>
            <Button variant="destructive">Cancel booking</Button>
            <Button variant="link">Forgot password?</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button loading>Pay $1,005.00</Button>
            <Button disabled>Disabled</Button>
          </div>
          <Code>{`<Button>Book now</Button>
<Button variant="destructive" loading={isCancelling}>Cancel booking</Button>
<Button asChild variant="secondary"><Link href="/bookings">My bookings</Link></Button>`}</Code>
        </Panel>
      </Section>

      <Section title="Forms" req="GEN-02 errors under each field · ACC-01 password rules · FLT-11 passengers">
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel className="grid gap-4">
            <FormErrorSummary errors={{ email: "This email is already registered." }} labels={{ email: "Email" }} autoFocus={false} />
            <FormField label="Full name" name="name" required>
              <Input autoComplete="name" defaultValue="Nour Hassan" />
            </FormField>
            <FormField label="Email" name="email" required error="This email is already registered.">
              <Input type="email" autoComplete="email" defaultValue="nour@example.com" />
            </FormField>
            <FormField label="Password" name="password" required>
              <PasswordInput autoComplete="new-password" showRules placeholder="At least 8 characters" />
            </FormField>
            <FormField label="Comment" name="comment" hint="Up to 500 characters (BLG-05).">
              <Textarea maxLength={500} placeholder="Share a tip with other travelers" />
            </FormField>
            <div className="flex items-start gap-3">
              <Checkbox id="terms" />
              <Label htmlFor="terms" className="text-sm leading-snug font-normal">
                I agree to the Terms &amp; Privacy
              </Label>
            </div>
            <Code>{`const errors = fieldErrorMap(apiError); // from @/lib/api-error
<FormField label="Email" name="email" required error={errors.email}>
  <Input type="email" autoComplete="email" />
</FormField>`}</Code>
          </Panel>
          <Panel className="grid gap-4">
            <ToggleGroup type="single" defaultValue="round" variant="outline" aria-label="Trip type">
              <ToggleGroupItem value="one">One-way</ToggleGroupItem>
              <ToggleGroupItem value="round">Round trip</ToggleGroupItem>
            </ToggleGroup>
            <FormField label="Cabin class" name="cabin">
              <Select defaultValue="economy">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="economy">Economy</SelectItem>
                  <SelectItem value="premium_economy">Premium Economy</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                  <SelectItem value="first">First</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <div className="divide-y divide-border">
              <NumberStepper label="Adults" hint="12 years and older" value={adults} min={Math.max(1, infants)} max={9} onChange={setAdults} />
              <NumberStepper label="Children" hint="2 to 11" value={children} max={9} onChange={setChildren} />
              <NumberStepper label="Infants" hint="Under 2, no more than adults" value={infants} max={adults} onChange={setInfants} />
            </div>
            <Code>{`<NumberStepper label="Infants" value={infants} max={adults} onChange={setInfants} />`}</Code>
          </Panel>
        </div>
      </Section>

      <Section title="Status badges" req="Icon + word, never color alone · GEN-11 · PAY-01 · PAY-03 · FLT-30 · HTL-08 · ACC-15 · BLG-03 · GEN-10">
        <Panel className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            {(["pending_payment", "confirmed", "completed", "expired", "cancelled"] as const).map((s) => (
              <StatusBadge key={s} kind="booking" status={s} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge kind="payment" status="succeeded" />
            <StatusBadge kind="refund" status="pending" />
            <StatusBadge kind="refund" status="refunded" />
            <StatusBadge kind="refund" status="failed" />
            <StatusBadge kind="flight" status="scheduled" />
            <StatusBadge kind="flight" status="cancelled" />
            <StatusBadge kind="night" status="booked" detail="YW4K9P" />
            <StatusBadge kind="night" status="blocked" />
            <StatusBadge kind="account" status="suspended" />
            <StatusBadge kind="post" status="draft" />
            <StatusBadge kind="content" status="hidden" />
          </div>
          <Code>{`<StatusBadge kind="booking" status={booking.status} />
<StatusBadge kind="refund" status={refund.status} />`}</Code>
        </Panel>
      </Section>

      <Section title="Money and flight times" req="PAY-04 cents, one currency · ITN-18 budgets · GEN-06 airport time zones">
        <div className="grid gap-4 md:grid-cols-2">
          <Panel className="grid gap-3">
            <div className="flex flex-wrap items-baseline gap-6">
              <Price cents={32000} currency="USD" />
              <Price cents={100500} currency="USD" size="lg" />
              <BudgetAmount amount={1234.5} currency="EGP" />
            </div>
            <Code>{`<Price cents={booking.totalAmount} currency={booking.currency} />
<BudgetAmount amount={summary.total} currency={summary.currency} />`}</Code>
          </Panel>
          <Panel className="grid gap-3">
            <div className="flex items-center justify-between gap-4">
              <LocalTime iso="2027-03-01T06:40:00Z" timeZone="Africa/Cairo" airport="CAI" showDate />
              <PlaneIcon className="size-5 text-subtle-foreground" aria-hidden="true" />
              <LocalTime iso="2027-03-01T10:00:00Z" timeZone="Asia/Dubai" airport="DXB" showDate align="end" />
            </div>
            <Code>{`<LocalTime iso={seg.departureAt} timeZone={seg.from.timeZone} airport={seg.from.code} />`}</Code>
          </Panel>
        </div>
      </Section>

      <Section title="Booking wizard" req="P-14 / P-19 · FLT-22 10-minute hold · PAY-02 policies">
        <WizardLayout
          steps={["Passengers", "Summary", "Policies", "Payment", "Done"]}
          current={2}
          aside={
            <>
              <HoldCountdown expiresAt={holdEnd} />
              <Panel className="grid gap-2 text-[15px]">
                <p className="text-xs font-semibold tracking-wide text-subtle-foreground uppercase">Summary</p>
                <div className="flex justify-between"><span className="text-muted-foreground">2 adults × $320.00</span><Price cents={64000} currency="USD" size="sm" hideCode /></div>
                <div className="flex justify-between"><span className="text-muted-foreground">1 child × $320.00</span><Price cents={32000} currency="USD" size="sm" hideCode /></div>
                <div className="flex justify-between"><span className="text-muted-foreground">1 extra bag</span><Price cents={4500} currency="USD" size="sm" hideCode /></div>
                <div className="mt-2 flex justify-between border-t border-border pt-3 font-bold"><span>Total</span><Price cents={100500} currency="USD" /></div>
              </Panel>
            </>
          }
        >
          <h2 className="text-lg font-semibold">Review the policies</h2>
          <ul className="mt-3 grid gap-1 rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
            <li>30+ days before departure: 100% refund</li>
            <li>7–29 days: 50% refund</li>
            <li>Less than 7 days: no refund</li>
          </ul>
          <div className="mt-4 flex items-start gap-3">
            <Checkbox id="accept" checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} />
            <Label htmlFor="accept" className="text-sm leading-snug font-normal">
              I accept the cancellation and baggage policies
            </Label>
          </div>
          <div className="mt-6 flex justify-between gap-3">
            <Button variant="ghost">Back</Button>
            <Button disabled={!accepted}>Continue to payment</Button>
          </div>
        </WizardLayout>
      </Section>

      <Section title="Empty, error and confirm states" req="GEN-04 empty · GEN-16 feedback · GEN-03 confirm">
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel>
            <EmptyState title="No trips yet" line="So empty! Let's plan something." action={<Button>Search flights</Button>} />
          </Panel>
          <Panel>
            <ErrorState onRetry={() => toast.info("Retrying…")} />
          </Panel>
          <Panel className="grid content-start gap-3">
            <ConfirmDialog
              trigger={<Button variant="destructive">Cancel booking</Button>}
              title="Cancel this booking?"
              description="You leave 34 days before departure, so Nile Air refunds 100%: $1,005.00 back to your card. This can't be undone."
              confirmLabel="Cancel booking"
              cancelLabel="Keep booking"
              onConfirm={() => new Promise<void>((resolve) => setTimeout(() => { toast.success("Booking cancelled. Refund on its way."); resolve(); }, 1200))}
            />
            <Button variant="secondary" onClick={() => toast.success("Booking confirmed. Reference YW4K9P.")}>Success toast</Button>
            <Button variant="secondary" onClick={() => toast.error("Card declined. Try another card before the hold ends.")}>Error toast</Button>
            <Code>{`toast.success("Booking confirmed.") // import { toast } from "sonner"`}</Code>
          </Panel>
        </div>
      </Section>

      <Section title="Dashboards: stats, tabs, table, pagination" req="ACC-14 · GEN-05 page size 10 · FLT-25 tabs">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Users" value={1248} icon={UsersIcon} />
            <StatCard label="Moderators" value={16} icon={PlaneIcon} />
            <StatCard label="Open reports" value={7} icon={FlagIcon} tone="warning" />
            <StatCard label="Suspended" value={3} icon={UserXIcon} />
          </div>
          <Tabs defaultValue="upcoming">
            <TabsList>
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="past">Past</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
            </TabsList>
            <TabsContent value="upcoming" className="pt-4">
              <DataTable
                caption="Accounts"
                rows={DEMO_ACCOUNTS}
                rowKey={(a) => a.id}
                columns={[
                  { header: "Name", cell: (a) => a.name },
                  { header: "Email", cell: (a) => <span className="text-muted-foreground">{a.email}</span>, hideOnMobile: true },
                  { header: "Role", cell: (a) => a.role, hideOnMobile: true },
                  { header: "Status", cell: (a) => <StatusBadge kind="account" status={a.status} /> },
                  { header: "Joined", cell: (a) => <span className="tabular text-muted-foreground">{formatDate(a.createdAt)}</span>, align: "end" },
                ]}
              />
            </TabsContent>
            <TabsContent value="past" className="pt-4">
              <EmptyState compact title="No past trips" description="Trips appear here after you travel." />
            </TabsContent>
            <TabsContent value="cancelled" className="pt-4">
              <EmptyState compact title="No cancelled bookings" />
            </TabsContent>
          </Tabs>
          <PaginationBar page={6} totalPages={20} total={196} hrefFor={(p) => `?page=${p}`} />
          <Code>{`<DataTable caption="Accounts" rows={data.items} rowKey={(a) => a.id} columns={[...]} empty={<EmptyState compact title="No accounts" />} />
<PaginationBar page={data.page} totalPages={data.totalPages} total={data.total} hrefFor={(p) => \`?page=\${p}\`} />`}</Code>
        </div>
      </Section>

      <Section title="Dates and times" req="ITN-01 start date · HTL-11 stay · FLT-03 airport local time · HTL-09 check-in time">
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel className="grid gap-4">
            <FormField label="Itinerary start date" name="startDate" required>
              <DatePicker value={startDate} onChange={setStartDate} min={todayString()} />
            </FormField>
            <FormField label="Check-in and check-out" name="stay" required hint="Check-out must be after check-in.">
              <DateRangePicker value={stay} onChange={setStay} min={todayString()} />
            </FormField>
            <Code>{`<DatePicker value={date} onChange={setDate} min={todayString()} />   // "YYYY-MM-DD"
<DateRangePicker value={{ from, to }} onChange={setStay} min={todayString()} />`}</Code>
          </Panel>
          <Panel className="grid gap-4">
            <FormField label="Departure (local time)" name="departureLocal" required>
              <DateTimePicker value={departure} onChange={setDeparture} airport="CAI" timeZone="Africa/Cairo" min={todayString()} />
            </FormField>
            <FormField label="Check-in time" name="checkInTime" required>
              <TimeInput value={checkInTime} onChange={(e) => setCheckInTime(e.target.value)} />
            </FormField>
            <Code>{`<DateTimePicker value={dep} onChange={setDep} airport="CAI" timeZone="Africa/Cairo" />
// value "2027-03-01T14:30" = departureLocal for POST /api/flights`}</Code>
          </Panel>
        </div>
      </Section>

      <Section title="Choosing several items" req="ITN-01 countries · BLG-01 / BLG-08 tags (max 5, 30 chars)">
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel className="grid gap-4">
            <FormField label="Countries" name="countries" required>
              <MultiSelect
                options={[
                  { value: "EG", label: "Egypt" },
                  { value: "AE", label: "United Arab Emirates" },
                  { value: "GB", label: "United Kingdom" },
                  { value: "US", label: "United States" },
                  { value: "FR", label: "France" },
                  { value: "DE", label: "Germany" },
                  { value: "JP", label: "Japan" },
                  { value: "SA", label: "Saudi Arabia" },
                ]}
                value={countries}
                onChange={setCountries}
                placeholder="Add countries"
                searchPlaceholder="Search countries"
              />
            </FormField>
            <Code>{`<MultiSelect options={countries.map((c) => ({ value: c.code, label: c.name }))} value={codes} onChange={setCodes} />`}</Code>
          </Panel>
          <Panel className="grid gap-4">
            <FormField label="Tags" name="tags">
              <TagInput value={tags} onChange={setTags} />
            </FormField>
            <Code>{`<TagInput value={tags} onChange={setTags} />   // max 5, 30 characters each`}</Code>
          </Panel>
        </div>
      </Section>

      <Section title="Photos and logos" req="GEN-08 JPG/PNG, up to 5 MB, up to 5 per item, 1 airline logo">
        <Panel className="grid gap-4">
          <FormField label="Hotel photos" name="photos" hint="Try a PDF or a file over 5 MB to see the error.">
            <ImageUploader
              max={5}
              existing={photos}
              onAdd={(files) =>
                new Promise<void>((resolve) =>
                  setTimeout(() => {
                    setPhotos((p) => [...p, ...files.map((f, i) => ({ id: `${Date.now()}-${i}`, url: URL.createObjectURL(f) }))]);
                    resolve();
                  }, 600),
                )
              }
              onRemove={(id) => setPhotos((p) => p.filter((x) => x.id !== id))}
            />
          </FormField>
          <Code>{`<ImageUploader max={5} existing={photos} onAdd={uploadPhotos} onRemove={deletePhoto} />
<ImageUploader max={1} noun="logo" existing={logo ? [logo] : []} onAdd={uploadLogo} />`}</Code>
        </Panel>
      </Section>

      <Section title="Cancellation tiers" req="FLT-09 airline · HTL-10 hotel">
        <Panel className="grid gap-4">
          <TiersEditor value={tiers} onChange={setTiers} unit="departure" errors={validateTiers(tiers)} />
          <Code>{`<TiersEditor value={tiers} onChange={setTiers} unit="departure" errors={validateTiers(tiers)} />
// send tiers as [{ daysBefore, refundPercentage }]`}</Code>
        </Panel>
      </Section>

      <Section title="Report and charts" req="GEN-09 reports · ITN-14 budget by category · BON-01 analytics">
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel className="grid content-start gap-3">
            <p className="text-sm text-muted-foreground">On a post, comment, review or itinerary:</p>
            <div className="flex flex-wrap items-center gap-3">
              <ReportButton contentType="post" contentId="demo-post" />
              <ReportButton contentType="comment" contentId="demo-comment" look="icon" />
              <ReportButton contentType="review" contentId="demo-review" alreadyReported />
            </div>
            <p className="text-[13px] text-subtle-foreground">
              Sending works once the same-origin setup forwards /api to the backend.
            </p>
            <Code>{`<ReportButton contentType="post" contentId={post.id} />`}</Code>
          </Panel>
          <div className="grid gap-3">
            <BarChart
              title="Budget by category"
              summary="Accommodation is more than half of the trip budget."
              format={(v) => formatAmount(v, "EUR")}
              data={[
                { label: "Accommodation", value: 640 },
                { label: "Activities", value: 210 },
                { label: "Food", value: 180 },
                { label: "Transport", value: 95 },
              ]}
            />
            <Code>{`<BarChart title="Budget by category" data={rows} format={(v) => formatAmount(v, currency)} />`}</Code>
          </div>
        </div>
      </Section>

      <Section title="So3ad" req="Mascot · MASTER.md section 9 · concept art (final poses later)">
        <Panel className="flex flex-wrap items-end gap-10">
          <So3ad pose="wave" size={200} />
          <So3ad pose="sit" size={160} />
          <div className="max-w-sm">
            <Code>{`<So3ad pose="wave" />   // hero, success
<So3ad pose="sit" />    // empty states`}</Code>
          </div>
        </Panel>
      </Section>
    </PublicShell>
  );
}

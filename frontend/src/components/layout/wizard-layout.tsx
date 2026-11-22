// Booking wizard frame (P-14 flights, P-19 hotels), used INSIDE <AppShell>.
// <WizardLayout steps={STEPS} current={2} aside={<><HoldCountdown .../><SummaryCard .../></>}>
//   ...the current step...
// </WizardLayout>
// One page with a stepper (Khaled's decision, Q11): the step comes from the URL
// (?step=policies) and the booking id is in the path, so a refresh resumes the step
// and Back never loses what was entered. The aside (timer + summary) sits on the
// right on desktop and above the step on phones.
import type { ReactNode } from "react";
import { Stepper } from "@/components/app/stepper";

type WizardLayoutProps = {
  steps: string[];
  current: number;
  children: ReactNode;
  aside?: ReactNode;
};

export function WizardLayout({ steps, current, children, aside }: WizardLayoutProps) {
  return (
    <div className="grid gap-6">
      <Stepper steps={steps} current={current} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {aside && <aside className="order-first grid content-start gap-4 lg:sticky lg:top-24 lg:order-last">{aside}</aside>}
        <section className="min-w-0 rounded-xl border border-border bg-card p-6">{children}</section>
      </div>
    </div>
  );
}

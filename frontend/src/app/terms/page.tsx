// - Terms & Privacy: /terms
// Part: Lead (foundation)
// Requirements: ACC-01 (consent link)
// Endpoints: none (static page)
// Rendering: Static. Not in .md section 9, decided by the team leader (23 Nov): the same text for everyone, it only changes with a new deploy.
// Spec: MILESTONE2_FRONTEND_SPEC.md D13 "Placeholder text written by us, clearly marked". Every sentence
// describes what the code really does (checked 24 Nov 2026); change the text when that behaviour changes.
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { PublicShell } from "@/components/layout/public-shell";

const DESCRIPTION = "How Yallaway handles your account, bookings, payments, refunds, content and data.";

export const metadata: Metadata = {
  title: "Terms & Privacy",
  description: DESCRIPTION,
  alternates: { canonical: "/terms" },
  openGraph: { type: "website", siteName: "Yallaway", title: "Terms & Privacy", description: DESCRIPTION },
};

const LAST_UPDATED = "24 Nov 2026";

const SECTIONS = [
  {
    id: "who-we-are",
    title: "Who we are",
    text: [
      "Yallaway is a student project built for the GIU Software Project I course in 2026.",
      "It is not a real travel agency: payments run in Stripe test mode, so no real money is charged.",
    ],
  },
  {
    id: "your-account",
    title: "Your account",
    text: [
      "To sign up you must accept these terms, and we record the date you accepted them.",
      "After 5 failed log-in attempts the account is locked for 15 minutes, and you are logged out after 30 minutes without activity.",
      "Admins can suspend an account. You can deactivate your own account, unless you still have upcoming confirmed bookings.",
    ],
  },
  {
    id: "bookings-and-payments",
    title: "Bookings and payments",
    text: [
      "When you book a flight or a hotel, the seats or rooms are held for 10 minutes while you pay. If you do not pay in time, the booking expires and they are released.",
      "Before paying you must accept the airline's or hotel's booking and cancellation policies.",
      "Payments are handled by Stripe in test mode: you type your card details into Stripe's own form, and Yallaway never stores them.",
    ],
  },
  {
    id: "cancellations-and-refunds",
    title: "Cancellations and refunds",
    text: [
      "You can cancel a confirmed flight booking before the flight departs, and a hotel reservation before its check-in date.",
      "The refund follows the airline's or hotel's cancellation tiers, based on how many days are left. If no tier applies, there is no refund.",
      "Your booking page shows the refund before you confirm the cancellation. If an airline cancels your flight, you get a full refund.",
    ],
  },
  {
    id: "content-you-post",
    title: "Content you post",
    text: [
      "Other visitors can see the blog posts, comments, reviews and public itineraries you publish. You can edit or delete your own posts and comments.",
      "Registered users can report content, and admins can hide or delete content that breaks the rules.",
    ],
  },
  {
    id: "privacy",
    title: "Privacy",
    text: [
      "We keep the data you give us: your name, email, preferred currency, bookings with the passenger details you enter (name, date of birth, passport number), payment and refund records, and what you post.",
      "Your password is stored only as a bcrypt hash, never as plain text. Deactivating your account does not erase this data.",
      "To show itinerary budgets in other currencies, our server fetches exchange rates from FXRatesAPI; none of your data is sent with that request.",
    ],
  },
  {
    id: "cookies",
    title: "Cookies",
    text: [
      "Yallaway sets two cookies, both for your login session. They are httpOnly (no script can read them), Secure and SameSite=Strict.",
      "We set no advertising or tracking cookies.",
    ],
  },
  {
    id: "contact",
    title: "Contact",
    text: ["Questions: contact the project team through the course."],
  },
];

export default function TermsPage() {
  return (
    <PublicShell>
      <article className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">Terms &amp; Privacy</h1>
          <p className="text-sm text-muted-foreground">Last updated {LAST_UPDATED}</p>
        </header>

        <div role="note" className="flex items-start gap-3 rounded-xl border border-border bg-muted p-4">
          <Badge variant="outline">Placeholder</Badge>
          <p>Placeholder text for a student project, not a legal agreement.</p>
        </div>

        <nav aria-label="On this page">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">On this page</h2>
          <ol className="list-decimal space-y-1 pl-5">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="text-link underline underline-offset-4">
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {SECTIONS.map((section) => (
          <section key={section.id} aria-labelledby={section.id} className="space-y-3">
            <h2 id={section.id} className="scroll-mt-24 text-2xl font-semibold">
              {section.title}
            </h2>
            {section.text.map((sentence) => (
              <p key={sentence} className="text-muted-foreground">
                {sentence}
              </p>
            ))}
          </section>
        ))}
      </article>
    </PublicShell>
  );
}

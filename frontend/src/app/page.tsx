// Home page (guest landing). PLACEHOLDER: the real page (hero with So3ad + flight/hotel
// search, featured public itineraries, popular destinations; spec section 2) is built
// by its area. Keep using <PublicShell fullWidth> and the kit components.
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { So3ad } from "@/components/app/so3ad";
import { PublicShell } from "@/components/layout/public-shell";

export default function HomePage() {
  return (
    <PublicShell>
      <section className="flex flex-col-reverse items-center gap-10 py-10 md:flex-row md:justify-between">
        <div className="grid max-w-xl gap-4">
          <p className="text-sm font-semibold tracking-widest text-cyan uppercase">Flights · Hotels · Itineraries</p>
          <h1 className="text-[clamp(2.25rem,6vw,3rem)] leading-tight font-bold tracking-tight">
            Yalla! Where are we going?
          </h1>
          <p className="text-muted-foreground">
            Search flights and hotels, plan your days, keep your budget in your own currency and share your trip
            with other travelers.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/flights">Search flights</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/hotels">Find a hotel</Link>
            </Button>
          </div>
        </div>
        <So3ad pose="wave" size={260} />
      </section>
    </PublicShell>
  );
}

"use client";

// Quick search on the public home (/) and the user home (/home) (ACC-04; spec section 2:
// "flight/hotel search box"). The forms (FLT-11, HTL-11) hand over the exact backend search
// params; this box opens the search page with them in the URL (/flights?..., /hotels?...).
import { useRouter } from "next/navigation";
import { FlightSearchForm, type Airport } from "@/components/app/search/flight-search-form";
import { HotelSearchForm, type City, type Country } from "@/components/app/search/hotel-search-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** "/flights" + { origin: "CAI", returnDate: undefined } -> "/flights?origin=CAI" */
export function searchHref(path: string, params: object): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return `${path}?${query}`;
}

type Props = { airports: Airport[]; countries: Country[]; cities: City[] };

export function HomeSearch({ airports, countries, cities }: Props) {
  const router = useRouter();
  return (
    <Tabs defaultValue="flights" className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <TabsList>
        <TabsTrigger value="flights">Flights</TabsTrigger>
        <TabsTrigger value="hotels">Hotels</TabsTrigger>
      </TabsList>
      <TabsContent value="flights" className="pt-4">
        <FlightSearchForm airports={airports} onSearch={(params) => router.push(searchHref("/flights", params))} />
      </TabsContent>
      <TabsContent value="hotels" className="pt-4">
        <HotelSearchForm
          countries={countries}
          cities={cities}
          onSearch={(params) => router.push(searchHref("/hotels", params))}
        />
      </TabsContent>
    </Tabs>
  );
}

// /kit: the component gallery for the team. Every kit component with sample data
// and the line of code to use it. Not linked from the menus and hidden from search
// engines. Sample names and bookings are made up.
// Rendering: Static. Not in .md section 9, chosen with the kit (#258): the same demo content for everyone, built once; not linked and hidden from search.
import type { Metadata } from "next";
import { KitDemo } from "./kit-demo";

export const metadata: Metadata = {
  title: "Component kit",
  robots: { index: false, follow: false },
};

export default function KitPage() {
  return <KitDemo />;
}

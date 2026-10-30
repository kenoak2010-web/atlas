import type { Metadata } from "next";
import { Suspense } from "react";
import { CountryScreen } from "@/components/country-screen";

export const metadata: Metadata = { title: "Länder-Dossier" };

export default function Page() {
  return (
    <Suspense>
      <CountryScreen />
    </Suspense>
  );
}

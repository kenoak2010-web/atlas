import type { Metadata } from "next";
import { SearchScreen } from "@/components/screens-misc";

export const metadata: Metadata = { title: "Suche" };

export default function Page() {
  return <SearchScreen />;
}

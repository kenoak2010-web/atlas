import type { Metadata } from "next";
import { HazardsScreen } from "@/components/explore/hazards";

export const metadata: Metadata = { title: "Naturgefahren" };

export default function Page() {
  return <HazardsScreen />;
}

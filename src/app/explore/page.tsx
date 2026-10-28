import type { Metadata } from "next";
import { ExploreHub } from "@/components/explore-hub";

export const metadata: Metadata = { title: "Entdecken" };

export default function ExplorePage() {
  return <ExploreHub />;
}

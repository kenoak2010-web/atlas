import type { Metadata } from "next";
import { MapScreen } from "@/components/map/map-screen";

export const metadata: Metadata = { title: "Karte" };

export default function MapPage() {
  return <MapScreen />;
}

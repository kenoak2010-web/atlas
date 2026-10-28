import type { Metadata } from "next";
import { WeatherScreen } from "@/components/explore/weather";

export const metadata: Metadata = { title: "Wetter" };

export default function Page() {
  return <WeatherScreen />;
}

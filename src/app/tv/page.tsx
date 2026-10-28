import type { Metadata } from "next";
import { TvScreen } from "@/components/tv-screen";

export const metadata: Metadata = { title: "Live-TV" };

export default function TvPage() {
  return <TvScreen />;
}

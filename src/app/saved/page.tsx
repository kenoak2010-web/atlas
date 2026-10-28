import type { Metadata } from "next";
import { SavedScreen } from "@/components/screens-misc";

export const metadata: Metadata = { title: "Gespeichert" };

export default function Page() {
  return <SavedScreen />;
}

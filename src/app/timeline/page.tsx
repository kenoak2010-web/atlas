import type { Metadata } from "next";
import { TimelineScreen } from "@/components/screens-misc";

export const metadata: Metadata = { title: "Zeitleiste" };

export default function Page() {
  return <TimelineScreen />;
}

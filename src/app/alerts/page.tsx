import type { Metadata } from "next";
import { AlertsScreen } from "@/components/screens-misc";

export const metadata: Metadata = { title: "Warnzentrale" };

export default function Page() {
  return <AlertsScreen />;
}

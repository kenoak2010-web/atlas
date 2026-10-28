import type { Metadata } from "next";
import { SettingsScreen } from "@/components/settings-screen";

export const metadata: Metadata = { title: "Einstellungen" };

export default function Page() {
  return <SettingsScreen />;
}

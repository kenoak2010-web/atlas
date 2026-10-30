import type { Metadata } from "next";
import { PrivacyScreen } from "@/components/privacy-screen";

export const metadata: Metadata = { title: "Datenschutz" };

export default function Page() {
  return <PrivacyScreen />;
}

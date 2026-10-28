import type { Metadata } from "next";
import { SourcesScreen } from "@/components/screens-misc";

export const metadata: Metadata = { title: "Quellen" };

export default function Page() {
  return <SourcesScreen />;
}

import type { Metadata } from "next";
import { HumanitarianScreen } from "@/components/explore/humanitarian";

export const metadata: Metadata = { title: "Humanitäres" };

export default function Page() {
  return <HumanitarianScreen />;
}

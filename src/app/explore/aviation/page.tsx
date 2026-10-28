import type { Metadata } from "next";
import { AviationScreen } from "@/components/explore/aviation";

export const metadata: Metadata = { title: "Luftfahrt" };

export default function Page() {
  return <AviationScreen />;
}

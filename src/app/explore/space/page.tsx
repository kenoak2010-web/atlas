import type { Metadata } from "next";
import { SpaceScreen } from "@/components/explore/space";

export const metadata: Metadata = { title: "Weltraum" };

export default function Page() {
  return <SpaceScreen />;
}

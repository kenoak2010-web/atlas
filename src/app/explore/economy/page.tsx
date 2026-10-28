import type { Metadata } from "next";
import { EconomyScreen } from "@/components/explore/economy";

export const metadata: Metadata = { title: "Wirtschaft" };

export default function Page() {
  return <EconomyScreen />;
}

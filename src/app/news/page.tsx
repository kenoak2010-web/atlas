import type { Metadata } from "next";
import { NewsScreen } from "@/components/news-screen";

export const metadata: Metadata = { title: "News" };

export default function NewsPage() {
  return <NewsScreen />;
}

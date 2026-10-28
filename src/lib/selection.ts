"use client";

import { create } from "zustand";
import type { AtlasEvent } from "./types";
import type { NewsCluster } from "./news/types";
import type { Aircraft } from "@/server/providers/aviation";

export type Selection =
  | { type: "event"; event: AtlasEvent }
  | { type: "news"; cluster: NewsCluster }
  | { type: "aircraft"; aircraft: Aircraft; fetchedAt: string | null }
  | null;

export const useSelection = create<{ sel: Selection; select: (s: Selection) => void }>((set) => ({
  sel: null,
  select: (sel) => set({ sel }),
}));

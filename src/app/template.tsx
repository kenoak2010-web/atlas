"use client";

import { usePathname } from "next/navigation";

// Re-mounted on every navigation, so each screen gets a short entrance transition.
// The full-screen map is excluded: a transformed ancestor would offset its fixed layout.
export default function Template({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path.startsWith("/map")) return <>{children}</>;
  return <div className="page-enter">{children}</div>;
}

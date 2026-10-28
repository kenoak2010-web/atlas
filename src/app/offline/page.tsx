import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="page px-6 pt-24 text-center">
      <h1 className="text-[28px] font-bold">Offline</h1>
      <p className="mt-2 text-[15px] text-text-2">
        Keine Verbindung. Bereits geladene Bereiche zeigen zwischengespeicherte Daten mit ihrem Abrufzeitpunkt – nicht als „Live“.
      </p>
      <p className="mt-1 text-[13px] text-text-3">No connection. Previously loaded sections show cached data with its fetch time – never labelled “live”.</p>
      <Link href="/" className="mt-6 inline-flex min-h-[44px] items-center rounded-xl bg-accent px-5 text-[15px] font-semibold text-white">
        Erneut versuchen
      </Link>
    </div>
  );
}

"use client";

import { useT } from "@/lib/i18n";
import { SubPage } from "./sub-page";
import { Card, CardHeader } from "./ui";

// Contact shown in the privacy policy. App Store review requires a reachable contact.
const CONTACT = process.env.NEXT_PUBLIC_PRIVACY_CONTACT ?? "";
const UPDATED = "30.10.2026";

type Section = { title: string; body: string[] };

const DE: Section[] = [
  { title: "Kurz gesagt", body: ["ATLAS hat kein Konto, keine Werbung, kein Tracking und keine Analyse-Tools. Wir verkaufen keine Daten und geben sie nicht weiter."] },
  { title: "Was auf deinem Gerät bleibt", body: ["Einstellungen, gespeicherte Orte, Lesezeichen und Warnungen werden nur lokal auf deinem Gerät gespeichert. Du kannst sie in den Einstellungen mit „Zurücksetzen“ jederzeit löschen. Beim Löschen der App werden sie ebenfalls entfernt."] },
  { title: "Standort", body: ["Nur wenn du es erlaubst und nur, wenn du auf „Mein Standort“ tippst. Die Koordinaten werden auf etwa 1 km gerundet und nur verwendet, um Wetter und Karte für deinen Ort zu laden. Sie werden nicht gespeichert."] },
  { title: "Mitteilungen", body: ["Warnungen werden auf deinem Gerät aus öffentlichen Daten erzeugt und als lokale Mitteilung angezeigt. Dafür wird kein Push-Token und keine Kennung an uns gesendet."] },
  { title: "Server und Datenquellen", body: ["ATLAS lädt öffentliche Daten (z. B. USGS, DWD, NASA, Nachrichten-Feeds) über unseren Server bei Vercel Inc. Dabei verarbeitet Vercel technisch nötige Daten wie IP-Adresse und Zeitpunkt in Server-Logs, die nach kurzer Zeit gelöscht werden.", "Kartenkacheln kommen von OpenFreeMap, Vorschaubilder von den jeweiligen Nachrichtenseiten. Diese Anbieter sehen dabei deine IP-Adresse."] },
  { title: "Live-TV", body: ["Live-TV-Sender werden als YouTube-Player eingebettet. Erst wenn du einen Sender startest, verbindet sich das Gerät mit YouTube (Google). Dann gelten die Datenschutzbestimmungen von Google."] },
  { title: "Kinder", body: ["ATLAS sammelt wissentlich keine personenbezogenen Daten, auch nicht von Kindern."] },
  { title: "Deine Rechte", body: ["Da wir keine personenbezogenen Daten speichern, gibt es bei uns nichts abzufragen oder zu löschen. Für Fragen kannst du uns trotzdem jederzeit schreiben."] },
];

const EN: Section[] = [
  { title: "In short", body: ["ATLAS has no account, no ads, no tracking and no analytics. We do not sell or share data."] },
  { title: "What stays on your device", body: ["Settings, saved places, bookmarks and alerts are stored only on your device. Delete them any time with “Reset” in Settings, or by deleting the app."] },
  { title: "Location", body: ["Only with your permission and only when you tap “My location”. Coordinates are rounded to about 1 km and used only to load weather and the map for your area. They are not stored."] },
  { title: "Notifications", body: ["Alerts are created on your device from public data and shown as local notifications. No push token or identifier is sent to us."] },
  { title: "Server and data sources", body: ["ATLAS loads public data (e.g. USGS, DWD, NASA, news feeds) through our server hosted by Vercel Inc. Vercel processes technically required data such as IP address and time in server logs that are deleted after a short time.", "Map tiles come from OpenFreeMap and preview images from the news sites. These providers see your IP address."] },
  { title: "Live TV", body: ["Live TV channels are embedded YouTube players. Your device only connects to YouTube (Google) once you start a channel; Google's privacy policy applies then."] },
  { title: "Children", body: ["ATLAS does not knowingly collect personal data from anyone, including children."] },
  { title: "Your rights", body: ["We do not store personal data, so there is nothing to request or delete. You can still contact us with any questions."] },
];

export function PrivacyScreen() {
  const { lang } = useT();
  const de = lang === "de";
  return (
    <SubPage title={de ? "Datenschutz" : "Privacy"} subtitle={de ? `Stand: ${UPDATED}` : `Last updated: ${UPDATED}`}>
      {(de ? DE : EN).map((s) => (
        <Card key={s.title}>
          <CardHeader title={s.title} />
          <div className="space-y-2 px-4 pb-4 text-[14px] leading-relaxed text-text-2">
            {s.body.map((b) => (
              <p key={b}>{b}</p>
            ))}
          </div>
        </Card>
      ))}
      {CONTACT && (
        <Card>
          <CardHeader title={de ? "Kontakt" : "Contact"} />
          <p className="px-4 pb-4 text-[14px] text-text-2">
            <a className="text-accent" href={`mailto:${CONTACT}`}>{CONTACT}</a>
          </p>
        </Card>
      )}
    </SubPage>
  );
}

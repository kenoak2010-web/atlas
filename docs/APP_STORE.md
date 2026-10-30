# ATLAS im Apple App Store

Diese Anleitung bringt ATLAS als echte iPhone-App in den App Store, **ohne eigenen Mac**.
Gebaut wird in der Cloud mit Codemagic.

## So funktioniert die App

- Die iPhone-App ist eine **Capacitor**-Hülle (Ordner `ios/`). Sie lädt die ATLAS-Seite von
  Vercel (`https://atlas-mp5l.vercel.app`), weil ATLAS seinen Server für die Daten braucht.
- Dadurch gilt: **Alles, was du an der Web-App änderst, ist sofort auch in der iPhone-App**,
  ohne neues App-Store-Update. Ein neuer Build ist nur nötig, wenn sich etwas Natives ändert
  (Icon, Plugins, Berechtigungen, `ios/`-Ordner, `capacitor.config.ts`).
- Die PWA im Browser funktioniert weiter wie bisher.

### Was die App mehr kann als die Webseite

Apple lehnt Apps ab, die nur „eine Webseite in einer Hülle“ sind (Richtlinie 4.2). Deshalb nutzt
ATLAS in der App echte iOS-Funktionen:

| Funktion | Wo |
|---|---|
| Echte iOS-Mitteilungen für Warnungen (Erdbeben, Unwetter, Eilmeldungen) | Einstellungen → Warnungen |
| Tippen auf eine Mitteilung öffnet direkt die passende Seite | überall |
| Teilen-Menü von iOS für Nachrichten | Nachricht öffnen → Teilen |
| Haptisches Feedback (Vibration) beim Tab-Wechsel | Tab-Leiste |
| Standort über iOS-Ortungsdienste | Wetter, Karte |
| Statusleiste passt sich hell/dunkel an, eigener Startbildschirm und Offline-Seite | App-Start |

Der Code dafür steckt in `src/lib/native.ts`. Im Browser wird davon nichts geladen.

## Was nur du machen kannst

### 1. Apple Developer Program (99 $ pro Jahr)

- Anmelden auf <https://developer.apple.com/programs/enroll/> mit einer Apple-ID mit
  Zwei-Faktor-Authentifizierung.
- **Wichtig:** Man muss **mindestens 18 Jahre alt** sein. Wenn du jünger bist, muss ein
  Elternteil das Konto auf seinen Namen anlegen. Im App Store steht dann sein Name als Anbieter.
  Ihr könnt dich danach in App Store Connect als Nutzer hinzufügen, dann kannst du alles selbst
  machen.
- Als Privatperson anmelden („Individual“). Die Prüfung dauert meist 1 bis 2 Tage.

### 2. App in App Store Connect anlegen

1. <https://appstoreconnect.apple.com> → **Apps** → **+** → **Neue App**.
2. Plattform **iOS**, Name z. B. **„ATLAS – Weltlage live“** (der Name muss im ganzen App Store
   frei sein, „ATLAS“ allein ist vermutlich vergeben).
3. Primäre Sprache **Deutsch**.
4. Bundle-ID: **`io.github.kenoak2010.atlas`**. Falls sie nicht in der Liste steht: zuerst unter
   <https://developer.apple.com/account/resources/identifiers/list> mit **+ → App IDs** anlegen.
5. SKU: frei wählbar, z. B. `atlas-ios-1`.

> Wenn du eine andere Bundle-ID willst, ändere sie an drei Stellen: `capacitor.config.ts`,
> `ios/App/App.xcodeproj/project.pbxproj` und `codemagic.yaml`.

### 3. API-Schlüssel für den Cloud-Build

1. App Store Connect → **Benutzer und Zugriff** → **Integrationen** → **App Store Connect API**
   → **Schlüssel generieren**.
2. Name `Codemagic`, Zugriff **App-Manager**.
3. Die **.p8-Datei herunterladen** (geht nur ein einziges Mal!) und **Issuer-ID** und
   **Schlüssel-ID** notieren.

### 4. Codemagic einrichten (kostenlos, 500 Build-Minuten pro Monat)

1. Auf <https://codemagic.io> mit GitHub anmelden und das Repository `atlas` hinzufügen.
2. **Team settings → Integrations → Developer Portal → Connect**: Issuer-ID, Schlüssel-ID und
   .p8-Datei eintragen. Als Namen **genau** `ATLAS App Store Connect` eingeben.
3. **Team settings → Code signing identities → iOS certificates**: „Generate certificate“
   (Typ *Apple Distribution*) wählen. Codemagic erstellt das Zertifikat für dich.
4. In der App auf **Start new build** klicken, Workflow **ATLAS iOS → TestFlight** wählen.
   Codemagic liest alles Weitere aus `codemagic.yaml`.
5. Nach ca. 10 bis 15 Minuten ist der Build in **TestFlight**.

### 5. Auf dem eigenen iPhone testen

1. App **TestFlight** aus dem App Store laden.
2. In App Store Connect → deine App → **TestFlight** → dich als internen Tester hinzufügen.
3. In TestFlight installieren und ausprobieren: Mitteilungen einschalten, Standort, Teilen,
   Live-TV.

### 6. Store-Eintrag ausfüllen

- **Screenshots**: fertige Bilder im Format 6,9 Zoll (1320 × 2868) liegen im Projekt-Ordner
  `atlas-appstore/screenshots/`. Mindestens 3 hochladen.
- **Beschreibung, Untertitel, Keywords**: Vorschläge in `atlas-appstore/store-text.md`.
- **Datenschutz-URL**: `https://atlas-mp5l.vercel.app/privacy`
- **Kontakt in der Datenschutzerklärung**: In Vercel unter *Settings → Environment Variables*
  die Variable `NEXT_PUBLIC_PRIVACY_CONTACT` mit deiner (oder der Eltern-) E-Mail-Adresse
  anlegen und neu deployen. Apple verlangt einen erreichbaren Kontakt.
- **Support-URL**: z. B. die GitHub-Seite des Projekts oder die Datenschutz-Seite.
- **App-Datenschutz** (Fragebogen): **„Keine Daten erfasst“**. Begründung: kein Konto, kein
  Tracking, Standort wird nur in dem Moment für das Wetter verwendet und nicht gespeichert.
- **Altersfreigabe**: Fragen ehrlich beantworten. Weil Nachrichten über Kriege und Katastrophen
  vorkommen, bei „Realistische Gewalt“ *selten/schwach* wählen. Das ergibt meist 12+.
- **Kategorie**: Nachrichten (zweite Kategorie: Wetter).
- **Preis**: kostenlos.

### 7. Zur Prüfung einreichen

In **App Review → Notizen** auf Englisch etwas wie das hier schreiben:

> ATLAS is a free, ad-free world monitoring app that combines official public data (USGS
> earthquakes, DWD/NWS weather warnings, GDACS disasters, NASA, news feeds). Native features:
> local notifications for configurable alerts (Settings → Alerts), iOS share sheet, haptic
> feedback, location services for local weather. No login required. Live TV uses official
> YouTube embeds of the broadcasters' public live streams.

Die Prüfung dauert meist 1 bis 3 Tage.

## Mögliche Probleme bei der Prüfung

- **Richtlinie 4.2 („zu sehr wie eine Webseite“)**: Wenn Apple trotzdem ablehnt, ist der
  nächste Schritt ein **Home-Bildschirm-Widget** (z. B. letzte Erdbeben). Das braucht
  Swift-Code und wird dann in `ios/` ergänzt.
- **Live-TV**: Apple kann fragen, ob du die Rechte hast. Antwort: Es sind die offiziellen
  YouTube-Einbettungen der Sender, die sie selbst öffentlich anbieten.
- **Mitteilungen im Hintergrund**: Warnungen werden auf dem Gerät erzeugt, also nur, solange
  ATLAS läuft oder kurz im Hintergrund ist. Echte Push-Mitteilungen bei geschlossener App
  brauchen einen Push-Server (APNs). Das ist ein mögliches späteres Update.

## Für Entwickler

```bash
npm run ios:sync    # Plugins und native-shell/ ins iOS-Projekt kopieren
npm run ios:open    # Projekt in Xcode öffnen (nur auf einem Mac)
node scripts/build-icons.mjs   # App-Icon (1024 px, ohne Transparenz) und Startbild neu erzeugen
```

Eine andere Server-Adresse (z. B. eigene Domain) setzt du beim Sync mit
`ATLAS_APP_URL=https://deine-domain.de npm run ios:sync`. Dann auch die Adresse im Button von
`native-shell/offline.html` anpassen.

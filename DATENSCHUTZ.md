# Datenschutzerklärung für Onwan

**Stand: 15.08.2026**

## 1. Verantwortlicher

Khalid Bencherif\
Freiberuflicher Journalist / Onwan\
Berlin, Deutschland\
Postanschrift: siehe [Impressum](/impressum)\
E-Mail: [support@onwan.eu](mailto:support@onwan.eu)

## 2. Dienst und Verarbeitungszwecke

Onwan ist ein KI-gestütztes Arbeitswerkzeug für Journalisten in Google Docs. Personenbezogene Daten
werden verarbeitet, um Benutzer zu authentifizieren, den Dienst und Support bereitzustellen,
Nutzungsberechtigungen zu verwalten, Missbrauch zu verhindern, den Betrieb abzusichern und rechtliche
Pflichten zu erfüllen.

Rechtsgrundlagen sind insbesondere Art. 6 Abs. 1 lit. b DSGVO (Vertrag und vorvertragliche Maßnahmen),
Art. 6 Abs. 1 lit. f DSGVO (sicherer und zuverlässiger Betrieb), Art. 6 Abs. 1 lit. c DSGVO
(gesetzliche Pflichten) und bei freiwilligen Veröffentlichungen wie Testimonials Art. 6 Abs. 1
lit. a DSGVO (Einwilligung).

## 3. Verarbeitete Daten

- Google-Konto-E-Mail, pseudonymer Nutzerbezug, Spracheinstellungen, Lizenz, Plan und Guthaben.
- Für eine Onwan-Aktion ausgewählter Text oder – ohne Auswahl – Inhalt des aktiven Dokument-Tabs,
  Aktionsart, Projektsprache und Ausgabe.
- Ein optionales, vom Nutzer selbst eingegebenes Stilprofil (Tonfall, zu vermeidende Formulierungen,
  Beispielpassagen). Es wird in den nutzerbezogenen Einstellungen von Google Apps Script gespeichert,
  bis der Nutzer es ändert oder löscht, und nur bei stilabhängigen Aktionen mitgesendet.
- Betriebsdaten wie Anfrage-ID, Zeitpunkt, Modell, Token-/Guthabenmenge, Dauer, Status und Fehlercode.
- Technische Verbindungs- und Sicherheitsdaten, die Hosting-Schichten erhalten können, etwa
  IP-Adresse, User-Agent und Zeitstempel.
- Supportnachrichten, Pilot-Feedback und getrennte Einwilligungsnachweise.

## 4. Journalistische Dokumentinhalte

Onwan verwendet die eingeschränkte Google-Berechtigung
`https://www.googleapis.com/auth/documents.currentonly`. Der Zugriff ist damit technisch auf das
Dokument begrenzt, das der Nutzer gerade geöffnet hat – einschließlich aller Tabs dieses Dokuments.
Onwan kann keine anderen Dateien in Google Drive öffnen, auflisten oder durchsuchen.

Ausgewählter Text oder – wenn nichts ausgewählt ist – Inhalt des aktiven Dokument-Tabs wird nur zur
Ausführung der angeforderten Aktion an den Onwan-Backenddienst und an Google Vertex AI (Gemini)
übertragen. Dokumenttext, Prompts und redaktionelle Ausgabe werden nach der Antwort **nicht in der
Onwan-Datenbank gespeichert**; sie bestehen nur flüchtig im Arbeitsspeicher für die Dauer der
jeweiligen Anfrage. Die Anwendungsprotokollierung schwärzt diese Felder vor dem Schreiben, siehe
Abschnitt 7. Google Apps Script kann den letzten Vorschlag oder eine wegen eines Schreibfehlers noch
nicht eingefügte Ausgabe bis zu sechs Stunden im nutzerbezogenen Cache halten, damit kein zweiter
KI-Aufruf berechnet wird. Google Docs speichert das Dokument im Google-Konto des Nutzers.

Nutzer sollten geschützte Quellenidentitäten nicht übermitteln, wenn dies nicht unbedingt erforderlich
und rechtlich sowie redaktionell vertretbar ist.

## 5. Weitergabe, Übermittlung und Offenlegung von Google-Nutzerdaten

Onwan **verkauft keine personenbezogenen Daten**, gibt sie nicht an Datenhändler weiter und verwendet
weder Dokumentinhalte noch sonstige Google-Nutzerdaten für Werbung, Profiling oder Weiterverkauf.

Google-Nutzerdaten werden ausschließlich an die folgenden Auftragsverarbeiter und ausschließlich zu
den genannten Zwecken übermittelt:

| Empfänger | Übermittelte Google-Nutzerdaten | Zweck |
|---|---|---|
| **Google Cloud** – Cloud Run, Firestore, Secret Manager, Cloud Logging (Projekt `onwan-production`) | Pseudonyme Nutzer-Hashes, Lizenz-, Guthaben- und Betriebsdaten; Dokumentinhalt ausschließlich flüchtig während der Anfrageverarbeitung | Betrieb des Dienstes, Authentifizierung, Verwaltung der Nutzungsberechtigungen |
| **Google Cloud Vertex AI (Gemini)** | Der für die Aktion ausgewählte Text bzw. der Inhalt des aktiven Dokument-Tabs, Projektsprache, Aktionsart und – falls gesetzt – das Stilprofil | Ausführung der vom Nutzer angeforderten redaktionellen Aktion |
| **Google Workspace / Google Docs, Apps Script** | Das vom Nutzer geöffnete Dokument und die nutzerbezogenen Add-on-Einstellungen | Anzeige der Seitenleiste und Schreiben der Ergebnisse in das Dokument |
| **Google (Gmail)** | Inhalt der Support-Korrespondenz, soweit vom Nutzer selbst mitgeteilt | Beantwortung von Supportanfragen |

Darüber hinaus werden Google-Nutzerdaten nur offengelegt: auf ausdrückliche Weisung des Nutzers;
soweit zur Abwehr von Missbrauch, Betrug oder Sicherheitsvorfällen technisch erforderlich; im Rahmen
eines rechtmäßigen Betriebsübergangs; sowie bei gesetzlicher oder behördlicher/gerichtlicher
Verpflichtung.

Google verwendet die über Vertex AI übermittelten Eingaben und Ausgaben nach den Google-Cloud-
Bedingungen **nicht zum Training seiner allgemeinen Modelle**; die Verarbeitung erfolgt als
Auftragsverarbeitung nach dem Google Cloud Data Processing Addendum. Eine Einsichtnahme in
Dokumentinhalte durch Onwan findet nicht statt – Supportfälle werden ausschließlich anhand der vom
Nutzer selbst mitgeteilten Angaben bearbeitet.

Onwans Nutzung und Weitergabe von Informationen aus Google-APIs richtet sich nach der
[Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)
einschließlich der Limited-Use-Anforderungen.

## 6. Keine Nutzung von Google-Workspace-Daten für das Training von KI-Modellen

Onwan verwendet **keine** über Google-Workspace-APIs erhaltenen Nutzerdaten – insbesondere keine
Dokumentinhalte, keine Prompts und keine generierten Ausgaben – um verallgemeinerte oder nicht
personalisierte Modelle der künstlichen Intelligenz oder des maschinellen Lernens zu entwickeln, zu
verbessern oder zu trainieren. Onwan trainiert keine eigenen Modelle und übermittelt keine
Google-Workspace-Daten an Dritte zu Trainingszwecken.

Der für eine Aktion übermittelte Text wird ausschließlich verwendet, um die vom Nutzer angeforderte
Antwort in derselben Anfrage zu erzeugen. Google verwendet die über Google Cloud Vertex AI
übermittelten Eingaben und Ausgaben nach den Google-Cloud-Bedingungen nicht zum Training seiner
allgemeinen Modelle. Es findet keine menschliche Überprüfung der Dokumentinhalte zu Trainings- oder
Qualitätszwecken statt.

## 7. Technische und organisatorische Maßnahmen

Onwan schützt personenbezogene Daten – einschließlich der besonders schutzbedürftigen
journalistischen Dokumentinhalte und der Google-Kontodaten – durch die folgenden **umgesetzten**
Maßnahmen:

- **Verschlüsselte Übertragung.** Alle Verbindungen zwischen Add-on, Onwan-Backend und Google Cloud
  laufen ausschließlich über TLS (HTTPS). Die Website liefert zusätzlich HSTS aus.
- **Verschlüsselte Speicherung.** Sämtliche in Google Cloud abgelegten Daten (Firestore, Secret
  Manager, Cloud Logging) werden von Google standardmäßig im Ruhezustand verschlüsselt.
- **Datenminimierung bei sensiblen Inhalten.** Dokumenttext, Prompts, Stilprofil und generierte
  Ausgaben werden nicht in der Onwan-Datenbank gespeichert.
- **Pseudonymisierung.** Google-Konto-Kennung und E-Mail-Adresse werden mit SHA-256 und einem
  ausschließlich serverseitig in Google Secret Manager gehaltenen Salt gehasht. In der Datenbank
  stehen nur diese Hashwerte; die E-Mail-Adresse im Klartext wird dort nicht gespeichert.
- **Protokollschwärzung.** Die Protokollierung ersetzt definierte Felder – Dokumenttext, Ideentext,
  Stilprofil, Prompt, generierte Ausgabe, E-Mail-Adresse, Token und Authorization-Header – vor dem
  Schreiben durch `[REDACTED]`. Diese Schwärzung ist durch einen automatisierten Test abgesichert.
- **Authentifizierung.** Jede Anfrage an das Backend erfordert ein von Google ausgestelltes ID-Token,
  das serverseitig gegen die fest hinterlegte OAuth-Client-Kennung dieses Projekts geprüft wird.
  Nicht bestätigte Google-Konten werden abgewiesen.
- **Zugriffsbeschränkung.** Die Datenbank ist ausschließlich über das Dienstkonto des Backends
  erreichbar. Ein direkter Zugriff aus dem Browser oder aus Apps Script ist durch Sicherheitsregeln
  vollständig ausgeschlossen.
- **Geheimnisverwaltung.** Der Hash-Salt liegt in Google Secret Manager und wird erst zur Laufzeit
  eingebunden. Im Add-on und im Browser des Nutzers befindet sich **kein**
  KI- oder Zahlungsschlüssel.
- **Minimaler Berechtigungsumfang.** Onwan fordert `documents.currentonly` an und kann dadurch
  technisch keine anderen Dateien in Google Drive lesen (siehe Abschnitt 4).
- **Vorfallbehandlung.** Sicherheitsvorfälle mit Risiko für betroffene Personen werden untersucht und,
  soweit Art. 33 und 34 DSGVO dies verlangen, der Aufsichtsbehörde und den Betroffenen gemeldet.

Kein System ist absolut sicher.

## 8. Speicherorte und Drittlandübermittlung

Der Onwan-Backenddienst (Cloud Run) und die Datenbank (Firestore) werden in der Google-Cloud-Region
`europe-southwest1` (Madrid, Spanien) betrieben; diese Daten verbleiben damit in der Europäischen
Union. Die Gemini-Modelle werden über den **globalen** Vertex-AI-Endpunkt aufgerufen, sodass die
Verarbeitung des für eine Aktion übermittelten Textes auch außerhalb der EU bzw. des EWR stattfinden
kann.

Grundlage der Verarbeitung durch Google ist das Google Cloud Data Processing Addendum, das
Übermittlungen in Drittländer auf die EU-Standardvertragsklauseln nebst ergänzenden Maßnahmen stützt.

## 9. Speicherdauer

- Redaktioneller Inhalt in Onwan-Server-/Datenbankspeicherung: keine Speicherung nach der Antwort;
  nutzerbezogener Apps-Script-Wiederherstellungscache bis zu sechs Stunden.
- Inhaltsfreie Betriebsereignisse: 90 Tage.
- Support und Pilot-Feedback: 12 Monate nach dem letzten Kontakt.
- Einwilligungsnachweise: solange der Nachweis oder das Testimonial genutzt wird, zuzüglich einer
  angemessenen Nachweisfrist.

Backups und Systeme der Auftragsverarbeiter können für die endgültige Löschung zusätzliche Zeit
benötigen.

## 10. Rechte betroffener Personen

Betroffene haben nach Maßgabe der DSGVO insbesondere Rechte auf Auskunft, Berichtigung, Löschung,
Einschränkung, Datenübertragbarkeit, Widerspruch und Widerruf einer Einwilligung. Anfragen gehen an
[support@onwan.eu](mailto:support@onwan.eu). Gesetzlich aufzubewahrende Unterlagen können
nicht vorzeitig gelöscht werden. Google-Zugriff kann außerdem jederzeit in den Sicherheitseinstellungen
des Google-Kontos widerrufen werden.

## 11. Cookies

Onwan setzt keine Werbe- oder Tracking-Cookies und bindet keine Analyse- oder Werbedienste Dritter
ein. Die Website benötigt für ihre Auslieferung keine Cookies. Google kann auf seinen eigenen Seiten –
etwa bei der Google-Anmeldung – notwendige Sicherheits-, Anmelde- oder Zahlungstechnologien einsetzen;
diese unterliegen den Datenschutzhinweisen des jeweiligen Anbieters.

## 12. Journalistische Tätigkeit

Die Plattform unterstützt journalistische Arbeit. Sie nimmt jedoch nicht pauschal eine Ausnahme nach
Art. 85 DSGVO in Anspruch, nur weil Betreiber oder Nutzer Journalisten sind. Ob besondere
presserechtliche Regeln oder Quellenschutz eingreifen, ist für die konkrete journalistische
Verarbeitung gesondert zu prüfen.

## 13. Beschwerderecht

Betroffene haben das Recht, sich bei einer Datenschutzaufsichtsbehörde zu beschweren. Für Berlin ist
dies die [Berliner Beauftragte für Datenschutz und Informationsfreiheit](https://www.datenschutz-berlin.de/).

## 14. Änderungen

Materielle Änderungen werden mit neuem Stand veröffentlicht und – soweit erforderlich – unmittelbar
mitgeteilt. Onwan ist nicht für Personen unter 18 Jahren bestimmt.

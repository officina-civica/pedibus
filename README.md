# Pedibus Vedano

App per gestire il pedibus della scuola primaria di Vedano al Lambro, un'iniziativa del comitato
Officina Civica. Genitori segnalano le assenze, volontari fanno i turni e l'appello, l'amministratore
vede tutto e interviene solo quando l'automatismo non basta.

Questo repository contiene le **fondamenta**: il database su Supabase con schema, regole, visibilità per
ruolo e job a orario, più un test che rigioca un'intera giornata, e l'app (PWA, Next.js, shadcn/ui) con le
schermate del prototipo per i tre ruoli.

Documenti di riferimento (Claude Docs): *App Pedibus – Requisiti iniziali*, *Ipotesi UX*, e il prototipo
interattivo *Pedibus Vedano* (demo con regia + mappa di tutte le schermate).

## Struttura

```
src/                                  l'app (Next.js 16, App Router, Tailwind 4, shadcn/ui)
  app/accesso                         telefono → codice SMS; passkey
  app/(app)/…                         presenze, avvisi, profilo, turni, appello, oggi, iscrizioni, linee
  app/iscrizione                      il modulo di iscrizione
  app/(app)/azioni*.ts                server actions: ogni regola è una RPC del database
  components/ui                       i componenti shadcn/ui installati dalla CLI (non si modificano a mano: `npx shadcn add -o`)
  components/blocchi.tsx              i mattoni dell'app che non sono shadcn: H2, Rows/Row, Avatar con le iniziali
  app/globals.css                     il tema: token shadcn (zinc) + `brand` (arancio pettorina) e `success`
  lib/supabase                        client browser / server (@supabase/ssr); proxy.ts rinfresca la sessione
  lib/database.types.ts               tipi del DB scritti a mano (da sostituire con `supabase gen types`)
public/sw.js, manifest.webmanifest    PWA: service worker per le push, icone
supabase/
  config.toml                         configurazione CLI
  migrations/
    20261027000100_schema.sql         tabelle, enum, vincoli, trigger
    20261027000200_regole.sql         RPC e funzioni dei job (presenze, soglie, escalation, appello, bozza)
    20261027000300_rls.sql            chi vede cosa, per ruolo
    20261027000400_job.sql            dispatcher pg_cron ogni 5 minuti, orari in Europe/Rome
    20261027000500_avvisi_push.sql    abbonamenti push, esiti di consegna, webhook verso la Edge Function
    20261027000600_viste_app.sql      letture del genitore (stato delle linee, giorno di riferimento)
    20261027000700_letture_turni.sql  letture di volontario e admin (turno, appello, riepilogo)
    20261027000800_rls_deleghe.sql    il genitore vede il proprio delegato (trovato dal giro e2e)
    20261027000900_deleghe_app.sql    aggiungi_delega(telefono): il backup del genitore dall'app
    20261027001000_sms_solo_otp.sql   interruttori SMS (sms_avvisi, sms_ripiego) + canali(), imposta_canale()
    20261027001100_registrazione.sql  registrati(), nomina_admin(); fermata facoltativa, assegnata dall'admin in decidi_iscrizione()
    20261027001200_linee_admin.sql    salva_linea(), sospendi_linea(), fermate (salva, sposta, elimina), chiusure: la gestione dall'app
  functions/invia-avvisi/index.ts     la Edge Function che svuota la coda: Web Push (+ SMS Twilio se acceso)
  seed.sql                            il "martedì a Vedano" del prototipo (solo sviluppo)
prototipo/index.html                  il prototipo interattivo (demo con regia + mappa delle schermate)
tests/
  e2e/                                Supabase in miniatura (PostgREST + supalite) e il giro da browser
  run.sh                              crea un DB locale, applica tutto, rigioca la giornata
  replay.sql                          le 8 fasi + verifiche RLS per genitore, delegato, volontario, admin, anonimo
  shim_auth.sql                       il minimo di auth.* per girare senza Supabase (non è una migrazione)
```

## Modello dati in una riga per tabella

- `comuni`, `scuole`, `calendario_chiusure` — territorio e giorni senza pedibus.
- `linee`, `fermate` — percorsi con soglie, minimo volontari, orari di chiusura (18:00 / 21:00) per linea.
- `persone` (= `auth.users`), `ruoli` (genitore / volontario / admin, per scuola, con approvazione).
- `bambini`, `iscrizioni` (bambino + linea + fermata + anno, stato, chi ha deciso, versione informativa), `informative`.
- `deleghe` (il backup del genitore), `contatti_emergenza`, `accessi_contatti` (ogni consultazione registrata).
- `disponibilita` (settimana tipo), `eccezioni_disponibilita` (un giorno diverso), `dotazioni` (kit, pettorina, paletta).
- `bozze_turni` (bozza mensile: bozza → inviata → pubblicata, `stale` se cambia una disponibilità), `turni` (una linea in un giorno, con lo stato della giornata), `turni_volontari`.
- `presenze` — presenti salvo avviso: una riga solo se qualcuno ha segnato qualcosa; `tardiva` dopo la chiusura.
- `appelli`, `appello_bambini` — fermata per fermata: atteso, salito, non trovato, aggiunto.
- `avvisi` — uno per destinatario; `sms = true` per gli urgenti; `push_esito` / `sms_esito` scritti dalla Edge Function.
- `job_orari`, `job_eseguiti` — orari dei job modificabili dal pannello, registro delle esecuzioni.
- `push_abbonamenti` — un abbonamento Web Push per browser/dispositivo; `impostazioni` — chiavi di servizio, senza policy (nessun utente le legge).

## Le regole, dove stanno

Tutto ciò che ha una regola passa da una funzione (RPC) e non da scritture dirette sulle tabelle:

| Chi | Funzione | Cosa fa |
|---|---|---|
| genitore / delegato | `segna_presenza(bambino, stato, giorno)` | segna o annulla un'assenza; dopo le 18:00 è tardiva: avvisa volontari e admin, rivaluta la soglia |
| volontario | `non_posso_venire(turno)` | escalation: backup avvisati (urgente), admin avvisato; dopo 10 minuti tutti i volontari |
| volontario | `copro_turno(turno)` | un volontario approvato copre; se si torna al minimo l'escalation si chiude |
| volontario di turno | `apri_appello`, `segna_salito`, `aggiungi_all_appello`, `prossima_fermata`, `consegna` | il giro: chi non sale è "non trovato" e il genitore lo sa subito; si aggiunge solo un iscritto; la consegna avvisa le famiglie |
| volontario di turno | `contatti_emergenza_turno(turno)` | unica via ai contatti: solo durante il turno, consultazione registrata |
| volontario | `imposta_disponibilita`, `segna_eccezione` | settimana tipo ed eccezioni; un'eccezione dopo la bozza la rende "da rivedere" e avvisa l'admin |
| admin | `decidi_iscrizione`, `decidi_ruolo`, `genera_bozza`, `invia_bozza`, `pubblica_bozza` | approvazioni e bozza mensile |
| job | `chiudi_assenze` 18:00 · `soglia_definitiva` 21:00 · `controllo_volontari` 6:30 · `allarga_escalation` ogni 5' | lanciati da `esegui_job()` via pg_cron, orari in Europe/Rome, una volta al giorno |

`genera_bozza` è greedy e deterministico: rispetta i vincoli duri (disponibilità ed eccezioni, mai più di 2 turni
a settimana, un kit per turno quando possibile) senza ottimizzare. Con i 6 volontari del seed mostra i buchi
invece di nasconderli (lunedì scoperti, giovedì senza kit): è un segnaposto onesto per l'algoritmo a vincoli.

## Chi vede cosa (RLS)

- **Genitore**: solo le linee su cui ha bambini con iscrizione approvata — stato dei turni, avvisi, consegne.
  Mai nomi di altri bambini, mai chi è di turno (i nomi dei volontari arrivano nei testi degli avvisi).
- **Delegato** (backup del genitore): i bambini delegati, per segnare presenze. Niente contatti, niente avvisi altrui.
- **Volontario**: i bambini della propria linea solo il giorno del proprio turno; i colleghi e i turni della scuola;
  i contatti d'emergenza solo via `contatti_emergenza_turno`.
- **Amministratore**: tutto nella propria scuola; ogni decisione resta registrata con chi e quando.
- **Anonimo**: linee, fermate, informativa (servono per iscriversi).

## Avvisi: push; SMS solo con gli interruttori accesi (deciso il 27/10)

Il database mette in coda (`avvisi`), la Edge Function `invia-avvisi` consegna. Regola:

- **push** a ogni abbonamento della persona (`push_abbonamenti`); un endpoint che risponde 404/410 è morto e viene segnato;
- **SMS**: per ora **spenti** — gli SMS servono solo al codice di accesso (OTP). Negli avvisi passerebbero in chiaro, a un
  fornitore terzo, nome e fermata di un minore, e ogni SMS costa. Il codice resta pronto, comandato da due interruttori
  in `impostazioni`, che l'admin accende dall'app (**Profilo → Canali di notifica**) senza toccare il codice:
  - `sms_avvisi` — gli urgenti (`sms = true`: linea annullata o riattivata, turno scoperto, bambino non trovato) partono anche via SMS;
  - `sms_ripiego` — chi non ha nessun abbonamento push riceve via SMS anche gli avvisi normali (ha effetto solo con `sms_avvisi` acceso;
    è la voce che decide il costo mensile).
  La funzione `canali()` espone i due valori a chiunque sia entrato (i testi dell'app si adattano); `imposta_canale(chiave, bool)`
  li cambia, solo admin e solo per queste due chiavi. Quando sono spenti la funzione scrive `sms_esito = 'disattivato'`.
- un errore non blocca la coda: si riprova con attesa crescente, fino a 10 tentativi, mai oltre 24 ore.

La funzione viene chiamata subito all'inserimento (trigger → `pg_net`) e ogni 2 minuti come ritentativo (`pg_cron`).
In locale, senza `pg_net`, il trigger non fa nulla e la coda resta in tabella: i test lo verificano.

Per metterla in produzione, una volta sola:

```bash
npx web-push generate-vapid-keys                      # chiavi per le push
npx supabase secrets set --env-file .env.functions    # PEDIBUS_CRON_SECRET, VAPID_*, TWILIO_*
npx supabase functions deploy invia-avvisi
```

poi nel SQL editor: `update impostazioni set valore = 'https://hrrdogjoymunfakwduxd.supabase.co/functions/v1/invia-avvisi' where chiave = 'invia_avvisi_url';`
e lo stesso `PEDIBUS_CRON_SECRET` in `invia_avvisi_secret`. `pg_net` va acceso da *Database → Extensions*.

## Accesso: passkey + codice SMS (deciso il 27/10)

- **Primo accesso** con il numero di telefono: codice via SMS (Twilio, configurato in `config.toml`). Il telefono è
  l'identità: è quello che il comitato ha già e che compare nell'iscrizione.
- Dopo il primo accesso l'app propone **la passkey** (sblocco del telefono): da lì `signInWithPasskey()` senza
  digitare nulla. Il codice SMS resta di riserva per chi non ha o non vuole la passkey.
- **Amministratore**: in più un'app di autenticazione (TOTP, inclusa in tutti i piani). Il codice SMS come secondo
  fattore su Supabase è un add-on da 75 $/mese: non vale la spesa.
- Limiti: 30 SMS/ora per progetto, un codice al minuto per utente — ogni OTP è un SMS pagato.

Due avvertenze. Le passkey in Supabase sono sperimentali: l'API può cambiare, e il client va creato con
`auth: { experimental: { passkey: true } }`. E `rp_id` in `config.toml` deve essere il **dominio definitivo**
dell'app: cambiarlo dopo invalida tutte le passkey registrate. In produzione è `pedibus.officinacivica.com`, impostato
nella dashboard (Authentication → Passkeys); `config.toml` vale solo per il locale.

## Registrazione e ruoli

Dopo il primo codice SMS l'utente esiste ma non ha detto chi è: l'app lo porta in `/registrazione` (nome, cognome,
genitore e/o volontario, consenso all'informativa) e ci resta finché non la completa. `registrati()` salva nome e
consenso e crea i ruoli richiesti **in attesa**: il genitore viene approvato insieme alla prima iscrizione
(`decidi_iscrizione`), il volontario quando l'admin verifica l'albo (`decidi_ruolo`). Chi ha entrambi i ruoli li
alterna dalla barra in alto. Finché nessun ruolo è approvato si vede `/in-attesa`, con lo stato di ciascuno.

L'**amministratore non si registra**: il primo si nomina a mano nel database (vedi "Avvio in produzione"), gli altri
con `nomina_admin()` da parte di un admin, tra le persone già registrate.

L'**iscrizione** di un bambino può arrivare **senza fermata** ("la decidiamo col comitato"): resta in attesa e
l'amministratore sceglie linea e fermata nella riga di approvazione, in Iscrizioni. Un'iscrizione approvata ha
sempre linea e fermata (vincolo nel database). Il primo contatto d'emergenza è chi iscrive, con il numero con cui
è entrato. Il percorso è coperto da `npm run e2e:registrazione`.

## L'app

```bash
cp .env.example .env.local      # URL e chiave anon del progetto, chiave pubblica VAPID
npm install
npm run dev                     # http://localhost:3000
npm run build                   # deve restare verde
```

Fatto, per tutti e tre i ruoli, con le schermate del prototipo:

- **Accesso**: codice via SMS, passkey; shell con barra per ruolo e cambio ruolo per chi ne ha più d'uno; "In attesa"
  per chi non ha ancora un ruolo approvato, con il link all'**iscrizione** (genitore, bambini, fermata, contatti
  d'emergenza, consenso versionato → `iscrivi_bambino`).
- **Genitore**: Presenze (stato e azione affiancati, chiusura alle 18:00, stato delle linee con conteggi via
  `stato_mie_linee`), Avvisi (archivio, letti all'apertura), Profilo (bambini, backup, contatti, privacy, **push su
  questo telefono**, **passkey**).
- **Volontario**: Turni (prossimo turno con team, kit, escalation; «Non posso venire», «Copro io il turno», chi è di
  backup; due settimane; bozza del mese), Appello (anteprima per fermata, apertura al capolinea, spunte, bambino non
  in lista solo se iscritto, «Prossima fermata», consegna, contatti d'emergenza con consultazione registrata),
  Profilo (settimana tipo, **eccezioni per data** sul calendario del mese prossimo, dotazioni).
- **Amministratore**: Oggi (alert per linea, iscrizioni in attesa, presenti, turni con copertura e kit), Iscrizioni
  (approva/rifiuta iscrizioni e richieste da volontario, con motivo; assegna linea e fermata a chi non l'ha scelta),
  Linee (nuova linea, modifica di orari e soglie, fermate da aggiungere, spostare, rinominare, eliminare; **sospensione
  e riattivazione** con avviso alle famiglie; giorni senza pedibus), Turni (team del giorno, bozza del mese: genera,
  invia, pubblica, rigenera se "da rivedere").

Sospendere una linea (`sospendi_linea`) annulla i turni già programmati da oggi in poi e avvisa famiglie e volontari;
le iscrizioni restano. Riattivarla avvisa le famiglie; i turni tornano con la prossima bozza. Capolinea e arrivo sono
la prima e l'ultima fermata e seguono gli orari della linea; una fermata con bambini iscritti non si elimina.
Il percorso è coperto da `npm run e2e:linee`.

Il backup del genitore si aggiunge dal Profilo per numero di telefono (deve essere entrato nell'app una volta).
Non ancora: inserimento manuale di chi non usa l'app, nomina di altri admin dall'app.

Scelte da sapere: le pagine sono tutte dinamiche (`cacheComponents` spento: dati per utente ovunque); i dati
passano da Supabase con la RLS dell'utente, le regole dalle RPC; la lettura dei conteggi di linea è una funzione
`security definer` perché il genitore non può leggere le presenze degli altri. Su iPhone le push richiedono l'app
aggiunta alla schermata Home: il profilo lo spiega.

### Design system: shadcn/ui

Installato con la CLI ufficiale (`components.json`: style `base-vega` su Base UI, base color zinc, icone Lucide,
font Inter). I componenti in `src/components/ui` sono quelli del registry, non vanno ritoccati a mano: per
aggiungerne uno, `npx shadcn@latest add <nome>`; per riallinearne uno al registry, `npx shadcn@latest add -o <nome>`.
Le sole aggiunte ai file del registry sono due varianti in più su `alert` (`warning`, `success`) e `badge`
(`brand`, `success`), segnate con un commento.

Il tema sta tutto in `src/app/globals.css`: i token shadcn generati dalla CLI più due dell'app, `--brand` (l'arancio
della pettorina: in shadcn `accent` vuol dire un'altra cosa) e `--success`. Sfondi tenui e bordi si fanno con
l'opacità (`bg-brand/10`, `border-destructive/30`), non con token dedicati. Il tema scuro segue il sistema tramite
`next-themes` (classe `dark` su `<html>`), come da documentazione shadcn per Next.js. Inter è self-hosted da
`@fontsource-variable/inter` via `next/font/local`: la build non dipende da Google Fonts.

Le notifiche a video sono `sonner` (`toast(...)`), il `Toaster` sta nel layout radice sopra la barra di navigazione.
I `<select>` sono `NativeSelect` (sul telefono si apre il selettore di sistema); i form usano `Field`/`FieldLabel`.
Le misure dei controlli sono quelle del registry (bottone `lg` = 40px); se sul marciapiede servono più grandi, si
cambia la scala in `button.tsx` una volta sola.

Le letture che l'app fa per volontario e admin (`turno_dettaglio`, `miei_turni`, `appello_anteprima`,
`appello_stato`, `riepilogo_admin`, `turni_del_giorno`) sono funzioni `security definer` con il controllo di ruolo
dentro: l'app non ricompone regole, mostra. Sono coperte dal replay.

## Provare in locale (database)

Serve un Postgres 16+ raggiungibile come superuser (senza Supabase: `tests/shim_auth.sql` fornisce il minimo).

```bash
tests/run.sh            # crea pedibus_test, applica migrazioni e seed, rigioca il martedì
```

Il replay fa, nell'ordine: Giulia segna Sofia assente (17:30) → chiusura assenze, Blu annullata (18:00) →
modifica tardiva, Blu riattivata (20:40) → soglia definitiva (21:00) → controllo volontari (6:30) → Paolo non
può venire, backup avvisati (6:50) → Anna copre (7:00) → appello della Verde con un bambino aggiunto e uno non
trovato, consegna (8:02) → giro della Blu (8:01) → approvazioni dell'admin → bozza di novembre, inviata,
resa da rivedere da un'eccezione, rigenerata → verifiche per anonimo → dispatcher dei job.

## Provare l'app da browser, senza Docker

`tests/e2e/avvia.sh` mette in piedi un Supabase in miniatura sul Postgres locale: PostgREST (binario statico,
`PGRST_BIN`) con la RLS vera, più `tests/e2e/supalite.js`, il minimo di GoTrue (JWT firmati, `/auth/v1/user`,
refresh, logout) e l'inoltro di `/rest/v1`. Con `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54329` e la chiave anon
che lo script stampa, l'app gira contro i dati del seed.

```bash
npm run e2e:avvia                       # database pedibus_e2e, PostgREST :3011, supalite :54329
npm run build && npx next start -p 3077
npm run e2e -- --shots /tmp/shots       # il giro: Giulia, Marta, Paolo, Anna, admin, Karimi
```

Il giro entra come ciascuno iniettando il cookie di sessione e rifà la storia del martedì nell'app: assenza di
Sofia, Paolo che non viene, Anna che copre, l'appello completo con Davide aggiunto e Leonardo non trovato, la
consegna, gli avvisi di Giulia, le approvazioni e la bozza dell'admin. È così che sono stati trovati i due difetti
corretti nella migrazione 8 e nel bottone «Copro io».

## Collegare il progetto Supabase

Progetto `pedibus-vedano`, ref `hrrdogjoymunfakwduxd`, regione EU.

```bash
npx supabase login
npx supabase link --project-ref hrrdogjoymunfakwduxd     # chiede la password del database
npx supabase db push                                       # applica le migrazioni (non il seed)
```

Il seed vale solo in locale (`npx supabase db reset`): sul progetto vero le persone nascono dall'Auth e il
trigger `auth_utente_creato` crea il profilo in `persone`.

Da verificare al primo `db push`: che il ruolo `postgres` del progetto abbia `bypassrls` (le funzioni
`security definer` usate dalle policy contano su questo), e che `pg_cron` sia attivo (il job `pedibus_job`
compare in `cron.job`).

## Avvio in produzione

Il database di produzione parte **vuoto**: niente comune, scuola, linee, fermate, informativa, nessun admin. Le
migrazioni si spingono con `npx supabase db push`; poi `supabase/avvio-produzione.sql`, una volta, dall'editor SQL
della dashboard: comune e scuola, l'informativa in vigore, le linee con le fermate (da sostituire con quelle vere:
ordine, orario, capolinea, arrivo) e il primo amministratore, scelto per telefono tra le persone già entrate
(`<<TELEFONO_ADMIN>>`). È idempotente. Gli altri admin li nomina lui dall'app.

## Cosa manca, in ordine

1. Script dei dati di base in produzione (linee e fermate vere, informativa) e primo admin.
2. Giro di prova dal telefono sull'indirizzo definitivo: codice SMS, PWA sulla Home, push, passkey.
3. Inserimento manuale di chi non usa l'app; nomina di altri admin dall'app; spostare un bambino di fermata.
4. L'algoritmo a vincoli vero per la bozza mensile, con il confronto "cosa cambia" alla rigenerazione.

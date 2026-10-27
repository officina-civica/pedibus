# Pedibus Vedano

App per gestire il pedibus della scuola primaria di Vedano al Lambro, un'iniziativa del comitato
Officina Civica. Genitori segnalano le assenze, volontari fanno i turni e l'appello, l'amministratore
vede tutto e interviene solo quando l'automatismo non basta.

Questo repository contiene le **fondamenta**: il database su Supabase con schema, regole, visibilità per
ruolo e job a orario, più un test che rigioca un'intera giornata. L'app (PWA, shadcn/ui) arriva dopo,
portando le schermate del prototipo un ruolo alla volta.

Documenti di riferimento (Claude Docs): *App Pedibus – Requisiti iniziali*, *Ipotesi UX*, e il prototipo
interattivo *Pedibus Vedano* (demo con regia + mappa di tutte le schermate).

## Struttura

```
src/                                  l'app (Next.js 16, App Router, Tailwind 4, componenti stile shadcn/ui)
  app/accesso                         telefono → codice SMS; passkey
  app/(app)/presenze|avvisi|profilo   il genitore (fatto); turni, appello, oggi, iscrizioni, linee: segnaposto
  app/(app)/azioni.ts                 server actions: presenze (RPC), avvisi letti, abbonamenti push, ruolo, uscita
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
  functions/invia-avvisi/index.ts     la Edge Function che svuota la coda: Web Push + SMS (Twilio)
  seed.sql                            il "martedì a Vedano" del prototipo (solo sviluppo)
prototipo/index.html                  il prototipo interattivo (demo con regia + mappa delle schermate)
tests/
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
| volontario | `non_posso_venire(turno)` | escalation: backup avvisati (SMS), admin avvisato; dopo 10 minuti tutti i volontari |
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

## Avvisi: push + SMS di riserva (deciso il 27/10)

Il database mette in coda (`avvisi`), la Edge Function `invia-avvisi` consegna. Regola:

- **push** a ogni abbonamento della persona (`push_abbonamenti`); un endpoint che risponde 404/410 è morto e viene segnato;
- **SMS sempre** per gli urgenti (`sms = true`: linea annullata o riattivata, turno scoperto, bambino non trovato);
- **SMS di ripiego** per gli avvisi normali solo a chi non ha nessun abbonamento push, se `impostazioni.sms_ripiego = true`
  (è la voce che decide il costo mensile: con tutti su push gli SMS restano decine al mese);
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
dell'app: cambiarlo dopo invalida tutte le passkey registrate. Oggi è `localhost`: va deciso prima del primo utente vero.

## L'app

```bash
cp .env.example .env.local      # URL e chiave anon del progetto, chiave pubblica VAPID
npm install
npm run dev                     # http://localhost:3000
npm run build                   # deve restare verde
```

Fatto: accesso (codice SMS, passkey), shell con barra per ruolo e cambio ruolo per chi ne ha più d'uno, e il
genitore completo — Presenze (stato e azione affiancati, chiusura alle 18:00, stato delle linee con conteggi via
`stato_mie_linee`), Avvisi (archivio, letti all'apertura), Profilo (bambini, backup, contatti, privacy,
**attivazione delle push su questo telefono**, **passkey**). Chi entra senza un ruolo approvato vede "In attesa".

Scelte da sapere: le pagine sono tutte dinamiche (`cacheComponents` spento: dati per utente ovunque); i dati
passano da Supabase con la RLS dell'utente, le regole dalle RPC; la lettura dei conteggi di linea è una funzione
`security definer` perché il genitore non può leggere le presenze degli altri. Su iPhone le push richiedono l'app
aggiunta alla schermata Home: il profilo lo spiega. Il registry di shadcn non era raggiungibile dalla sandbox:
i componenti (`src/components/ui`) sono scritti a mano nello stesso stile; `npx shadcn add` funziona comunque.

Prossimo passo: volontario (Turni con «Non posso venire», Appello), poi amministratore.

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

## Cosa manca, in ordine

1. Account Twilio (mittente alfanumerico "PEDIBUS", da verificare la pre-registrazione per l'Italia), chiavi VAPID,
   deploy della funzione e `impostazioni` compilate: vedi sopra.
2. L'app: volontario (Turni, Appello) e amministratore (Oggi, Iscrizioni, Linee, Turni); il genitore c'è.
   Iscrizione dall'app (oggi via RPC `iscrivi_bambino`, senza schermata). Dominio definitivo deciso prima delle passkey.
3. L'algoritmo a vincoli vero per la bozza mensile, con il confronto "cosa cambia" alla rigenerazione.

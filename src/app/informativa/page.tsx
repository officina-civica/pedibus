import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Informativa privacy" };

/*
  Informativa privacy (art. 13 GDPR), versione 1.0. Pagina pubblica: si legge anche prima dell'accesso.
  Il link è nella tabella `informative` (url = https://pedibus.officinacivica.com/informativa).
  Se il testo cambia nella sostanza: nuova versione qui e nuova riga in `informative`,
  così l'app richiede di nuovo il consenso.
  I campi tra [parentesi quadre] li completa il comitato.
*/

const VERSIONE = "1.0";
const DATA = "28 ottobre 2026";

function Sezione({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[17px] font-semibold tracking-tight">{titolo}</h2>
      {children}
    </section>
  );
}

function Elenco({ children }: { children: React.ReactNode }) {
  return <ul className="flex list-disc flex-col gap-1.5 pl-5">{children}</ul>;
}

export default function InformativaPage() {
  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col bg-card sm:min-h-screen sm:border-x sm:border-border">
      <div className="flex items-center gap-1 border-b px-2 py-2">
        <Button variant="ghost" size="sm" render={<Link href="/" />}>
          <ArrowLeft /> Pedibus
        </Button>
      </div>

      <article className="flex flex-col gap-6 px-4 pt-5 pb-12 text-[15px] leading-relaxed">
        <header className="flex flex-col gap-1">
          <h1 className="text-[24px] font-bold tracking-tight">Informativa privacy</h1>
          <p className="text-sm text-muted-foreground">
            Pedibus di Vedano al Lambro · versione {VERSIONE} del {DATA}
          </p>
        </header>

        <p>
          Il Pedibus è un servizio volontario: un gruppo di adulti accompagna a piedi i bambini a scuola la mattina, lungo
          linee con fermate e orari fissi. Questa app serve a organizzarlo: iscrizioni, turni dei volontari, presenze,
          appello e avvisi. Qui spieghiamo quali dati raccogliamo, perché, chi li vede e per quanto tempo li teniamo, come
          chiede il Regolamento europeo 2016/679 (GDPR).
        </p>

        <Sezione titolo="Chi è il titolare">
          <p>
            Il titolare del trattamento è il <b>comitato Officina Civica</b>, [sede: via e numero civico], 20854 Vedano al
            Lambro (MB), codice fiscale [codice fiscale del comitato].
          </p>
          <p>
            Per qualsiasi domanda sui tuoi dati scrivi a <b>[email del comitato]</b>. Il comitato non è tenuto a nominare un
            responsabile della protezione dei dati (DPO).
          </p>
        </Sezione>

        <Sezione titolo="Quali dati raccogliamo">
          <p><b>Di tutti gli utenti (genitori, volontari, amministratori):</b></p>
          <Elenco>
            <li>nome, cognome e numero di cellulare (serve per entrare nell&apos;app con il codice SMS);</li>
            <li>la scuola e il ruolo scelto (genitore, volontario o entrambi);</li>
            <li>la data in cui hai accettato questa informativa e la sua versione;</li>
            <li>
              se attivi le notifiche, l&apos;indirizzo tecnico di consegna del tuo telefono; se crei una passkey, la sua
              chiave pubblica (l&apos;impronta o il volto restano sul telefono: non li riceviamo mai);
            </li>
            <li>gli avvisi che ti mandiamo e se li hai letti.</li>
          </Elenco>

          <p><b>Dei bambini iscritti (li inserisce il genitore):</b></p>
          <Elenco>
            <li>nome, cognome, classe e, se indicato, il genere (serve solo a scrivere i messaggi in modo corretto);</li>
            <li>la linea e la fermata, l&apos;eventuale numero della pettorina;</li>
            <li>le presenze e le assenze segnalate e l&apos;appello di ogni mattina (salito, consegnato a scuola);</li>
            <li>i contatti di emergenza: nome, relazione con il bambino e numero di telefono.</li>
          </Elenco>
          <p>
            <b>Non chiediamo dati sulla salute</b> (allergie, patologie, farmaci): se servono informazioni di questo tipo,
            parlane direttamente con i volontari della tua linea.
          </p>

          <p><b>Dei volontari, in più:</b></p>
          <Elenco>
            <li>i giorni della settimana in cui sei disponibile e le eccezioni;</li>
            <li>i turni assegnati, le sostituzioni e la dotazione ricevuta (pettorina, paletta e simili).</li>
          </Elenco>

          <p>
            <b>Il registro delle consultazioni:</b> ogni volta che un volontario apre i contatti di emergenza di un bambino,
            l&apos;app registra chi, quando e in quale turno.
          </p>
        </Sezione>

        <Sezione titolo="Perché li usiamo e su quale base">
          <Elenco>
            <li>
              <b>Organizzare il servizio</b>: iscrivere i bambini, formare i turni, sapere chi sale a quale fermata, fare
              l&apos;appello, avvisare le famiglie se una linea non parte. Base giuridica: la tua richiesta di aderire al
              Pedibus (art. 6.1.b GDPR) e, per i dati dei bambini, il consenso del genitore che li iscrive (art. 6.1.a e
              art. 8).
            </li>
            <li>
              <b>Sicurezza dei bambini</b>: i contatti di emergenza e l&apos;appello servono a rintracciare subito un
              familiare e a sapere sempre chi è stato consegnato a scuola. Base giuridica: la stessa adesione al servizio e
              il legittimo interesse a tutelare i bambini (art. 6.1.f).
            </li>
            <li>
              <b>Accesso sicuro all&apos;app</b>: il codice SMS e la passkey impediscono che altri entrino al tuo posto. Base
              giuridica: adesione al servizio (art. 6.1.b).
            </li>
          </Elenco>
          <p>
            Senza questi dati non possiamo accogliere il bambino nel Pedibus né assegnare turni ai volontari. Non usiamo i
            dati per pubblicità, non li vendiamo e non li usiamo per decisioni automatiche o profilazione.
          </p>
        </Sezione>

        <Sezione titolo="Chi vede i dati">
          <Elenco>
            <li>
              <b>Il genitore</b> vede i dati dei propri figli; se nomina un &laquo;backup&raquo; (per esempio un nonno),
              questi può solo segnare presenze e assenze di quei bambini.
            </li>
            <li>
              <b>I volontari</b> vedono nome, classe e fermata dei bambini della linea in cui sono di turno. I contatti di
              emergenza li vede solo chi è di turno quel giorno su quella linea, e ogni apertura resta registrata.
            </li>
            <li>
              <b>Gli amministratori</b> del comitato vedono iscrizioni, turni e volontari per approvare le richieste e
              organizzare il servizio.
            </li>
          </Elenco>
          <p>
            Non comunichiamo i dati alla scuola né ad altri, salvo obblighi di legge o richieste dell&apos;autorità.
          </p>
        </Sezione>

        <Sezione titolo="Servizi esterni che usiamo">
          <p>
            Per far funzionare l&apos;app ci appoggiamo ad alcuni fornitori, nominati responsabili del trattamento: trattano
            i dati solo per conto nostro e per lo scopo indicato.
          </p>
          <Elenco>
            <li><b>Supabase</b> — database e autenticazione; i dati sono conservati su server a Francoforte (Germania).</li>
            <li><b>Vercel</b> — ospita l&apos;app; le pagine sono elaborate su server a Francoforte.</li>
            <li><b>Twilio</b> — invia il codice SMS di accesso; riceve solo il numero di cellulare.</li>
            <li>
              <b>Servizi di notifica del telefono</b> (Apple, Google, Mozilla) — consegnano le notifiche push; il contenuto
              viaggia cifrato e non lo possono leggere.
            </li>
          </Elenco>
          <p>
            Alcuni di questi fornitori hanno sede negli Stati Uniti. Gli eventuali trasferimenti di dati avvengono sulla
            base del Data Privacy Framework UE-USA o delle clausole contrattuali standard approvate dalla Commissione
            europea.
          </p>
        </Sezione>

        <Sezione titolo="Per quanto tempo li teniamo">
          <p>
            L&apos;anno scolastico per noi finisce il 30 giugno. La cancellazione avviene in automatico, ogni notte, in due
            tempi: quello che serve solo a far funzionare il servizio se ne va presto; quello che serve a ricostruire
            cosa è successo in caso di incidente o contestazione resta 12 mesi.
          </p>
          <Elenco>
            <li>
              <b>Contatti di emergenza e backup del genitore</b>: fino al 30 luglio, cioè 30 giorni dopo la fine
              dell&apos;anno, a meno che tu non rinnovi l&apos;iscrizione. Lo stesso vale per le richieste di iscrizione mai
              approvate.
            </li>
            <li>
              <b>Presenze, appelli, turni e registro delle consultazioni</b>: 12 mesi dal giorno a cui si riferiscono.
            </li>
            <li>
              <b>Nome, cognome e classe del bambino, linea e fermata</b>: 12 mesi dopo la fine dell&apos;ultimo anno
              scolastico frequentato, così presenze e appelli restano collegati a un nome per tutto il tempo in cui li
              conserviamo.
            </li>
            <li><b>Avvisi</b>: 6 mesi.</li>
            <li>
              <b>Il tuo profilo</b> (nome, telefono, ruoli, notifiche, passkey): finché ci sono bambini iscritti, turni o
              incarichi che ti riguardano; poi lo cancelliamo, al più tardi 12 mesi dopo l&apos;ultima attività. Puoi
              chiederne la cancellazione prima in qualsiasi momento.
            </li>
          </Elenco>
        </Sezione>

        <Sezione titolo="I tuoi diritti">
          <p>
            Puoi chiedere in ogni momento di vedere i tuoi dati e quelli dei tuoi figli, di correggerli, di cancellarli, di
            limitarne l&apos;uso, di riceverne una copia in un formato leggibile (portabilità) e di opporti al trattamento
            basato sul legittimo interesse. Puoi revocare il consenso quando vuoi: la revoca non rende illegittimo quanto
            fatto prima, ma senza consenso il bambino non può più partecipare al Pedibus tramite l&apos;app.
          </p>
          <p>
            Scrivi a <b>[email del comitato]</b>: rispondiamo entro un mese. Se ritieni che i tuoi dati siano trattati in
            modo non corretto puoi rivolgerti al Garante per la protezione dei dati personali (garanteprivacy.it).
          </p>
        </Sezione>

        <Sezione titolo="Cookie">
          <p>
            L&apos;app usa solo cookie tecnici, necessari a tenerti collegato; non usa cookie di profilazione né strumenti
            di statistica di terze parti. Per questo non serve un banner per i cookie.
          </p>
        </Sezione>

        <Sezione titolo="Modifiche">
          <p>
            Se questa informativa cambia nella sostanza te lo segnaliamo con un avviso nell&apos;app e ti chiediamo di
            accettare la nuova versione.
          </p>
        </Sezione>
      </article>
    </main>
  );
}

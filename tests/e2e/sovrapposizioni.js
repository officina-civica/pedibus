/* Controllo di layout: in ogni schermata con campi (pagine e finestre), a più larghezze di telefono,
   nessun controllo (input, select, bottone, etichetta) si sovrappone a un altro né esce dallo schermo.
   Serve il Supabase in miniatura (tests/e2e/avvia.sh) e `next start -p 3077`.
   Uso: node tests/e2e/sovrapposizioni.js [--shots cartella] [--larghezze 320,360,390] */
const { execSync } = require("child_process");
const { chromium } = require("playwright");
const { sessione } = require("./supalite.js");

const APP = process.env.APP_URL || "http://127.0.0.1:3077";
const arg = (n) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : null);
const SHOTS = arg("--shots");
const LARGHEZZE = (arg("--larghezze") || "320,360,390,430").split(",").map(Number);
const ADMIN = "a0000000-0000-4000-8000-000000000009", GIULIA = "a0000000-0000-4000-8000-000000000001";
const MARTA = "a0000000-0000-4000-8000-000000000003", NUOVO = "a0000000-0000-4000-8000-000000000097";
let problemi = 0;

async function entra(context, sub, phone) {
  const s = sessione({ sub, phone, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 86400 });
  await context.clearCookies();
  if (sub) await context.addCookies([{ name: "sb-127-auth-token", value: "base64-" + Buffer.from(JSON.stringify(s)).toString("base64url"), url: APP }]);
}

/* Nel browser: i controlli visibili del livello più alto (la finestra aperta, altrimenti la pagina) e i problemi:
   coppie che si sovrappongono (oltre 2px, non annidate), controlli fuori dallo schermo, scorrimento orizzontale. */
const CONTROLLO = () => {
  const radice = document.querySelector("[role=dialog], [role=alertdialog]") || document.body;
  const sel = "input:not([type=hidden]), select, textarea, button, [role=button], [role=checkbox], [role=switch], [role=radio], label, a[href]";
  const visibile = (e) => {
    const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
    return cs.visibility !== "hidden" && cs.display !== "none" && +cs.opacity > 0 && r.width > 1 && r.height > 1 && !e.closest("[data-sonner-toaster], [aria-hidden=true]");
  };
  const els = [...radice.querySelectorAll(sel)].filter(visibile);
  const nome = (e) => (e.getAttribute("aria-label") || e.id || e.getAttribute("placeholder") || e.textContent || e.tagName).trim().slice(0, 40);
  const box = (e) => e.getBoundingClientRect();
  const problemi = [];
  const W = document.documentElement.clientWidth;
  for (let i = 0; i < els.length; i++) {
    const a = box(els[i]);
    if (a.left < -1 || a.right > W + 1) problemi.push(`fuori schermo: "${nome(els[i])}" (${Math.round(a.left)}–${Math.round(a.right)} su ${W})`);
    for (let j = i + 1; j < els.length; j++) {
      if (els[i].contains(els[j]) || els[j].contains(els[i])) continue;
      if (!!els[i].closest("nav") !== !!els[j].closest("nav")) continue;   // la barra in basso è sticky: copre ciò che scorre sotto, per costruzione
      const b = box(els[j]);
      const dx = Math.min(a.right, b.right) - Math.max(a.left, b.left), dy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (dx > 2 && dy > 2) problemi.push(`sovrapposti: "${nome(els[i])}" e "${nome(els[j])}" (${Math.round(dx)}×${Math.round(dy)}px)`);
    }
  }
  if (document.documentElement.scrollWidth > W + 1) problemi.push(`la pagina scorre in orizzontale (${document.documentElement.scrollWidth} > ${W})`);
  // Testo di etichette e opzioni che trabocca dal proprio controllo.
  for (const e of els) if (e.matches("button, label, select") && e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow === "visible") problemi.push(`testo che trabocca: "${nome(e)}" (${e.scrollWidth} > ${e.clientWidth})`);
  return { controlli: els.length, problemi };
};

/* Le scene: chi entra, dove va, cosa apre. */
const SCENE = [
  { nome: "accesso", chi: null, url: "/accesso" },
  { nome: "accesso-codice", chi: null, url: "/accesso", fai: async (p) => { await p.fill("#tel", "3331234567"); await p.getByRole("button", { name: /Invia|codice/i }).click(); await p.locator("#otp").waitFor(); } },
  { nome: "registrazione-nome", chi: NUOVO, tel: "393330000097", url: "/registrazione", fai: async (p) => { await p.getByRole("button", { name: "Continua" }).click(); await p.locator("#nome").waitFor(); } },
  { nome: "registrazione-ruoli", chi: NUOVO, tel: "393330000097", url: "/registrazione", fai: async (p) => { await p.getByRole("button", { name: "Continua" }).click(); await p.fill("#nome", "Rita"); await p.fill("#cognome", "Neri"); await p.getByRole("button", { name: "Continua" }).click(); await p.getByRole("button", { name: /Genitore/ }).waitFor(); } },
  { nome: "registrazione-consenso", chi: NUOVO, tel: "393330000097", url: "/registrazione", fai: async (p) => { await p.getByRole("button", { name: "Continua" }).click(); await p.fill("#nome", "Rita"); await p.fill("#cognome", "Neri"); await p.getByRole("button", { name: "Continua" }).click(); await p.getByRole("button", { name: /Genitore/ }).click(); await p.getByRole("button", { name: "Continua" }).click(); await p.getByText(/informativa/i).first().waitFor(); } },
  { nome: "iscrizione", chi: GIULIA, url: "/iscrizione", fai: async (p) => { await p.locator("#nome0").waitFor(); } },
  { nome: "iscrizione-due-bambini-contatti", chi: GIULIA, url: "/iscrizione", fai: async (p) => { await p.locator("#nome0").waitFor(); await p.getByRole("button", { name: /Aggiungi un altro/ }).click(); await p.getByRole("button", { name: /Un altro contatto/ }).click(); await p.getByRole("button", { name: /Un altro contatto/ }).click(); } },
  { nome: "in-attesa", chi: NUOVO, tel: "393330000097", url: "/registrazione", fai: async (p) => { await p.getByRole("button", { name: "Continua" }).click(); await p.fill("#nome", "Rita"); await p.fill("#cognome", "Neri"); await p.getByRole("button", { name: "Continua" }).click(); await p.getByRole("button", { name: /Volontario/ }).click(); await p.getByRole("button", { name: "Continua" }).click(); await p.locator("label[for=consenso]").click({ position: { x: 4, y: 4 } }); await p.getByRole("button", { name: "Continua" }).click(); await p.waitForURL(/in-attesa/, { timeout: 15000 }); } },
  { nome: "presenze", chi: GIULIA, url: "/presenze" },
  { nome: "presenze-assente", chi: GIULIA, url: "/presenze", fai: async (p) => { const seg = p.getByRole("button", { name: /Segnala un'assenza/ }); if (await seg.count()) { await seg.first().click(); await p.getByRole("button", { name: /Annulla l'assenza/ }).first().waitFor(); } } },
  { nome: "profilo-genitore", chi: GIULIA, url: "/profilo" },
  { nome: "profilo-backup", chi: GIULIA, url: "/profilo", fai: async (p) => { await p.getByRole("button", { name: /Aggiungi un backup/ }).click(); await p.getByPlaceholder(/Cellulare del backup/).waitFor(); } },
  { nome: "avvisi", chi: GIULIA, url: "/avvisi" },
  { nome: "turni", chi: MARTA, url: "/turni" },
  { nome: "turni-backup", chi: MARTA, url: "/turni", fai: async (p) => { await p.getByRole("button", { name: /Chi è di backup/ }).click(); await p.waitForTimeout(300); } },
  { nome: "turni-admin-bozza", chi: ADMIN, url: "/turni", fai: async (p) => { const b = p.getByRole("button", { name: /Genera la bozza/ }); if (await b.count()) { await b.click(); await p.getByRole("button", { name: /Invia per conferma/ }).waitFor({ timeout: 20000 }); } } },
  { nome: "oggi-admin", chi: ADMIN, url: "/oggi" },
  { nome: "oggi", chi: MARTA, url: "/oggi" },
  { nome: "appello", chi: MARTA, url: "/appello", fai: async (p) => { const b = p.getByRole("button", { name: /Apri l'appello/ }); if (await b.count()) await b.click(); await p.waitForTimeout(500); } },
  { nome: "iscrizioni-admin", chi: ADMIN, url: "/iscrizioni" },
  { nome: "linee-admin", chi: ADMIN, url: "/linee" },
  { nome: "linee-nuova", chi: ADMIN, url: "/linee", fai: async (p) => { await p.getByRole("button", { name: "Nuova linea" }).click(); await p.locator("#l-nome").waitFor(); } },
  { nome: "linee-modifica", chi: ADMIN, url: "/linee", fai: async (p) => { await p.getByRole("button", { name: "Modifica Linea Verde" }).click(); await p.locator("#l-nome").waitFor(); } },
  { nome: "linee-fermata", chi: ADMIN, url: "/linee", fai: async (p) => { await p.locator("[data-linea='Linea Verde']").getByRole("button", { name: "Aggiungi fermata" }).click(); await p.locator("#f-nome").waitFor(); } },
  { nome: "linee-sospendi", chi: ADMIN, url: "/linee", fai: async (p) => { await p.locator("[data-linea='Linea Verde']").getByRole("button", { name: "Sospendi" }).click(); await p.locator("#motivo").waitFor(); } },
  { nome: "linee-bambini-fermata", chi: ADMIN, url: "/linee", fai: async (p) => { await p.locator("[data-linea='Linea Blu']").getByRole("button", { name: "Bambini alla fermata Via Garibaldi, bar" }).click(); await p.getByRole("button", { name: "Sposta" }).first().click(); await p.getByLabel("Fermata di destinazione").waitFor(); } },
  { nome: "linee-chiusura", chi: ADMIN, url: "/linee", fai: async (p) => { await p.getByRole("button", { name: "Aggiungi un giorno" }).click(); await p.locator("#c-giorno").waitFor(); } },
  { nome: "profilo-admin", chi: ADMIN, url: "/profilo" },
  { nome: "profilo-nomina", chi: ADMIN, url: "/profilo", fai: async (p) => { await p.getByRole("button", { name: "Nomina un amministratore" }).click(); await p.locator("#nuovo-admin").waitFor(); } },
];

(async () => {
  const browser = await chromium.launch();
  for (const W of LARGHEZZE) {
    // Rita rinasce a ogni larghezza: la registrazione la consuma.
    execSync(`psql -v ON_ERROR_STOP=1 -q -d pedibus_e2e -c "delete from auth.users where id = '${NUOVO}'" -c "insert into auth.users (id, phone) values ('${NUOVO}', '393330000097')"`);
    console.log(`\n▸ larghezza ${W}px`);
    const context = await browser.newContext({ viewport: { width: W, height: 780 }, locale: "it-IT", timezoneId: "Europe/Rome", deviceScaleFactor: 2 });
    await context.route("**/auth/v1/otp", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    const p = await context.newPage();
    for (const s of SCENE) {
      try {
        await entra(context, s.chi, s.tel);
        await p.goto(APP + s.url, { waitUntil: "networkidle" });
        if (s.fai) await s.fai(p);
        await p.waitForTimeout(400);
        const r = await p.evaluate(CONTROLLO);
        const esito = r.problemi.length ? "✗" : "✓";
        console.log(`  ${esito} ${s.nome} (${r.controlli} controlli)`);
        for (const m of r.problemi) { console.log(`      ${m}`); problemi++; }
        if (SHOTS) await p.screenshot({ path: `${SHOTS}/${W}-${s.nome}.png`, fullPage: !(await p.locator("[role=dialog], [role=alertdialog]").count()) });
      } catch (e) {
        console.log(`  ✗ ${s.nome}: ${e.message.split("\n")[0]}`); problemi++;
      }
    }
    await context.close();
  }
  console.log(problemi ? `\n✗ ${problemi} problemi di layout` : "\n✔ nessuna sovrapposizione");
  await browser.close();
  process.exit(problemi ? 1 : 0);
})();

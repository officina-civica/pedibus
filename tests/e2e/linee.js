/* L'amministratore gestisce le linee dall'app: nuova linea, fermate (aggiungi, sposta, rinomina, elimina),
   sospensione con avviso alle famiglie, riattivazione, giorni senza pedibus.
   Serve il Supabase in miniatura (tests/e2e/avvia.sh) e `next start -p 3077`.
   Uso: node tests/e2e/linee.js [--shots cartella] */
const { chromium } = require("playwright");
const { sessione } = require("./supalite.js");

const APP = process.env.APP_URL || "http://127.0.0.1:3077";
const SHOTS = process.argv.includes("--shots") ? process.argv[process.argv.indexOf("--shots") + 1] : null;
const ADMIN = "a0000000-0000-4000-8000-000000000009", GIULIA = "a0000000-0000-4000-8000-000000000001";
let fallite = 0;
const ok = (cond, msg) => { console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`); if (!cond) fallite++; };
async function entra(context, sub) {
  const s = sessione({ sub, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 86400 });
  await context.clearCookies();
  await context.addCookies([{ name: "sb-127-auth-token", value: "base64-" + Buffer.from(JSON.stringify(s)).toString("base64url"), url: APP }]);
}
const shot = async (p, nome) => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/${nome}.png`, fullPage: true }); };
const attendi = (p, re) => p.getByText(re).first().waitFor({ timeout: 10000 });

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "it-IT", timezoneId: "Europe/Rome" });
  const p = await context.newPage();
  const errori = []; p.on("pageerror", (e) => errori.push(e.message));

  console.log("Admin · nuova linea");
  await entra(context, ADMIN);
  await p.goto(APP + "/linee");
  ok(await p.getByText("Linea Verde").first().isVisible(), "vede le linee");
  await p.getByRole("button", { name: "Nuova linea" }).click();
  await p.fill("#l-nome", "Linea Gialla");
  await p.getByRole("button", { name: "Colore #ca8a04" }).click();
  await p.fill("#l-partenza", "07:40"); await p.fill("#l-arrivo", "08:00");
  await shot(p, "l1-nuova-linea");
  await p.getByRole("button", { name: "Crea la linea" }).click();
  await attendi(p, /Linea creata/);
  const gialla = p.locator("[data-linea='Linea Gialla']");
  await gialla.waitFor({ timeout: 10000 });
  ok(await gialla.getByText("Capolinea").isVisible() && await gialla.getByText("arrivo").isVisible(), "la linea nasce con capolinea e arrivo");

  console.log("Admin · fermate");
  await gialla.getByRole("button", { name: "Aggiungi fermata" }).click();
  await p.fill("#f-nome", "Via Lambro"); await p.fill("#f-orario", "07:46");
  await p.getByRole("button", { name: "Aggiungi" }).click();
  await attendi(p, /Fermata aggiunta/);
  await gialla.getByRole("button", { name: "Aggiungi fermata" }).click();
  await p.fill("#f-nome", "Piazza Mercato"); await p.fill("#f-orario", "07:52");
  await p.getByRole("button", { name: "Aggiungi" }).click();
  await attendi(p, /Fermata aggiunta/);
  await p.waitForTimeout(600);
  const nomi = async () => (await gialla.locator("[data-fermata-nome]").allInnerTexts()).map((t) => t.split(" · ")[0]);
  ok((await nomi()).join(" > ") === "Capolinea > Via Lambro > Piazza Mercato > Scuola primaria", "fermate in ordine: " + (await nomi()).join(" > "));
  await gialla.getByRole("button", { name: "Sposta su Piazza Mercato" }).click();
  await attendi(p, /Ordine aggiornato/); await p.waitForTimeout(600);
  ok((await nomi()).join(" > ") === "Capolinea > Piazza Mercato > Via Lambro > Scuola primaria", "spostata su");
  await gialla.getByRole("button", { name: "Modifica Via Lambro" }).click();
  await p.fill("#f-nome", "Via Lambro, 10");
  await p.getByRole("button", { name: "Salva" }).click();
  await attendi(p, /Fermata aggiornata/); await p.waitForTimeout(600);
  ok(await gialla.getByText("Via Lambro, 10").isVisible(), "rinominata");
  await shot(p, "l2-fermate");
  await gialla.getByRole("button", { name: "Elimina Piazza Mercato" }).click();
  await p.getByRole("button", { name: "Elimina" }).click();
  await attendi(p, /Fermata eliminata/); await p.waitForTimeout(600);
  ok((await nomi()).length === 3, "eliminata");
  ok(await gialla.getByRole("button", { name: "Elimina Capolinea" }).isDisabled(), "il capolinea non si elimina");

  console.log("Admin · sospende la Blu");
  const blu = p.locator("[data-linea='Linea Blu']");
  await blu.getByRole("button", { name: "Sospendi" }).click();
  await p.fill("#motivo", "Lavori stradali in via Battisti");
  await shot(p, "l3-sospendi");
  await p.getByRole("button", { name: "Sospendi la linea" }).click();
  await attendi(p, /Linea sospesa/); await p.waitForTimeout(800);
  ok(await blu.getByText("sospesa").isVisible(), "Blu sospesa");
  await entra(context, GIULIA);
  await p.goto(APP + "/avvisi");
  ok(await p.getByText("Linea Blu sospesa").first().isVisible(), "Giulia (Sofia è sulla Blu) ha l'avviso");
  ok(await p.getByText(/Lavori stradali/).first().isVisible(), "con il messaggio del comitato");
  await entra(context, ADMIN);
  await p.goto(APP + "/linee");
  await blu.getByRole("button", { name: "Riattiva" }).click();
  await p.getByRole("button", { name: "Riattiva la linea" }).click();
  await attendi(p, /Linea riattivata/); await p.waitForTimeout(800);
  ok(await blu.getByText("attiva", { exact: true }).isVisible(), "Blu riattivata");

  console.log("Admin · giorni senza pedibus");
  await p.getByRole("button", { name: "Aggiungi un giorno" }).click();
  await p.fill("#c-giorno", "2026-11-02"); await p.fill("#c-motivo", "Ponte dei Santi");
  await p.getByRole("button", { name: "Aggiungi", exact: true }).click();
  await attendi(p, /Giorno senza pedibus aggiunto/); await p.waitForTimeout(600);
  ok(await p.getByText("Ponte dei Santi").isVisible(), "chiusura aggiunta");
  await shot(p, "l4-chiusure");
  await p.getByRole("button", { name: "Togli 2026-11-02" }).click();
  await attendi(p, /Giorno tolto/); await p.waitForTimeout(600);
  ok((await p.getByText("Ponte dei Santi").count()) === 0, "chiusura tolta");

  console.log("Admin · sposta Sofia di fermata");
  await p.goto(APP + "/linee");
  const bluCard = p.locator("[data-linea='Linea Blu']");
  await bluCard.getByRole("button", { name: "Bambini alla fermata Via Garibaldi, bar" }).click();
  ok(await p.getByText("Sofia Bianchi").isVisible(), "vede i bambini della fermata 3 della Blu");
  await shot(p, "l5-bambini-fermata");
  const rigaSofia = p.getByRole("dialog").locator("div", { hasText: "Sofia Bianchi" }).filter({ has: p.getByRole("button", { name: "Sposta" }) }).last();
  await rigaSofia.getByRole("button", { name: "Sposta" }).click();
  await p.getByLabel("Fermata di destinazione").selectOption({ index: 1 });   // la prima fermata diversa: 1. Via Battisti
  await p.getByRole("button", { name: "Conferma" }).click();
  await attendi(p, /Fermata cambiata/); await p.waitForTimeout(800);
  await entra(context, GIULIA);
  await p.goto(APP + "/presenze");
  ok(await p.getByText(/Linea Blu, fermata 1/).isVisible(), "Giulia vede Sofia alla fermata 1");
  await p.goto(APP + "/avvisi");
  ok(await p.getByText("Sofia cambia fermata").first().isVisible(), "e ha l'avviso del cambio");

  console.log("Admin · nomina e revoca un amministratore");
  await entra(context, ADMIN);
  await p.goto(APP + "/profilo");
  ok(await p.getByText("Amministratori").isVisible(), "sezione Amministratori nel profilo admin");
  ok(await p.getByRole("button", { name: /Revoca Officina Civica/ }).isDisabled(), "l'unico admin non si può revocare");
  await p.getByRole("button", { name: "Nomina un amministratore" }).click();
  await p.getByLabel("Persona").selectOption({ value: "a0000000-0000-4000-8000-000000000003" });   // Marta Rossi
  await p.getByRole("button", { name: "Nomina", exact: true }).click();
  await attendi(p, /Nominato amministratore/); await p.waitForTimeout(800);
  ok(await p.getByText("Marta Rossi").isVisible(), "Marta è tra gli admin");
  await shot(p, "l6-amministratori");
  await p.getByRole("button", { name: "Revoca Marta Rossi" }).click();
  await p.getByRole("button", { name: "Revoca", exact: true }).click();
  await attendi(p, /revocato/); await p.waitForTimeout(800);
  ok((await p.getByText("Marta Rossi").count()) === 0, "Marta revocata");

  console.log(`\nerrori di pagina: ${errori.length ? errori.join(" | ") : "nessuno"}`);
  console.log(fallite ? `✗ ${fallite} verifiche fallite` : "✔ tutto verde");
  await browser.close();
  process.exit(fallite || errori.length ? 1 : 0);
})();

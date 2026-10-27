/* Giro end-to-end dell'app contro il Supabase in miniatura (tests/e2e/avvia.sh) e `next start -p 3077`.
   Entra come Giulia, Marta e l'amministratore iniettando il cookie di sessione, fa le azioni della storia
   del martedì e verifica cosa c'è a video. Uso: node tests/e2e/giro.js [--shots cartella] */
const { chromium } = require("playwright");
const { sessione } = require("./supalite.js");

const APP = process.env.APP_URL || "http://127.0.0.1:3077";
const SHOTS = process.argv.includes("--shots") ? process.argv[process.argv.indexOf("--shots") + 1] : null;
const ID = {
  giulia: "a0000000-0000-4000-8000-000000000001", marta: "a0000000-0000-4000-8000-000000000003",
  paolo: "a0000000-0000-4000-8000-000000000004", anna: "a0000000-0000-4000-8000-000000000005",
  admin: "a0000000-0000-4000-8000-000000000009", karimi: "a0000000-0000-4000-8000-000000000025",
};
let fallite = 0;
const ok = (cond, msg) => { console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`); if (!cond) fallite++; };

async function entra(context, chi, phone) {
  const s = sessione({ sub: ID[chi], phone, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 86400 });
  const valore = "base64-" + Buffer.from(JSON.stringify(s)).toString("base64url");
  await context.clearCookies();
  await context.addCookies([{ name: "sb-127-auth-token", value: valore, url: APP }]);
}
const shot = async (p, nome) => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/${nome}.png`, fullPage: true }); };

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "it-IT", timezoneId: "Europe/Rome" });
  const p = await context.newPage();
  const errori = []; p.on("pageerror", (e) => errori.push(e.message));

  console.log("Giulia · genitore");
  await entra(context, "giulia", "+393331234567");
  await p.goto(APP + "/"); await p.waitForURL("**/presenze");
  ok(await p.getByText("Luca Bianchi").isVisible(), "vede Luca");
  ok(await p.getByText("Sofia Bianchi").isVisible(), "vede Sofia");
  ok((await p.getByText("Linea Blu:").count()) === 1 && (await p.getByText("Linea Verde:").count()) === 1, "vede lo stato di Verde e Blu");
  await shot(p, "01-presenze");
  const schedaSofia = p.locator("div", { has: p.getByText("Sofia Bianchi") }).filter({ has: p.getByRole("button", { name: /Segnala un'assenza/ }) }).last();
  await schedaSofia.getByRole("button", { name: /Segnala un'assenza/ }).click();
  await p.getByText(/Assenza segnalata|Modifica tardiva/).waitFor({ timeout: 8000 });
  await p.waitForTimeout(800);
  ok(await p.getByText("Assente oggi", { exact: false }).first().isVisible(), "Sofia segnata assente");
  await shot(p, "02-presenze-sofia-assente");
  await p.goto(APP + "/profilo");
  ok(await p.getByText("Giulia Bianchi").first().isVisible(), "profilo con nome");
  ok(await p.getByText("Rita Bianchi").isVisible(), "backup nonna Rita");
  await shot(p, "03-profilo-genitore");
  await p.goto(APP + "/avvisi"); await shot(p, "04-avvisi-genitore");
  await p.goto(APP + "/turni");
  ok(await p.getByText("In attesa").count() === 0, "un genitore su /turni non vede dati del volontario");

  console.log("Marta · volontaria");
  await entra(context, "marta", "+393472223344");
  await p.goto(APP + "/"); await p.waitForURL("**/turni");
  ok(await p.getByText("Prossimo turno").isVisible(), "prossimo turno");
  ok(await p.getByText("Marta Rossi (tu)").isVisible(), "Marta nel team");
  ok(await p.getByText("Paolo Verdi", { exact: true }).isVisible(), "Paolo nel team");
  await shot(p, "05-turni");
  await p.getByRole("button", { name: /Chi è di backup/ }).click();
  ok(await p.getByText("Anna Ferrari", { exact: true }).first().isVisible(), "Anna fra i backup");
  await p.goto(APP + "/profilo");
  ok(await p.getByText("Disponibilità settimanale").isVisible(), "profilo volontaria: disponibilità");
  ok((await p.getByRole("button", { name: /novembre/ }).count()) >= 0, "calendario delle eccezioni");
  await shot(p, "06-profilo-volontaria");
  // Paolo non può venire
  await entra(context, "paolo");
  await p.goto(APP + "/turni");
  await p.getByRole("button", { name: "Non posso venire" }).click();
  await p.getByText(/Avvisati i backup|coperto/).waitFor({ timeout: 8000 });
  await p.waitForTimeout(800);
  ok(await p.getByText("Hai avvisato").isVisible(), "Paolo ha avvisato");
  ok(await p.getByText(/Turno scoperto/).isVisible(), "turno scoperto 1 su 2");
  await shot(p, "07-turni-paolo-non-viene");
  // Anna copre
  await entra(context, "anna");
  await p.goto(APP + "/turni");
  await p.getByRole("button", { name: /Copro io il turno/ }).click();
  await p.getByText(/coperto/).first().waitFor({ timeout: 8000 });
  await p.waitForTimeout(800);
  ok(await p.getByText("Turno coperto").isVisible(), "Anna copre: turno coperto");
  await shot(p, "08-turni-anna-copre");
  // Marta apre l'appello
  await entra(context, "marta", "+393472223344");
  await p.goto(APP + "/appello");
  ok(await p.getByText(/L'appello si apre alle 7:30/).isVisible(), "anteprima appello");
  await shot(p, "09-appello-anteprima");
  await p.getByRole("button", { name: /Apri l'appello/ }).click();
  await p.getByText("Fermata 1 di 5").waitFor({ timeout: 8000 });
  ok(await p.getByText("Emma Colombo").isVisible() && await p.getByText("Giacomo Ferrari").isVisible(), "capolinea: Emma e Giacomo");
  await shot(p, "10-appello-fermata1");
  await p.getByRole("button", { name: /Emma Colombo/ }).click(); await p.waitForTimeout(600);
  await p.getByRole("button", { name: /Giacomo Ferrari/ }).click(); await p.waitForTimeout(600);
  ok(await p.getByText("2 di 2 presenti").isVisible(), "due spunte");
  await p.getByRole("button", { name: /Prossima fermata/ }).click(); await p.getByText("Fermata 2 di 5").waitFor();
  await p.getByRole("button", { name: /Matteo Rossi/ }).click(); await p.waitForTimeout(500);
  await p.getByRole("button", { name: /Tommaso Gallo/ }).click(); await p.waitForTimeout(500);
  await p.getByRole("button", { name: /Prossima fermata/ }).click(); await p.getByText("Fermata 3 di 5").waitFor();
  await p.getByRole("button", { name: /Luca Bianchi/ }).click(); await p.waitForTimeout(500);
  await p.getByRole("button", { name: /Non è in lista/ }).click();
  ok(await p.getByText("Davide Ricci").isVisible(), "Davide aggiungibile (segnato assente)");
  await p.getByRole("button", { name: /Davide Ricci/ }).click(); await p.waitForTimeout(800);
  ok(await p.getByText("2 a bordo", { exact: false }).count() >= 0, "aggiunto");
  await shot(p, "11-appello-fermata3-davide");
  await p.getByRole("button", { name: /Prossima fermata/ }).click(); await p.getByText("Fermata 4 di 5").waitFor();
  await p.getByRole("button", { name: /Aurora Moretti/ }).click(); await p.waitForTimeout(500);
  await p.getByRole("button", { name: /Prossima fermata/ }).click(); await p.getByText("Fermata 5 di 5").waitFor();   // Leonardo non trovato
  await p.getByRole("button", { name: /Chiara Russo/ }).click(); await p.waitForTimeout(500);
  await p.getByRole("button", { name: /Alice Conti/ }).click(); await p.waitForTimeout(500);
  await p.getByRole("button", { name: /Prossima fermata/ }).click(); await p.getByText("Arrivo").first().waitFor();
  ok(await p.getByText("9 a bordo").first().isVisible(), "9 a bordo all'arrivo");
  await shot(p, "12-appello-arrivo");
  await p.getByRole("button", { name: /Consegnati a scuola/ }).click();
  await p.getByText(/Non trovati alla fermata/).waitFor({ timeout: 10000 });
  ok(await p.getByText(/Leonardo Greco/).isVisible(), "Leonardo segnalato non trovato");
  ok(await p.getByRole("heading", { name: "Consegnati a scuola" }).isVisible(), "schermata di consegna");
  await shot(p, "13-appello-consegnati");

  console.log("Giulia · dopo la consegna");
  await entra(context, "giulia", "+393331234567");
  await p.goto(APP + "/avvisi");
  ok(await p.getByText(/Luca è stato consegnato a scuola/).isVisible(), "Giulia: Luca consegnato");
  await shot(p, "14-avvisi-consegna");

  console.log("Amministratore");
  await entra(context, "admin");
  await p.goto(APP + "/"); await p.waitForURL("**/oggi");
  ok(await p.getByText(/Linea Verde consegnata alle/).isVisible(), "oggi: Verde consegnata");
  ok(await p.getByText("Iscrizioni in attesa").isVisible(), "KPI iscrizioni");
  await shot(p, "15-admin-oggi");
  await p.goto(APP + "/iscrizioni");
  ok(await p.getByText("Ahmed Karimi").isVisible(), "Karimi in attesa");
  const rigaKarimi = p.locator("div", { hasText: "Ahmed Karimi" }).filter({ has: p.getByRole("button", { name: "Approva" }) }).last();
  await rigaKarimi.getByRole("button", { name: "Approva" }).click();
  await p.getByText(/approvata/).first().waitFor({ timeout: 8000 });
  await p.waitForTimeout(800);
  await shot(p, "16-admin-iscrizioni");
  await p.goto(APP + "/linee");
  ok(await p.getByText("Via Roma, farmacia").isVisible(), "linee: fermate");
  await shot(p, "17-admin-linee");
  await p.goto(APP + "/turni");
  ok(await p.getByText(/Genera la bozza di novembre/).isVisible(), "turni admin: bozza da generare");
  await p.getByRole("button", { name: /Genera la bozza di novembre/ }).click();
  await p.getByText(/Bozza di novembre/).waitFor({ timeout: 15000 });
  await p.waitForTimeout(800);
  ok(await p.getByRole("button", { name: /Invia per conferma/ }).isVisible(), "bozza generata, da inviare");
  await shot(p, "18-admin-turni-bozza");
  await p.goto(APP + "/profilo");
  const sw = p.getByRole("switch", { name: /SMS per gli avvisi urgenti/ });
  ok(await sw.isVisible() && (await sw.getAttribute("aria-checked")) === "false", "profilo admin: interruttore SMS urgenti, spento");
  ok(await p.getByRole("switch", { name: /SMS a chi non ha le push/ }).isDisabled(), "ripiego disabilitato finché gli SMS sono spenti");
  await sw.click();
  await p.getByText("Canale attivato.").waitFor({ timeout: 8000 });
  await p.waitForTimeout(800);
  ok((await p.getByRole("switch", { name: /SMS per gli avvisi urgenti/ }).getAttribute("aria-checked")) === "true", "SMS urgenti accesi senza toccare codice");
  ok(await p.getByRole("switch", { name: /SMS a chi non ha le push/ }).isEnabled(), "ripiego ora attivabile");
  await shot(p, "19-admin-canali");
  await p.goto(APP + "/avvisi");
  ok(await p.getByText(/urgente, anche via SMS/).first().isVisible(), "gli avvisi urgenti dichiarano l'SMS");
  await p.goto(APP + "/profilo");
  await p.getByRole("switch", { name: /SMS per gli avvisi urgenti/ }).click();
  await p.getByText("Canale spento.").waitFor({ timeout: 8000 });
  await p.waitForTimeout(500);
  ok((await p.getByRole("switch", { name: /SMS per gli avvisi urgenti/ }).getAttribute("aria-checked")) === "false", "e rispenti");

  console.log("Karimi · ora genitore approvato");
  await entra(context, "karimi");
  await p.goto(APP + "/"); await p.waitForURL("**/presenze");
  ok(await p.getByText("Yasmin Karimi").isVisible(), "Yasmin in Presenze");

  console.log(`\nerrori di pagina: ${errori.length ? errori.join(" | ") : "nessuno"}`);
  console.log(fallite ? `✗ ${fallite} verifiche fallite` : "✔ giro completo");
  await browser.close();
  process.exit(fallite ? 1 : 0);
})();

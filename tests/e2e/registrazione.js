/* Il percorso di chi arriva nuovo: codice SMS (qui: cookie iniettato), registrazione, iscrizione di un
   bambino senza fermata, l'amministratore assegna linea e fermata e approva, il genitore entra in Presenze.
   Serve il Supabase in miniatura (tests/e2e/avvia.sh) e `next start -p 3077`.
   Uso: node tests/e2e/registrazione.js [--shots cartella] */
const { execSync } = require("child_process");
const { chromium } = require("playwright");
const { sessione } = require("./supalite.js");

const APP = process.env.APP_URL || "http://127.0.0.1:3077";
const SHOTS = process.argv.includes("--shots") ? process.argv[process.argv.indexOf("--shots") + 1] : null;
const NUOVO = "a0000000-0000-4000-8000-000000000098";
const ADMIN = "a0000000-0000-4000-8000-000000000009";
let fallite = 0;
const ok = (cond, msg) => { console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`); if (!cond) fallite++; };

async function entra(context, sub, phone) {
  const s = sessione({ sub, phone, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 86400 });
  await context.clearCookies();
  await context.addCookies([{ name: "sb-127-auth-token", value: "base64-" + Buffer.from(JSON.stringify(s)).toString("base64url"), url: APP }]);
}
const shot = async (p, nome) => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/${nome}.png`, fullPage: true }); };

(async () => {
  // Il primo accesso con l'OTP crea l'utente in auth: qui lo facciamo a mano, il trigger crea la persona vuota.
  execSync(`psql -v ON_ERROR_STOP=1 -q -d pedibus_e2e -c "delete from auth.users where id = '${NUOVO}'" -c "insert into auth.users (id, phone) values ('${NUOVO}', '393330000098')"`);

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "it-IT", timezoneId: "Europe/Rome" });
  const p = await context.newPage();
  const errori = []; p.on("pageerror", (e) => errori.push(e.message));

  console.log("Rita · nuova, entra con il codice");
  await entra(context, NUOVO, "393330000098");
  await p.goto(APP + "/");
  await p.waitForURL(/\/registrazione/, { timeout: 10000 });
  ok(p.url().endsWith("/registrazione"), "chi non è registrato finisce in /registrazione");
  await p.goto(APP + "/presenze");
  await p.waitForURL(/\/registrazione/, { timeout: 10000 });
  ok(p.url().endsWith("/registrazione"), "…anche se prova a entrare in una pagina dell'app");
  await shot(p, "r1-registrazione");

  await p.getByRole("button", { name: "Continua" }).click();
  ok(await p.locator("#nome:invalid").count() === 1 && p.url().endsWith("/registrazione"), "senza nome non si va avanti (validazione del browser)");
  await p.fill("#nome", "Rita"); await p.fill("#cognome", "Neri");
  await p.getByRole("button", { name: "Continua" }).click();
  ok(await p.getByText(/genitore, volontario o entrambi/).isVisible(), "serve scegliere chi si è");
  await p.getByRole("button", { name: /Genitore/ }).click();
  await p.getByRole("button", { name: /Volontario/ }).click();
  await p.getByRole("button", { name: "Continua" }).click();
  ok(await p.getByText("Serve il consenso").isVisible(), "serve il consenso");
  await p.locator("label[for=consenso]").click({ position: { x: 4, y: 4 } });
  await shot(p, "r2-registrazione-compilata");
  await p.getByRole("button", { name: "Continua" }).click();
  await p.waitForURL(/\/iscrizione/, { timeout: 15000 });
  ok(p.url().endsWith("/iscrizione"), "genitore: dopo la registrazione va all'iscrizione");
  ok(await p.getByText("Rita Neri").first().isVisible(), "il modulo conosce già il genitore");
  ok((await p.locator("#consenso").count()) === 0, "il consenso non si richiede");
  ok(await p.getByText("Vale l'informativa privacy").isVisible(), "…perché vale quello della registrazione");

  console.log("Rita · iscrive Nina senza fermata");
  await p.fill("#nome0", "Nina");
  ok((await p.locator("#cognome0").inputValue()) === "Neri", "cognome precompilato");
  ok((await p.locator("#fermata0 option", { hasText: "Non lo so ancora" }).count()) === 1 && (await p.locator("#fermata0").inputValue()) === "", "la fermata si può lasciare vuota");
  await shot(p, "r3-iscrizione");
  await p.getByRole("button", { name: /Invia l'iscrizione/ }).click();
  await p.getByText("Iscrizione inviata").waitFor({ timeout: 15000 });
  ok(true, "iscrizione inviata senza fermata");
  await p.getByRole("button", { name: /Torna all'app/ }).click();
  await p.waitForURL(/\/in-attesa/, { timeout: 10000 });
  ok(await p.getByText(/sta verificando l'iscrizione/).isVisible(), "in attesa: genitore da approvare");
  ok(await p.getByText(/albo dei volontari civici/).isVisible(), "in attesa: volontario da verificare");
  await shot(p, "r4-in-attesa");

  console.log("Admin · assegna linea e fermata, approva");
  await entra(context, ADMIN);
  await p.goto(APP + "/iscrizioni");
  const riga = p.locator("div", { hasText: "Nina Neri" }).filter({ has: p.getByLabel("Linea") }).last();
  ok(await riga.getByText("fermata da assegnare").isVisible(), "l'admin vede che manca la fermata");
  ok(await riga.getByRole("button", { name: "Approva" }).isDisabled(), "approva è spento finché non assegna");
  await riga.getByLabel("Linea").selectOption({ label: "Linea Verde" });
  await riga.getByLabel("Fermata").selectOption({ index: 3 });
  await shot(p, "r5-admin-assegna");
  await riga.getByRole("button", { name: "Approva" }).click();
  await p.getByText(/Iscrizione approvata/).waitFor({ timeout: 10000 });
  await p.waitForTimeout(800);
  ok((await p.locator("div", { hasText: "Nina Neri" }).filter({ hasText: "fermata da assegnare" }).count()) === 0, "approvata con la fermata assegnata");
  const rigaRita = p.locator("div", { hasText: "Rita Neri" }).filter({ hasText: "volontario" }).filter({ has: p.getByRole("button", { name: "Approva" }) }).last();
  ok(await rigaRita.isVisible(), "la richiesta da volontario di Rita è in lista");
  await rigaRita.getByRole("button", { name: "Approva" }).click();
  await p.getByText(/Ruolo approvato/).waitFor({ timeout: 10000 });

  console.log("Rita · ora entra");
  await entra(context, NUOVO, "393330000098");
  await p.goto(APP + "/");
  await p.waitForURL(/\/presenze/, { timeout: 10000 });
  ok(p.url().endsWith("/presenze"), "approvata: entra in Presenze");
  ok(await p.getByText("Nina Neri").isVisible(), "e vede Nina");
  ok(await p.getByText(/Linea Verde, fermata/).isVisible(), "con la fermata assegnata dall'admin");
  ok(await p.getByRole("tab", { name: "Volontario" }).isVisible(), "e ha anche il ruolo da volontaria");
  await shot(p, "r6-presenze");
  await p.goto(APP + "/registrazione");
  await p.waitForURL((u) => !u.pathname.endsWith("/registrazione"), { timeout: 10000 });
  ok(true, "chi è registrato non rivede la registrazione");

  console.log(`\nerrori di pagina: ${errori.length ? errori.join(" | ") : "nessuno"}`);
  console.log(fallite ? `✗ ${fallite} verifiche fallite` : "✔ tutto verde");
  await browser.close();
  process.exit(fallite || errori.length ? 1 : 0);
})();

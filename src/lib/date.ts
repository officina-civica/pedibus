/* Date e orari in italiano, fuso di Roma. */
const TZ = "Europe/Rome";

export const oggiRome = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date()); // YYYY-MM-DD

export function giornoLungo(iso: string) {
  const d = new Date(iso + "T12:00:00");
  const s = d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const oggiODomani = (iso: string) => (iso === oggiRome() ? "oggi" : "domani");

export const hhmm = (t: string) => t.slice(0, 5).replace(/^0/, "");           // "07:30:00" → "7:30"

export function quando(ts: string) {
  const d = new Date(ts);
  const giorno = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
  const ora = d.toLocaleTimeString("it-IT", { hour: "numeric", minute: "2-digit", timeZone: TZ });
  if (giorno === oggiRome()) return ora;
  return d.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short", timeZone: TZ }) + " " + ora;
}

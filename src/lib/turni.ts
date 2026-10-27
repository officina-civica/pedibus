import type { StatoTurno } from "@/lib/database.types";

export const PARTE: StatoTurno[] = ["programmato", "riattivato", "in_corso", "consegnato"];
export const turnoParte = (s: StatoTurno) => PARTE.includes(s);

export const ETICHETTA_TURNO: Record<StatoTurno, string> = {
  programmato: "parte", riattivato: "riattivata", in_corso: "in viaggio", consegnato: "consegnata",
  annullato_soglia: "annullata: sotto soglia", annullato_definitivo: "annullata per domani", annullato_volontari: "annullata: volontari insufficienti",
};

export const ETICHETTA_LINEA: Record<StatoTurno, string> = {
  programmato: "parte regolarmente", annullato_soglia: "annullata: sotto soglia", riattivato: "riattivata: soglia raggiunta",
  annullato_definitivo: "annullata", annullato_volontari: "annullata: volontari insufficienti", in_corso: "in viaggio", consegnato: "consegnata a scuola",
};

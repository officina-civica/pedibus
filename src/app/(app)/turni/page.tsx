import type { Metadata } from "next";
import { InCostruzione } from "@/components/in-costruzione";

export const metadata: Metadata = { title: "Turni" };

export default function Page() {
  return <InCostruzione titolo="Turni" sotto="I miei turni" cosa={["prossimo turno con team e kit", "«Non posso venire» con escalation automatica", "chi è di backup", "settimana e bozza del mese"]} />;
}

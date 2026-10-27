import type { Metadata } from "next";
import { InCostruzione } from "@/components/in-costruzione";

export const metadata: Metadata = { title: "Amministrazione" };

export default function Page() {
  return <InCostruzione titolo="Amministrazione" sotto="Il quadro della giornata" cosa={["linee sotto soglia e turni scoperti", "iscrizioni in attesa", "turni di domani con kit"]} />;
}

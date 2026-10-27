import type { Metadata } from "next";
import { InCostruzione } from "@/components/in-costruzione";

export const metadata: Metadata = { title: "Appello" };

export default function Page() {
  return <InCostruzione titolo="Appello" cosa={["fermata per fermata, spunte grandi", "bambino non in lista: solo se iscritto", "consegna a scuola con avviso ai genitori", "contatti d'emergenza solo durante il turno"]} />;
}

import type { Metadata } from "next";
import { InCostruzione } from "@/components/in-costruzione";

export const metadata: Metadata = { title: "Iscrizioni" };

export default function Page() {
  return <InCostruzione titolo="Iscrizioni" cosa={["approva o rifiuta genitori e volontari", "verifica nell'albo dei volontari civici", "registro delle decisioni"]} />;
}

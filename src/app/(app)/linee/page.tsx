import type { Metadata } from "next";
import { InCostruzione } from "@/components/in-costruzione";

export const metadata: Metadata = { title: "Linee" };

export default function Page() {
  return <InCostruzione titolo="Linee" cosa={["fermate, orari e bambini per fermata", "soglie e minimo volontari per linea", "calendario delle chiusure"]} />;
}

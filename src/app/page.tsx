import { redirect } from "next/navigation";
import { getSessione, HOME } from "@/lib/sessione";

export default async function Home() {
  const s = await getSessione();
  redirect(s.ruoloAttivo ? HOME[s.ruoloAttivo] : "/in-attesa");
}

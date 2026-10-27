import { supabaseServer } from "@/lib/supabase/server";
import type { Canali } from "@/lib/database.types";

/* Gli interruttori dei canali di notifica (impostazioni): l'app adatta i testi senza cambiare codice. */
export async function getCanali(): Promise<Canali> {
  const supabase = await supabaseServer();
  const { data } = await supabase.rpc("canali", {});
  return { sms_avvisi: data?.sms_avvisi === true, sms_ripiego: data?.sms_ripiego === true };
}

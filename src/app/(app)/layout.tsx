import { redirect } from "next/navigation";
import { getSessione } from "@/lib/sessione";
import { supabaseServer } from "@/lib/supabase/server";
import { TopBar } from "@/components/shell/top-bar";
import { BottomNav } from "@/components/shell/bottom-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await getSessione();
  if (!s.registrato) redirect("/registrazione");
  if (!s.ruoloAttivo) redirect("/in-attesa");

  const supabase = await supabaseServer();
  const { count: nonLetti } = await supabase
    .from("avvisi").select("id", { count: "exact", head: true })
    .eq("destinatario_id", s.userId).is("letto_il", null);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[430px] flex-col bg-card sm:my-0 sm:min-h-screen sm:border-x sm:border-border">
      <TopBar sessione={s} />
      <main className="flex-1 px-4 pt-[18px] pb-5">{children}</main>
      <BottomNav ruolo={s.ruoloAttivo} nonLetti={nonLetti ?? 0} />
    </div>
  );
}

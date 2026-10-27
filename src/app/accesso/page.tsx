import type { Metadata } from "next";
import { AccessoForm } from "./accesso-form";

export const metadata: Metadata = { title: "Accesso" };

export default function AccessoPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-3.5 px-4 pt-10 pb-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand text-[22px] font-bold text-brand-foreground">OC</div>
      <div className="text-center">
        <h1 className="text-[26px] font-bold tracking-tight">Pedibus Vedano</h1>
        <p className="text-sm text-muted-foreground">Officina Civica</p>
      </div>
      <AccessoForm />
    </main>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { segnaAvvisiLetti } from "@/app/(app)/azioni";

/* Aprire la lista vuol dire averla letta: il contatore sulla barra si azzera. */
export function SegnaLetti() {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(async () => { await segnaAvvisiLetti(); router.refresh(); }, 1500);
    return () => clearTimeout(t);
  }, [router]);
  return null;
}

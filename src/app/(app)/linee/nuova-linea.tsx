"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LineaDialog } from "./linea-dialog";

export function NuovaLinea({ scuolaId }: { scuolaId: string }) {
  const [aperto, setAperto] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setAperto(true)}><Plus /> Nuova linea</Button>
      {aperto && <LineaDialog scuolaId={scuolaId} open={aperto} onOpenChange={setAperto} />}
    </>
  );
}

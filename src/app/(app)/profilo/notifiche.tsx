"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellOff, BellRing } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { salvaAbbonamentoPush, rimuoviAbbonamentoPush } from "@/app/(app)/azioni";

type Abb = { id: string; endpoint: string; user_agent: string | null; creato_il: string; fallito_il: string | null };

/* Attiva o spegne le notifiche push su QUESTO dispositivo. Gli altri dispositivi restano come sono. */
export function Notifiche({ abbonamenti, vapidPublicKey }: { abbonamenti: Abb[]; vapidPublicKey: string }) {
  const router = useRouter();
  const [stato, setStato] = useState<"controllo" | "non_supportato" | "negato" | "attivo" | "spento" | "ios_home">("controllo");
  const [endpointQui, setEndpointQui] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        // iPhone: le push funzionano solo con l'app aggiunta alla schermata Home.
        const ios = /iPhone|iPad/.test(navigator.userAgent) && !(window.matchMedia("(display-mode: standalone)").matches);
        setStato(ios ? "ios_home" : "non_supportato");
        return;
      }
      if (Notification.permission === "denied") { setStato("negato"); return; }
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      setEndpointQui(sub?.endpoint ?? null);
      setStato(sub && abbonamenti.some((a) => a.endpoint === sub.endpoint && !a.fallito_il) ? "attivo" : "spento");
    })().catch(() => setStato("non_supportato"));
  }, [abbonamenti]);

  const attiva = () => start(async () => {
    setErrore(null);
    try {
      if (!vapidPublicKey) { setErrore("Le chiavi per le notifiche non sono ancora configurate sul server."); return; }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setStato("negato"); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToUint8(vapidPublicKey) });
      const json = sub.toJSON();
      const r = await salvaAbbonamentoPush({ endpoint: sub.endpoint, keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth } }, navigator.userAgent);
      if (!r.ok) { setErrore(r.errore ?? "Non sono riuscito a salvare l'abbonamento."); return; }
      setEndpointQui(sub.endpoint); setStato("attivo"); router.refresh();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Errore nell'attivazione.");
    }
  });

  const spegni = () => start(async () => {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) { await rimuoviAbbonamentoPush(sub.endpoint); await sub.unsubscribe(); }
    setEndpointQui(null); setStato("spento"); router.refresh();
  });

  const altri = abbonamenti.filter((a) => a.endpoint !== endpointQui && !a.fallito_il).length;

  return (
    <Card>
      <div className="flex items-center justify-between gap-2.5">
        <span className="flex items-center gap-2">{stato === "attivo" ? <BellRing size={16} /> : <BellOff size={16} />} Notifiche push su questo telefono</span>
        <Badge tone={stato === "attivo" ? "ok" : stato === "negato" ? "danger" : "muted"}>
          {stato === "attivo" ? "attive" : stato === "negato" ? "bloccate" : stato === "controllo" ? "…" : "spente"}
        </Badge>
      </div>
      {stato === "ios_home" && <p className="text-[13px] leading-[1.5] text-muted">Su iPhone le notifiche funzionano solo con l&apos;app aggiunta alla schermata Home: tocca Condividi → «Aggiungi alla schermata Home», poi riapri da lì.</p>}
      {stato === "non_supportato" && <p className="text-[13px] leading-[1.5] text-muted">Questo browser non supporta le notifiche push. Gli avvisi urgenti arrivano comunque via SMS.</p>}
      {stato === "negato" && <p className="text-[13px] leading-[1.5] text-muted">Hai bloccato le notifiche per questo sito: si riattivano dalle impostazioni del browser. Intanto gli urgenti arrivano via SMS.</p>}
      {stato === "spento" && (
        <>
          <p className="text-[13px] leading-[1.5] text-muted">Senza push, gli avvisi normali arrivano via SMS solo se il comitato lo ha attivato; quelli urgenti sempre.</p>
          <Button variant="primary" block disabled={pending} onClick={attiva}><BellRing size={18} /> Attiva le notifiche</Button>
        </>
      )}
      {stato === "attivo" && <Button block disabled={pending} onClick={spegni}><BellOff size={18} /> Spegni su questo telefono</Button>}
      {altri > 0 && <p className="text-[13px] text-muted">Attive anche su {altri} {altri === 1 ? "altro dispositivo" : "altri dispositivi"}.</p>}
      {errore && <p className="text-[13px] text-danger">{errore}</p>}
    </Card>
  );
}

function base64ToUint8(b64: string) {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

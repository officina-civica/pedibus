"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

/* Un messaggio in basso, come nel prototipo: scompare da solo. */
export function Toast({ messaggio, onDone, durata = 2600 }: { messaggio: string; onDone: () => void; durata?: number }) {
  useEffect(() => {
    const t = setTimeout(onDone, durata);
    return () => clearTimeout(t);
  }, [onDone, durata, messaggio]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div role="status" className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-[398px] rounded-[10px] bg-primary px-3.5 py-3 text-sm font-medium text-primary-fg shadow-lg">
      {messaggio}
    </div>,
    document.body,
  );
}

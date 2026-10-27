/*
  Ricorda, su questo dispositivo, se qui è stata registrata una passkey per il Pedibus.
  Serve solo alla schermata di accesso per decidere cosa proporre per primo: la passkey
  dove c'è, il codice SMS altrove. Non è un dato di sicurezza, solo una preferenza di UI.
*/
const CHIAVE = "pedibus:passkey-qui";

export function passkeyRegistrataQui(): boolean {
  try { return localStorage.getItem(CHIAVE) === "1"; } catch { return false; }
}

export function segnaPasskeyRegistrataQui(valore: boolean) {
  try {
    if (valore) localStorage.setItem(CHIAVE, "1");
    else localStorage.removeItem(CHIAVE);
  } catch { /* storage non disponibile: pazienza */ }
}

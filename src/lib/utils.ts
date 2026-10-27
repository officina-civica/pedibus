export { cn } from "cn"

/* Iniziali per gli avatar: "Giulia Rossi" -> "GR". */
export const iniziali = (nome: string) =>
  nome.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()

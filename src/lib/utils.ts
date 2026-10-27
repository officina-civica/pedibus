import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const iniziali = (nome: string) =>
  nome.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();

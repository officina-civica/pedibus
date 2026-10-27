import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import "./globals.css";

// Inter dal pacchetto @fontsource-variable (self-hosted): la build non dipende da Google Fonts.
const inter = localFont({
  src: [
    { path: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2", style: "normal" },
    { path: "../../node_modules/@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Pedibus Vedano", template: "%s · Pedibus Vedano" },
  description: "Il pedibus della scuola primaria di Vedano al Lambro — Officina Civica",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Pedibus" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#18181b" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: next-themes aggiunge la classe `dark` su <html> prima dell'idratazione.
    <html lang="it" suppressHydrationWarning className={cn("h-full antialiased", inter.variable)}>
      <body className="flex h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster position="bottom-center" mobileOffset={{ bottom: 96 }} offset={{ bottom: 96 }} />
        </ThemeProvider>
      </body>
    </html>
  );
}

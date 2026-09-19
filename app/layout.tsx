import type { Metadata, Viewport } from "next";
import { Anton, Archivo } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--font-anton" });
const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo" });

export const metadata: Metadata = {
  title: "Rifa PF Femenino",
  description: "Qué números quedan libres y cuánto lleva vendido cada una.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf1f5" },
    { media: "(prefers-color-scheme: dark)", color: "#160e12" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className={`${anton.variable} ${archivo.variable}`}>
      <body className="font-body antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

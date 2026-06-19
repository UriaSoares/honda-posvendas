import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });

export const metadata: Metadata = {
  title: "Mapa da Qualidade — Caiobá Honda",
  description: "Portal de Pós-Vendas Caiobá Honda",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${manrope.variable} font-sans antialiased bg-[#f8fafc]`}>
        {children}
      </body>
    </html>
  );
}

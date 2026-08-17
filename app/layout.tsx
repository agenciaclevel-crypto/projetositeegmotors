import type { Metadata } from "next";
import { Oswald, Inter, JetBrains_Mono } from "next/font/google";
import { getLoja } from "@/lib/supabase";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BotaoZap from "@/components/BotaoZap";
import "./globals.css";

const display = Oswald({ subsets: ["latin"], weight: ["500", "600"], variable: "--fonte-display" });
const corpo = Inter({ subsets: ["latin"], variable: "--fonte-corpo" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--fonte-mono" });

export async function generateMetadata(): Promise<Metadata> {
  const loja = await getLoja();
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    title: {
      default: `${loja.nome} — Carros novos e seminovos em ${loja.cidade}/${loja.uf}`,
      template: `%s | ${loja.nome}`,
    },
    description: loja.slogan ?? undefined,
    openGraph: { type: "website", locale: "pt_BR", siteName: loja.nome },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const loja = await getLoja();
  return (
    <html lang="pt-BR" className={`${display.variable} ${corpo.variable} ${mono.variable}`}>
      <body className="bg-bg0 font-sans text-ink">
        <Header loja={loja} />
        {children}
        <Footer loja={loja} />
        <BotaoZap loja={loja} />
      </body>
    </html>
  );
}

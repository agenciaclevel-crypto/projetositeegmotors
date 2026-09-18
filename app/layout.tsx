import type { Metadata } from "next";
import { Oswald, Inter, JetBrains_Mono } from "next/font/google";
import { getLoja } from "@/lib/supabase";
import { descricaoDaLoja, jsonLdLoja, regiaoCurta, siteUrl } from "@/lib/seo";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BotaoZap from "@/components/BotaoZap";
import "./globals.css";

const display = Oswald({ subsets: ["latin"], weight: ["500", "600"], variable: "--fonte-display" });
const corpo = Inter({ subsets: ["latin"], variable: "--fonte-corpo" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--fonte-mono" });

export async function generateMetadata(): Promise<Metadata> {
  const loja = await getLoja();
  const onde = regiaoCurta(loja);

  return {
    metadataBase: new URL(siteUrl()),
    title: {
      default: `${loja.nome} — Carros novos e seminovos em ${onde}`,
      template: `%s | ${loja.nome} — ${onde}`,
    },
    description: descricaoDaLoja(loja),
    openGraph: { type: "website", locale: "pt_BR", siteName: loja.nome },
    twitter: { card: "summary_large_image" },
    // max-image-preview large é o que libera a foto grande do carro no Google
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const loja = await getLoja();
  return (
    <html lang="pt-BR" className={`${display.variable} ${corpo.variable} ${mono.variable}`}>
      <body className="bg-bg0 font-sans text-ink">
        {/* Ficha da loja pro Google — endereço, horário e região atendida */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdLoja(loja)) }}
        />
        <Header loja={loja} />
        {children}
        <Footer loja={loja} />
        <BotaoZap loja={loja} />
      </body>
    </html>
  );
}

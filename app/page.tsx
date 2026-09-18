import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, MapPin } from "lucide-react";
import { getLoja, getVeiculos, getBanners } from "@/lib/supabase";
import { CIDADES_ATENDIDAS, descricaoDaLoja, enderecoCompleto, regiaoCurta } from "@/lib/seo";
import Banners from "@/components/Banners";
import Vitrine from "@/components/Vitrine";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const loja = await getLoja();
  const onde = regiaoCurta(loja);
  return {
    title: `${loja.nome} — Carros novos e seminovos em ${onde}`,
    description: descricaoDaLoja(loja),
    alternates: { canonical: "/" },
    openGraph: {
      title: `${loja.nome} — Carros novos e seminovos em ${onde}`,
      description: descricaoDaLoja(loja),
      url: "/",
      type: "website",
    },
  };
}

export default async function Home() {
  const loja = await getLoja();
  const [veiculos, banners] = await Promise.all([
    getVeiculos(loja.id),
    getBanners(loja.id),
  ]);

  const onde = regiaoCurta(loja);
  const cidade = loja.cidade ?? "";

  return (
    <main>
      <Banners banners={banners} loja={loja} />

      <section className="mx-auto max-w-[1180px] px-5 pb-10 pt-14">
        <div className="sobe mb-3.5 flex items-center gap-3">
          <span className="h-px w-[26px] bg-ouro" />
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ouro">
            {veiculos.length} veículos no pátio · {onde}
          </span>
        </div>

        <h1 className="sobe max-w-[780px] font-display text-[clamp(32px,5.6vw,58px)] uppercase leading-[1.04] tracking-[0.01em]">
          O carro certo,<br /><span className="text-ouro">com a procedência</span> que você merece.
        </h1>

        <p className="sobe mt-4 max-w-[560px] text-[17px] leading-relaxed text-inkDim">
          Novos e seminovos revisados em {onde}, com laudo cautelar e transferência
          feita aqui na loja.
        </p>

        <Vitrine veiculos={veiculos} />

        <div className="mt-14 rounded border border-linha bg-card p-8">
          <div className="max-w-[560px]">
            <h2 className="font-display text-[clamp(24px,4vw,34px)] uppercase leading-tight tracking-[0.02em]">
              Venda ou troque seu carro
            </h2>
            <p className="mt-3 text-base leading-relaxed text-inkDim">
              Solicite uma avaliação e receba uma proposta rápida, sem enrolação.
              Seu carro pode virar a entrada do próximo.
            </p>
            <Link href="/vender"
              className="mt-6 inline-flex items-center gap-2 rounded-[3px] bg-ouro px-5 py-3 text-sm font-semibold text-bg0">
              Avaliar meu carro <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {/* Bloco regional: diz em texto, pro cliente e pro Google, onde a loja
            fica e que região ela atende. */}
        <section className="mt-14 border-t border-linha pt-12">
          <h2 className="font-display text-[clamp(22px,3.4vw,30px)] uppercase leading-tight tracking-[0.02em]">
            Loja de carros em {onde}
          </h2>

          <div className="mt-5 grid max-w-[900px] gap-4 text-[15px] leading-relaxed text-inkDim md:grid-cols-2">
            <p>
              A {loja.nome} fica na {enderecoCompleto(loja)}. No pátio você encontra
              carros novos e seminovos revisados, com procedência verificada e laudo
              cautelar — e a transferência sai aqui mesmo, sem você precisar correr atrás
              de despachante.
            </p>
            <p>
              Atendemos {cidade} e a região: {CIDADES_ATENDIDAS.join(", ")} e todo o
              entorno. Trabalhamos com financiamento, troca do seu carro na entrada e
              também com agenciamento, para quem prefere vender o próprio veículo com a
              nossa estrutura.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/contato"
              className="inline-flex items-center gap-2 rounded-[3px] border border-linha px-5 py-3 text-sm font-semibold text-inkDim transition-colors hover:border-ouro hover:text-ouro">
              <MapPin size={16} /> Endereço e horários
            </Link>
            <Link href="/agenciamento"
              className="inline-flex items-center gap-2 rounded-[3px] border border-linha px-5 py-3 text-sm font-semibold text-inkDim transition-colors hover:border-ouro hover:text-ouro">
              Agenciamento de veículos <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </section>
    </main>
  );
}

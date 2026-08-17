import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getLoja, getVeiculos, getBanners } from "@/lib/supabase";
import Banners from "@/components/Banners";
import Vitrine from "@/components/Vitrine";

export const revalidate = 300;

export default async function Home() {
  const loja = await getLoja();
  const [veiculos, banners] = await Promise.all([
    getVeiculos(loja.id),
    getBanners(loja.id),
  ]);

  return (
    <main>
      <Banners banners={banners} loja={loja} />

      <section className="mx-auto max-w-[1180px] px-5 pb-10 pt-14">
        <div className="sobe mb-3.5 flex items-center gap-3">
          <span className="h-px w-[26px] bg-ouro" />
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ouro">
            {veiculos.length} veículos no pátio · {loja.cidade}/{loja.uf}
          </span>
        </div>

        <h1 className="sobe max-w-[780px] font-display text-[clamp(32px,5.6vw,58px)] uppercase leading-[1.04] tracking-[0.01em]">
          O carro certo,<br /><span className="text-ouro">com a procedência</span> que você merece.
        </h1>

        <p className="sobe mt-4 max-w-[540px] text-[17px] leading-relaxed text-inkDim">
          Novos e seminovos revisados, com laudo cautelar e transferência feita aqui na loja.
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
      </section>
    </main>
  );
}

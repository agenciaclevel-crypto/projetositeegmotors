import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { getLoja } from "@/lib/supabase";
import FormAgenciamento from "@/components/FormAgenciamento";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Agenciamento de veículos",
  description: "Deixe seu carro conosco para anunciar, negociar e vender — sem precisar vendê-lo direto para a loja.",
};

const BENEFICIOS = [
  "Seu carro anunciado nos principais canais, com fotos profissionais",
  "Nossa equipe cuida da negociação e da qualificação de quem se interessa",
  "Você acompanha tudo e só decide quando chegar uma proposta",
  "Cuidamos da parte burocrática da transferência no fechamento",
];

export default async function Agenciamento() {
  const loja = await getLoja();

  return (
    <main className="mx-auto max-w-[780px] px-5 py-16">
      <div className="mb-3.5 flex items-center gap-3">
        <span className="h-px w-[26px] bg-ouro" />
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ouro">Agenciamento</span>
      </div>
      <h1 className="font-display text-[clamp(30px,5vw,46px)] uppercase leading-tight tracking-[0.02em]">
        Seu carro anunciado e vendido, sem sair da sua garagem.
      </h1>
      <p className="mt-3.5 text-base leading-relaxed text-inkDim">
        No agenciamento, a {loja.nome} cuida de todo o processo de venda do seu carro — anúncio, negociação
        e burocracia — sem que você precise vender o veículo diretamente para a loja. Cadastre os dados abaixo
        e nossa equipe entra em contato para explicar as condições.
      </p>

      <ul className="mt-8 grid gap-3">
        {BENEFICIOS.map((b) => (
          <li key={b} className="flex items-start gap-3 text-sm leading-relaxed text-inkDim">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-ouro" /> {b}
          </li>
        ))}
      </ul>

      <FormAgenciamento lojaId={loja.id} />
    </main>
  );
}

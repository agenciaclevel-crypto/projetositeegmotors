import type { Metadata } from "next";
import { getLoja } from "@/lib/supabase";
import FormReposicao from "@/components/FormReposicao";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Venda ou troque seu carro",
  description: "Avaliação sem compromisso, proposta no mesmo dia e transferência feita na loja.",
};

export default async function Vender() {
  const loja = await getLoja();
  return (
    <main className="mx-auto max-w-[780px] px-5 py-16">
      <div className="mb-3.5 flex items-center gap-3">
        <span className="h-px w-[26px] bg-ouro" />
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ouro">
          Avaliação sem compromisso
        </span>
      </div>
      <h1 className="font-display text-[clamp(30px,5vw,46px)] uppercase leading-tight tracking-[0.02em]">
        Venda ou troque seu carro.
      </h1>
      <p className="mt-3.5 text-base leading-relaxed text-inkDim">
        Preencha os dados do veículo. A avaliação sai no mesmo dia, com pagamento à vista e
        transferência feita aqui na loja. Se preferir, seu carro entra como parte do pagamento do próximo.
      </p>
      <FormReposicao lojaId={loja.id} />
    </main>
  );
}

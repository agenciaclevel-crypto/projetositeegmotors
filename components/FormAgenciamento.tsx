"use client";

import { useState } from "react";
import { Check, Send } from "lucide-react";
import { criarLead } from "@/lib/supabase";

const campo = "w-full rounded-[3px] border border-linha bg-bg1 px-3 py-2.5 text-sm text-ink";
const rotulo = "mb-1.5 block font-mono text-[9px] uppercase tracking-[0.14em] text-inkFaint";

export default function FormAgenciamento({ lojaId }: { lojaId: string }) {
  const [d, setD] = useState({ nome: "", fone: "", marca: "", modelo: "", ano: "", km: "", valor: "", mensagem: "" });
  const [estado, setEstado] = useState<"parado" | "enviando" | "ok" | "erro">("parado");
  const set = (k: keyof typeof d) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setD({ ...d, [k]: e.target.value });

  const valido = d.nome.trim().length > 2 && d.fone.replace(/\D/g, "").length >= 10 && d.marca.trim() && d.modelo.trim();

  async function enviar() {
    if (!valido) return;
    setEstado("enviando");
    try {
      await criarLead({
        loja_id: lojaId, tipo: "reposicao", origem: "agenciamento",
        nome: d.nome.trim(), telefone: d.fone.trim(),
        mensagem: d.mensagem || undefined,
        veiculo_troca: {
          marca: d.marca, modelo: d.modelo, ano: d.ano,
          km: d.km, valor_pretendido: d.valor,
        },
      });
      setEstado("ok");
    } catch { setEstado("erro"); }
  }

  if (estado === "ok") {
    return (
      <div className="mt-10 rounded border border-linha bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-verde bg-verde/15">
          <Check size={22} className="text-verde" />
        </div>
        <p className="text-base font-semibold">Recebemos os dados do seu {d.marca} {d.modelo}.</p>
        <p className="mt-2 text-sm leading-relaxed text-inkDim">
          Nossa equipe entra em contato hoje mesmo no WhatsApp {d.fone} pra conversar sobre o agenciamento.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-10 rounded border border-linha bg-card">
      <div className="border-b border-linha p-6">
        <p className={rotulo}>Seus dados</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label><span className={rotulo}>Nome</span>
            <input value={d.nome} onChange={set("nome")} placeholder="Seu nome" className={campo} /></label>
          <label><span className={rotulo}>WhatsApp</span>
            <input value={d.fone} onChange={set("fone")} inputMode="tel" placeholder="(84) 9....." className={campo} /></label>
        </div>
      </div>

      <div className="p-6">
        <p className={rotulo}>Dados do veículo</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label><span className={rotulo}>Marca</span>
            <input value={d.marca} onChange={set("marca")} placeholder="Chevrolet" className={campo} /></label>
          <label><span className={rotulo}>Modelo e versão</span>
            <input value={d.modelo} onChange={set("modelo")} placeholder="Onix Plus LTZ 1.0 Turbo" className={campo} /></label>
          <label><span className={rotulo}>Ano</span>
            <input value={d.ano} onChange={set("ano")} inputMode="numeric" placeholder="2019/2020" className={campo} /></label>
          <label><span className={rotulo}>Quilometragem</span>
            <input value={d.km} onChange={set("km")} inputMode="numeric" placeholder="80.000" className={campo} /></label>
          <label className="sm:col-span-2"><span className={rotulo}>Valor pretendido (opcional)</span>
            <input value={d.valor} onChange={set("valor")} placeholder="R$ 60.000" className={campo} /></label>
          <label className="sm:col-span-2"><span className={rotulo}>Observações (opcional)</span>
            <textarea value={d.mensagem} onChange={set("mensagem")} rows={4} className={`${campo} resize-y`}
              placeholder="Estado de conservação, opcionais, se tem multa ou financiamento em aberto..." />
          </label>
        </div>

        {estado === "erro" && (
          <p className="mt-3 text-xs text-[#C25454]">Não foi possível enviar agora. Tente de novo ou chame no WhatsApp.</p>
        )}

        <button onClick={enviar} disabled={!valido || estado === "enviando"}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-[3px] bg-ouro py-3.5 text-sm font-semibold text-bg0 disabled:opacity-45">
          <Send size={16} /> {estado === "enviando" ? "Enviando..." : "Cadastrar meu carro para agenciamento"}
        </button>
        <p className="mt-3 text-center text-xs text-inkFaint">Sem compromisso. Respondemos no mesmo dia útil.</p>
      </div>
    </div>
  );
}

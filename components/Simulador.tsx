"use client";

import { useState } from "react";
import { brl, criarLead, linkWhatsApp, type Loja } from "@/lib/supabase";
import { eventoLead } from "@/lib/rastreio";

const TAXA_MES = 0.0149; // taxa de vitrine; a real vem da análise do banco

export default function Simulador({
  preco,
  loja,
  veiculoId,
  nomeVeiculo,
}: {
  preco: number;
  loja: Loja;
  veiculoId: string;
  nomeVeiculo: string;
}) {
  const [entrada, setEntrada] = useState(Math.round(preco * 0.3));
  const [prazo, setPrazo] = useState(48);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [estado, setEstado] = useState<"parado" | "enviando" | "ok" | "erro">("parado");

  const financiado = Math.max(preco - entrada, 0);
  const parcela =
    financiado > 0
      ? (financiado * TAXA_MES) / (1 - Math.pow(1 + TAXA_MES, -prazo))
      : 0;

  const valido = nome.trim().length > 2 && telefone.replace(/\D/g, "").length >= 10;

  async function enviar() {
    if (!valido) return;
    setEstado("enviando");
    try {
      await criarLead({
        loja_id: loja.id,
        nome: nome.trim(),
        telefone: telefone.trim(),
        tipo: "compra",
        origem: "financiamento",
        veiculo_id: veiculoId,
        mensagem: `Simulação de financiamento do ${nomeVeiculo}: entrada ${brl(entrada)}, ${prazo}x de ${brl(parcela)}`,
        veiculo_troca: {
          simulacao: true,
          entrada,
          prazo,
          parcela_estimada: Math.round(parcela),
          preco,
        },
      });
      eventoLead({
        nome: nomeVeiculo,
        categoria: "financiamento",
        valor: preco,
      });
      setEstado("ok");
    } catch {
      setEstado("erro");
    }
  }

  return (
    <div className="mt-7 rounded border border-[#2C303A] bg-[#16181D] p-5">
      <div className="mb-4 font-mono text-[9px] tracking-[0.14em] text-[#6E7280]">
        SIMULAR FINANCIAMENTO
      </div>

      <label className="block font-mono text-[9px] tracking-[0.14em] text-[#6E7280]">
        ENTRADA · {brl(entrada)}
        <input
          type="range"
          min={0}
          max={Math.round(preco * 0.8)}
          step={1000}
          value={entrada}
          onChange={(e) => setEntrada(Number(e.target.value))}
          className="mt-2 w-full accent-[#C7A25C]"
        />
      </label>

      <div className="mt-4 flex gap-2">
        {[24, 36, 48, 60].map((p) => (
          <button
            key={p}
            onClick={() => setPrazo(p)}
            className={`flex-1 rounded border py-2.5 font-mono text-xs ${
              prazo === p
                ? "border-[#C7A25C] bg-[#C7A25C] text-[#0E0F12]"
                : "border-[#2C303A] text-[#A6A9B2]"
            }`}
          >
            {p}x
          </button>
        ))}
      </div>

      <div className="mt-5 flex items-baseline justify-between border-t border-[#2C303A] pt-4">
        <span className="text-[13px] text-[#A6A9B2]">{prazo} parcelas de</span>
        <span className="font-display text-2xl text-[#F3F0E9]">{brl(parcela)}</span>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-[#6E7280]">
        Simulação estimada a {(TAXA_MES * 100).toFixed(2).replace(".", ",")}% a.m.
        O valor final depende da análise de crédito do banco.
      </p>

      {estado === "ok" ? (
        <div className="mt-5 rounded border border-[#5B8A69]/40 bg-[#5B8A69]/10 p-4 text-center">
          <p className="text-[13px] font-semibold text-[#F3F0E9]">
            Recebemos sua simulação, {nome.split(" ")[0]}.
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-[#A6A9B2]">
            Um consultor confirma as condições com o banco e te chama no WhatsApp.
          </p>
          <a
            href={linkWhatsApp(loja, `Olá! Simulei o financiamento do ${nomeVeiculo}: entrada ${brl(entrada)}, ${prazo}x de ${brl(parcela)}.`)}
            target="_blank" rel="noreferrer"
            className="mt-3 inline-block rounded bg-[#1E8E4A] px-4 py-2 text-xs font-semibold text-white"
          >
            Chamar no WhatsApp agora
          </a>
        </div>
      ) : (
        <div className="mt-5 border-t border-[#2C303A] pt-4">
          <p className="mb-3 text-[11px] leading-relaxed text-[#A6A9B2]">
            Quer levar essa simulação pra análise? Deixe seu contato:
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Seu nome"
              className="w-full rounded border border-[#2C303A] bg-[#20232A] px-3 py-2.5 text-sm text-[#F3F0E9] outline-none focus:border-[#C7A25C]"
            />
            <input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              inputMode="tel"
              placeholder="WhatsApp — (84) 9...."
              className="w-full rounded border border-[#2C303A] bg-[#20232A] px-3 py-2.5 text-sm text-[#F3F0E9] outline-none focus:border-[#C7A25C]"
            />
          </div>
          {estado === "erro" && (
            <p className="mt-2 text-xs text-[#C25454]">
              Não foi possível enviar agora. Tente de novo ou chame no WhatsApp.
            </p>
          )}
          <button
            onClick={enviar}
            disabled={!valido || estado === "enviando"}
            className="mt-3 w-full rounded bg-[#C7A25C] py-3 text-sm font-semibold text-[#0E0F12] disabled:opacity-45"
          >
            {estado === "enviando" ? "Enviando..." : "Quero essa simulação com um consultor"}
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { criarLead } from "@/lib/supabase";

export default function FormLead({
  lojaId,
  veiculoId,
  nomeVeiculo,
}: {
  lojaId: string;
  veiculoId?: string;
  nomeVeiculo?: string;
}) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [troca, setTroca] = useState(false);
  const [estado, setEstado] = useState<"parado" | "enviando" | "ok" | "erro">("parado");

  const valido = nome.trim().length > 2 && telefone.replace(/\D/g, "").length >= 10;

  async function enviar() {
    if (!valido) return;
    setEstado("enviando");
    try {
      await criarLead({
        loja_id: lojaId,
        nome: nome.trim(),
        telefone: telefone.trim(),
        veiculo_id: veiculoId ?? null,
        mensagem: nomeVeiculo ? `Interesse em ${nomeVeiculo}` : undefined,
        veiculo_troca: troca ? { tem_troca: true } : null,
      });
      setEstado("ok");
    } catch {
      setEstado("erro");
    }
  }

  if (estado === "ok") {
    return (
      <div className="mt-5 rounded border border-[#2C303A] bg-[#20232A] p-6 text-center">
        <p className="text-[15px] font-semibold text-[#F3F0E9]">
          Recebemos seu contato, {nome.split(" ")[0]}.
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-[#A6A9B2]">
          Um consultor chama você no WhatsApp para combinar a visita.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded border border-[#2C303A] bg-[#20232A] p-5">
      <div className="mb-4 font-mono text-[9px] tracking-[0.14em] text-[#6E7280]">
        FALAR SOBRE ESTE CARRO
      </div>

      <label className="block">
        <span className="mb-1.5 block font-mono text-[9px] tracking-[0.14em] text-[#6E7280]">
          NOME
        </span>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Seu nome"
          className="w-full rounded border border-[#2C303A] bg-[#16181D] px-3 py-2.5 text-sm text-[#F3F0E9] outline-none focus:border-[#C7A25C]"
        />
      </label>

      <label className="mt-3 block">
        <span className="mb-1.5 block font-mono text-[9px] tracking-[0.14em] text-[#6E7280]">
          WHATSAPP
        </span>
        <input
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          inputMode="tel"
          placeholder="(84) 9...."
          className="w-full rounded border border-[#2C303A] bg-[#16181D] px-3 py-2.5 text-sm text-[#F3F0E9] outline-none focus:border-[#C7A25C]"
        />
      </label>

      <label className="mt-3 flex cursor-pointer items-center gap-2 text-[13px] text-[#A6A9B2]">
        <input
          type="checkbox"
          checked={troca}
          onChange={(e) => setTroca(e.target.checked)}
          className="accent-[#C7A25C]"
        />
        Tenho um carro para dar na troca
      </label>

      {estado === "erro" && (
        <p className="mt-3 text-xs text-[#C25454]">
          Não foi possível enviar agora. Tente de novo ou chame no WhatsApp.
        </p>
      )}

      <button
        onClick={enviar}
        disabled={!valido || estado === "enviando"}
        className="mt-4 w-full rounded bg-[#C7A25C] py-3 text-sm font-semibold text-[#0E0F12] disabled:opacity-45"
      >
        {estado === "enviando" ? "Enviando..." : "Quero falar com um consultor"}
      </button>
    </div>
  );
}

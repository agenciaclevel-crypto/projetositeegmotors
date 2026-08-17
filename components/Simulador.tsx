"use client";

import { useState } from "react";
import { brl } from "@/lib/supabase";

const TAXA_MES = 0.0149; // taxa de vitrine; a real vem da análise do banco

export default function Simulador({ preco }: { preco: number }) {
  const [entrada, setEntrada] = useState(Math.round(preco * 0.3));
  const [prazo, setPrazo] = useState(48);

  const financiado = Math.max(preco - entrada, 0);
  const parcela =
    financiado > 0
      ? (financiado * TAXA_MES) / (1 - Math.pow(1 + TAXA_MES, -prazo))
      : 0;

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
    </div>
  );
}

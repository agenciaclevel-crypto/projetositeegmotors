"use client";

import Link from "next/link";
import Image from "next/image";
import { Car } from "lucide-react";
import { type Veiculo, brl, formatKm, capaDe } from "@/lib/supabase";
import { useRevela } from "@/lib/useRevela";

export default function VeiculoCard({
  v, prioridade, indice = 0,
}: { v: Veiculo; prioridade?: boolean; indice?: number }) {
  const capa = capaDe(v);
  const qtd = v.veiculo_fotos?.length ?? 0;
  // Segunda foto do carro (por ordem), pra trocar no hover — igual à referência.
  // Se só existe 1 foto, fica null e o hover mantém só o zoom de sempre.
  const segunda = [...(v.veiculo_fotos ?? [])]
    .sort((a, b) => a.ordem - b.ordem)
    .find((f) => f !== capa) ?? null;
  // Ref/transição de entrada ficam num wrapper — não no próprio Link, pra não
  // brigar com a transição de hover (".cartao", em globals.css: all .18s).
  const { ref, visivel } = useRevela<HTMLDivElement>();

  return (
    <div
      ref={ref}
      style={{ transitionDelay: visivel ? `${(indice % 3) * 90}ms` : "0ms" }}
      className={`transition-[opacity,transform] duration-500 ease-out ${
        visivel ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
    >
    <Link
      href={`/veiculo/${v.slug}`}
      className="cartao group block overflow-hidden rounded border border-linha bg-card"
    >
      <div className="foto relative aspect-[3/2] overflow-hidden bg-bg1">
        {capa ? (
          <Image src={capa.url_thumb ?? capa.url} alt={`${v.marca} ${v.modelo} ${v.versao ?? ""}`}
            fill priority={prioridade} sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
            className={`object-cover transition-opacity duration-300 ${segunda ? "group-hover:opacity-0" : ""}`} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <Car size={34} strokeWidth={1} className="text-ouro/30" />
            <span className="font-mono text-[9px] tracking-[0.14em] text-inkFaint">FOTO PENDENTE</span>
          </div>
        )}

        {segunda && (
          <Image src={segunda.url_thumb ?? segunda.url} alt={`${v.marca} ${v.modelo} ${v.versao ?? ""} — outro ângulo`}
            fill sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
            className="object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        )}

        <div className="absolute left-3 top-3 flex gap-2">
          {v.condicao === "novo" && (
            <span className="rounded-sm border border-ouro/35 bg-ouro/10 px-2 py-1 font-mono text-[9px] tracking-[0.14em] text-ouroClaro">0 KM</span>
          )}
          {v.preco_de && (
            <span className="rounded-sm border border-verde/40 bg-verde/15 px-2 py-1 font-mono text-[9px] tracking-[0.14em] text-[#8FC7A3]">OPORTUNIDADE</span>
          )}
        </div>

        {qtd > 0 && (
          <span className="absolute bottom-3 right-3 rounded-sm bg-bg0/75 px-2 py-1 font-mono text-[10px] text-inkDim">
            {qtd} fotos
          </span>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-display text-lg uppercase tracking-[0.02em]">{v.marca} {v.modelo}</h3>
        <p className="mt-0.5 min-h-[19px] text-[13px] text-inkDim">{v.versao}</p>
        <div className="mt-3 border-b border-linha pb-3 font-mono text-[11px] tracking-[0.04em] text-inkFaint">
          {v.ano_fabricacao}/{v.ano_modelo} · {formatKm(v.km)} · {v.cambio}
        </div>
        {v.preco_de && <div className="mt-3 font-mono text-[11px] text-inkFaint line-through">{brl(v.preco_de)}</div>}
        <div className="font-display text-2xl text-ouro">{brl(v.preco)}</div>
      </div>
    </Link>
    </div>
  );
}

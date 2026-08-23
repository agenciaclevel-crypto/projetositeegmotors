"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Car } from "lucide-react";
import { type Veiculo, brl, formatKm, capaDe } from "@/lib/supabase";
import { useRevela } from "@/lib/useRevela";

const INTERVALO_CICLO_MS = 700; // troca de foto no hover — sempre abaixo de 1s

export default function VeiculoCard({
  v, prioridade, indice = 0,
}: { v: Veiculo; prioridade?: boolean; indice?: number }) {
  const capa = capaDe(v);
  // Fotos na ordem de exibição, sempre começando pela capa (foto 1).
  const fotosCiclo = capa
    ? [capa, ...[...(v.veiculo_fotos ?? [])].sort((a, b) => a.ordem - b.ordem).filter((f) => f !== capa)]
    : [];
  const qtd = fotosCiclo.length;

  const [indiceAtivo, setIndiceAtivo] = useState(0);
  const [interagiu, setInteragiu] = useState(false); // só carrega as demais fotos após o 1º hover
  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function iniciarCiclo() {
    setInteragiu(true);
    if (qtd < 2 || intervaloRef.current) return;
    intervaloRef.current = setInterval(() => {
      setIndiceAtivo((i) => (i + 1) % qtd);
    }, INTERVALO_CICLO_MS);
  }
  function pararCiclo() {
    if (intervaloRef.current) { clearInterval(intervaloRef.current); intervaloRef.current = null; }
    setIndiceAtivo(0);
  }
  useEffect(() => () => { if (intervaloRef.current) clearInterval(intervaloRef.current); }, []);

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
      onMouseEnter={iniciarCiclo}
      onMouseLeave={pararCiclo}
      className="cartao group block overflow-hidden rounded border border-linha bg-card"
    >
      <div className="foto relative aspect-[3/2] overflow-hidden bg-bg1">
        {qtd > 0 ? (
          fotosCiclo.map((f, i) => (
            (i === 0 || interagiu) && (
              <Image key={f.url} src={f.url_thumb ?? f.url} alt={`${v.marca} ${v.modelo} ${v.versao ?? ""}`}
                fill priority={prioridade && i === 0} sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
                className={`object-cover transition-opacity duration-300 ${indiceAtivo === i ? "opacity-100" : "opacity-0"}`} />
            )
          ))
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <Car size={34} strokeWidth={1} className="text-ouro/30" />
            <span className="font-mono text-[9px] tracking-[0.14em] text-inkFaint">FOTO PENDENTE</span>
          </div>
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

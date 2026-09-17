"use client";

import { useState } from "react";
import Image from "next/image";
import type { Foto } from "@/lib/supabase";
import { useRevela } from "@/lib/useRevela";

export default function GaleriaVeiculo({ fotos, nome }: { fotos: Foto[]; nome: string }) {
  const principal = useRevela<HTMLDivElement>();
  const [ativa, setAtiva] = useState(0);
  const foto = fotos[ativa] ?? fotos[0];

  return (
    <>
      {foto && (
        <div
          ref={principal.ref}
          className={`relative aspect-[3/2] overflow-hidden rounded border border-[#2C303A] bg-[#16181D] transition-all duration-700 ease-out ${
            principal.visivel ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          <Image
            src={foto.url}
            alt={`${nome} — foto ${ativa + 1}`}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 60vw"
            className="object-cover"
          />
        </div>
      )}

      {fotos.length > 1 && (
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
          {fotos.map((f, i) => (
            <Miniatura key={f.url} f={f} nome={nome} indice={i} ativa={i === ativa} aoClicar={() => setAtiva(i)} />
          ))}
        </div>
      )}
    </>
  );
}

function Miniatura({
  f, nome, indice, ativa, aoClicar,
}: { f: Foto; nome: string; indice: number; ativa: boolean; aoClicar: () => void }) {
  const { ref, visivel } = useRevela<HTMLButtonElement>();

  return (
    <button
      ref={ref}
      type="button"
      onClick={aoClicar}
      aria-label={`Ver foto ${indice + 1} de ${nome}`}
      aria-current={ativa}
      style={{ transitionDelay: visivel ? `${Math.min(indice, 8) * 60}ms` : "0ms" }}
      className={`relative block aspect-[3/2] overflow-hidden rounded border bg-[#16181D] transition-all duration-500 ease-out ${
        ativa ? "border-ouro" : "border-[#2C303A] hover:border-ouro/60"
      } ${visivel ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-[0.97] opacity-0"}`}
    >
      <Image
        src={f.url_thumb ?? f.url}
        alt={`${nome} — foto ${indice + 1}`}
        fill
        loading="lazy"
        sizes="20vw"
        className={`object-cover transition-opacity ${ativa ? "opacity-60" : "opacity-100"}`}
      />
    </button>
  );
}

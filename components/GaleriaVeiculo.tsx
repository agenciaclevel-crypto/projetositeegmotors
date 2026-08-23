"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { Foto } from "@/lib/supabase";

/** Revela o elemento com uma animação assim que ele entra na tela ao rolar. */
function useRevela<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          setVisivel(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return { ref, visivel };
}

export default function GaleriaVeiculo({ fotos, nome }: { fotos: Foto[]; nome: string }) {
  const principal = useRevela<HTMLDivElement>();

  return (
    <>
      {fotos[0] && (
        <div
          ref={principal.ref}
          className={`relative aspect-[3/2] overflow-hidden rounded border border-[#2C303A] bg-[#16181D] transition-all duration-700 ease-out ${
            principal.visivel ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          <Image
            src={fotos[0].url}
            alt={`${nome} — foto principal`}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 60vw"
            className="object-cover"
          />
        </div>
      )}

      <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
        {fotos.slice(1).map((f, i) => (
          <Miniatura key={f.url} f={f} nome={nome} indice={i} />
        ))}
      </div>
    </>
  );
}

function Miniatura({ f, nome, indice }: { f: Foto; nome: string; indice: number }) {
  const { ref, visivel } = useRevela<HTMLDivElement>();

  return (
    <div
      ref={ref}
      style={{ transitionDelay: visivel ? `${Math.min(indice, 8) * 60}ms` : "0ms" }}
      className={`relative aspect-[3/2] overflow-hidden rounded border border-[#2C303A] bg-[#16181D] transition-all duration-500 ease-out ${
        visivel ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-[0.97] opacity-0"
      }`}
    >
      <Image
        src={f.url_thumb ?? f.url}
        alt={`${nome} — foto ${indice + 2}`}
        fill
        loading="lazy"
        sizes="20vw"
        className="object-cover"
      />
    </div>
  );
}

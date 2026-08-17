"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { MessageCircle } from "lucide-react";
import type { Banner, Loja } from "@/lib/supabase";
import { linkWhatsApp } from "@/lib/supabase";

export default function Banners({ banners, loja }: { banners: Banner[]; loja: Loja }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % banners.length), 6500);
    return () => clearInterval(t);
  }, [banners.length]);

  if (!banners.length) return null;
  const b = banners[i % banners.length];

  return (
    <section className="border-b border-linha bg-bg1">
      <div className="mx-auto max-w-[1180px] px-5 py-6">
        <div className="relative min-h-[300px] overflow-hidden rounded-[5px] border border-linha">
          <Image src={b.imagem_url} alt={b.titulo ?? ""} fill priority className="object-cover" sizes="100vw" />
          <div className="absolute inset-0 bg-gradient-to-r from-bg0/95 via-bg0/80 to-bg0/25" />

          <div className="relative flex min-h-[300px] max-w-[620px] flex-col justify-center p-7 sm:p-10">
            <div className="mb-3 flex items-center gap-3">
              <span className="h-px w-[22px] bg-ouro" />
              <span className="font-mono text-[9px] tracking-[0.16em] text-ouro">{loja.nome.toUpperCase()}</span>
            </div>
            <h2 className="font-display text-[clamp(24px,4.4vw,38px)] uppercase leading-tight tracking-[0.02em]">
              {b.titulo}
            </h2>
            <p className="mt-2.5 text-base leading-relaxed text-inkDim">{b.legenda}</p>

            <a href={linkWhatsApp(loja, b.link || `Olá! Vi a campanha "${b.titulo}" no site.`)}
              target="_blank" rel="noreferrer"
              className="mt-7 inline-flex w-fit items-center gap-2 rounded-[3px] bg-zap px-6 py-3.5 text-[15px] font-semibold text-white">
              <MessageCircle size={17} /> Falar no WhatsApp
            </a>
          </div>

          {banners.length > 1 && (
            <div className="absolute bottom-4 right-5 flex gap-2">
              {banners.map((x, j) => (
                <button key={x.id} onClick={() => setI(j)} aria-label={`Banner ${j + 1}`}
                  className={`h-2 rounded-full transition-all ${j === i % banners.length ? "w-6 bg-ouro" : "w-2 bg-ink/35"}`} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

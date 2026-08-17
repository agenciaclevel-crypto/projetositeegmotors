import Image from "next/image";
import { MapPin, Phone, Instagram, Clock } from "lucide-react";
import type { Loja } from "@/lib/supabase";

export default function Footer({ loja }: { loja: Loja }) {
  return (
    <footer className="mt-20 border-t border-linha bg-bg1">
      <div className="mx-auto grid max-w-[1180px] gap-10 px-5 py-14 md:grid-cols-3">
        <div>
          {loja.logo_claro_url ? (
            <Image src={loja.logo_claro_url} alt={loja.nome} width={150} height={38} className="h-[38px] w-auto" />
          ) : (
            <span className="font-display text-2xl uppercase tracking-[0.06em]">{loja.nome}</span>
          )}
          <p className="mt-4 text-sm leading-relaxed text-inkDim">{loja.slogan}</p>
        </div>

        <div className="space-y-3 text-sm text-inkDim">
          <p className="flex items-start gap-2"><MapPin size={16} className="mt-0.5 shrink-0" /> {loja.endereco}</p>
          <p className="flex items-center gap-2"><Phone size={16} /> {loja.whatsapp}</p>
          <p className="flex items-center gap-2"><Instagram size={16} /> {loja.instagram}</p>
        </div>

        <div className="text-sm text-inkDim">
          <p className="mb-3 flex items-center gap-2"><Clock size={16} /> Horário de atendimento</p>
          <p className="font-mono text-xs leading-loose text-inkFaint">
            SEG A SEX · {loja.horario_semana}<br />SÁBADO · {loja.horario_sabado}
          </p>
        </div>
      </div>
      <div className="border-t border-linha px-5 py-5 text-center font-mono text-[9px] tracking-[0.12em] text-inkFaint">
        {(loja.dominio ?? "").toUpperCase()} · SITE E GESTÃO POR C-LEVEL
      </div>
    </footer>
  );
}

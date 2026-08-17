import type { Metadata } from "next";
import { MapPin, Phone, Instagram, Clock, MessageCircle } from "lucide-react";
import { getLoja, linkWhatsApp } from "@/lib/supabase";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Contato e localização",
  description: "Endereço, horário de atendimento e rota até a loja.",
};

export default async function Contato() {
  const loja = await getLoja();
  const endereco = `${loja.endereco}, ${loja.bairro}, ${loja.cidade} - ${loja.uf}`;
  const mapa = `https://www.google.com/maps?q=${encodeURIComponent(endereco)}&output=embed`;
  const rota = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(endereco)}`;

  const itens: [React.ReactNode, string, string][] = [
    [<MapPin size={18} key="a" />, "Endereço", endereco],
    [<Phone size={18} key="b" />, "WhatsApp", loja.whatsapp ?? "—"],
    [<Instagram size={18} key="c" />, "Instagram", loja.instagram ?? "—"],
    [<Clock size={18} key="d" />, "Segunda a sexta", loja.horario_semana],
    [<Clock size={18} key="e" />, "Sábado", loja.horario_sabado],
  ];

  return (
    <main className="mx-auto max-w-[1000px] px-5 py-16">
      <div className="mb-3.5 flex items-center gap-3">
        <span className="h-px w-[26px] bg-ouro" />
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ouro">Onde estamos</span>
      </div>
      <h1 className="font-display text-[clamp(30px,5vw,46px)] uppercase leading-tight tracking-[0.02em]">
        Venha tomar um café no pátio.
      </h1>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded border border-linha bg-bg1">
          <iframe
            title="Mapa da loja"
            src={mapa}
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
            className="block h-[340px] w-full border-0"
          />
          <div className="flex flex-wrap gap-2 border-t border-linha p-4">
            <a href={rota} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-[3px] bg-ouro px-5 py-3 text-sm font-semibold text-bg0">
              <MapPin size={16} /> Traçar rota até a loja
            </a>
            <a href={linkWhatsApp(loja, "Olá! Quero agendar uma visita à loja.")} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-[3px] border border-linha px-5 py-3 text-sm font-semibold">
              <MessageCircle size={16} /> Agendar visita
            </a>
          </div>
        </div>

        <div className="grid content-start gap-3">
          {itens.map(([ic, t, val]) => (
            <div key={t} className="flex items-start gap-4 rounded border border-linha bg-card p-4">
              <span className="mt-0.5 text-ouro">{ic}</span>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-inkFaint">{t}</p>
                <p className="mt-1.5 text-[15px] leading-relaxed">{val}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

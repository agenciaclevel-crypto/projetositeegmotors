import { MessageCircle } from "lucide-react";
import type { Loja } from "@/lib/supabase";
import { linkWhatsApp } from "@/lib/supabase";

export default function BotaoZap({ loja }: { loja: Loja }) {
  return (
    <a
      href={linkWhatsApp(loja, `Olá! Vim pelo site da ${loja.nome} e quero atendimento.`)}
      target="_blank" rel="noreferrer" aria-label="Falar no WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-zap shadow-lg shadow-black/50"
    >
      <MessageCircle size={26} color="#fff" />
    </a>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X, MessageCircle, Phone } from "lucide-react";
import type { Loja } from "@/lib/supabase";
import { linkWhatsApp, digitosNacionais, formatarTelefone } from "@/lib/supabase";

const NAV = [
  { href: "/", label: "Estoque" },
  { href: "/vender", label: "Venda seu carro" },
  { href: "/agenciamento", label: "Agenciamento" },
  { href: "/contato", label: "Contato" },
];

export default function Header({ loja }: { loja: Loja }) {
  const [aberto, setAberto] = useState(false);
  const [rolando, setRolando] = useState(false);
  const caminho = usePathname();

  // Enquanto a página rola, a logo encolhe (some o "Motors", fica só o "EG");
  // ao parar de rolar, volta ao tamanho completo.
  useEffect(() => {
    let temporizador: ReturnType<typeof setTimeout>;
    function aoRolar() {
      if (window.scrollY > 60) {
        setRolando(true);
        clearTimeout(temporizador);
        temporizador = setTimeout(() => setRolando(false), 220);
      } else {
        clearTimeout(temporizador);
        setRolando(false);
      }
    }
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => {
      window.removeEventListener("scroll", aoRolar);
      clearTimeout(temporizador);
    };
  }, []);

  const [primeiroNome, ...restoNome] = loja.nome.split(" ");
  const restanteNome = restoNome.join(" ");

  return (
    <header className="sticky top-0 z-30 border-b border-linha bg-bg0/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between px-5 py-4">
        <Link href="/" onClick={() => setAberto(false)} className="flex items-center">
          {loja.logo_claro_url ? (
            <div className={`overflow-hidden transition-[max-width] duration-500 ease-out ${
              rolando ? "max-w-[40px]" : "max-w-[160px]"}`}>
              <Image src={loja.logo_claro_url} alt={loja.nome} width={160} height={40}
                className="h-10 w-auto max-w-none" priority />
            </div>
          ) : (
            <span className="flex items-baseline font-display text-lg uppercase tracking-[0.06em]">
              <span>{primeiroNome}</span>
              {restanteNome && (
                <span className={`overflow-hidden whitespace-nowrap transition-all duration-500 ease-out ${
                  rolando ? "ml-0 max-w-0 opacity-0" : "ml-2 max-w-[160px] opacity-100"}`}>
                  {restanteNome}
                </span>
              )}
            </span>
          )}
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {NAV.map((i) => (
            <Link key={i.href} href={i.href}
              className={`text-sm font-medium transition-colors ${caminho === i.href ? "text-ink" : "text-inkDim hover:text-ink"}`}>
              {i.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {loja.whatsapp && (
            <a href={`tel:+55${digitosNacionais(loja.whatsapp)}`}
              className="hidden items-center gap-1.5 text-sm font-medium text-inkDim transition-colors hover:text-ink sm:flex">
              <Phone size={15} /> {formatarTelefone(loja.whatsapp)}
            </a>
          )}
          <a href={linkWhatsApp(loja, `Olá! Vim pelo site da ${loja.nome}.`)}
            target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-[3px] bg-zap px-5 py-3 text-sm font-semibold text-white">
            <MessageCircle size={16} /><span className="hidden sm:inline">WhatsApp</span>
          </a>
          <button onClick={() => setAberto((a) => !a)} aria-label="Menu"
            className="rounded-[3px] border border-linha p-2.5 md:hidden">
            {aberto ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {aberto && (
        <nav className="border-t border-linha bg-bg1 md:hidden">
          {NAV.map((i) => (
            <Link key={i.href} href={i.href} onClick={() => setAberto(false)}
              className={`block border-b border-linha px-5 py-4 text-[15px] font-medium ${caminho === i.href ? "text-ouro" : "text-inkDim"}`}>
              {i.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

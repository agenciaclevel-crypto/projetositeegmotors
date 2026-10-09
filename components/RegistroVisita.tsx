"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  definirLoja, medirLeitura, registrarClique, registrarInteracaoFormulario, registrarVisita,
} from "@/lib/visitas";

/** Conta o acesso a cada página aberta, inclusive nas trocas de página que o
 * Next faz sem recarregar o site, e o que a pessoa faz nela: clique no
 * WhatsApp, formulário começado, tempo de leitura. Não desenha nada na tela. */
export default function RegistroVisita({ lojaId }: { lojaId: string }) {
  const caminho = usePathname();
  const ultimoRegistrado = useRef<string | null>(null);

  useEffect(() => { definirLoja(lojaId); }, [lojaId]);

  useEffect(() => {
    const sinaisDeFormulario = ["focusin", "input", "click"] as const;
    document.addEventListener("click", registrarClique, true);
    sinaisDeFormulario.forEach((s) => document.addEventListener(s, registrarInteracaoFormulario, true));
    return () => {
      document.removeEventListener("click", registrarClique, true);
      sinaisDeFormulario.forEach((s) => document.removeEventListener(s, registrarInteracaoFormulario, true));
    };
  }, []);

  useEffect(() => {
    if (!caminho || ultimoRegistrado.current === caminho) return;
    ultimoRegistrado.current = caminho;
    registrarVisita(lojaId, caminho);
  }, [caminho, lojaId]);

  useEffect(() => {
    if (!caminho) return;
    return medirLeitura(caminho);
  }, [caminho]);

  return null;
}

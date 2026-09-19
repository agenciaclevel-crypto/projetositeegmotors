"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { registrarVisita } from "@/lib/visitas";

/** Conta o acesso a cada página aberta, inclusive nas trocas de página que o
 * Next faz sem recarregar o site. Não desenha nada na tela. */
export default function RegistroVisita({ lojaId }: { lojaId: string }) {
  const caminho = usePathname();
  const ultimoRegistrado = useRef<string | null>(null);

  useEffect(() => {
    if (!caminho || ultimoRegistrado.current === caminho) return;
    ultimoRegistrado.current = caminho;
    registrarVisita(lojaId, caminho);
  }, [caminho, lojaId]);

  return null;
}

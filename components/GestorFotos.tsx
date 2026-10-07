"use client";

import { Camera, ImagePlus, Trash2, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { kb, type ErroFoto } from "@/lib/imagem";

/**
 * Um item da galeria pode ser uma foto já salva no banco ou uma recém
 * escolhida no celular, ainda não enviada. A ordem da lista é a ordem que
 * aparece no site, e a PRIMEIRA é sempre a capa — é mais simples de
 * entender do que um botão de capa separado da ordenação.
 */
export type ItemFoto = {
  chave: string;
  id?: string;          // id da linha em veiculo_fotos (só nas já salvas)
  url: string;          // url pública ou prévia local
  urlThumb?: string | null;
  nova: boolean;
  blobGrande?: Blob;
  blobThumb?: Blob;
  ext?: string;
  tipo?: string;
  peso?: number;
};

export default function GestorFotos({
  itens, setItens, aoEscolher, processando, falhas, formato, ganho,
}: {
  itens: ItemFoto[];
  setItens: (f: (atual: ItemFoto[]) => ItemFoto[]) => void;
  aoEscolher: (lista: FileList | null) => void;
  processando: string;
  falhas: ErroFoto[];
  formato: string;
  ganho: number;
}) {
  const mover = (de: number, para: number) => {
    if (para < 0 || para >= itens.length) return;
    setItens((a) => {
      const novo = [...a];
      const [x] = novo.splice(de, 1);
      novo.splice(para, 0, x);
      return novo;
    });
  };

  const virarCapa = (i: number) => mover(i, 0);

  const remover = (i: number) =>
    setItens((a) => {
      const alvo = a[i];
      if (alvo.nova) URL.revokeObjectURL(alvo.url);
      return a.filter((_, j) => j !== i);
    });

  const pesoNovas = itens.reduce((s, f) => s + (f.blobGrande?.size ?? 0) + (f.blobThumb?.size ?? 0), 0);
  const novas = itens.filter((f) => f.nova).length;

  return (
    <div className="sm:col-span-2">
      <span className="mb-1.5 block font-mono text-[9px] uppercase tracking-[0.14em] text-inkFaint">
        Fotos {itens.length > 0 && `· ${itens.length} no total`}
        {novas > 0 && ` · ${novas} novas · ${kb(pesoNovas)}`}
      </span>

      {itens.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {itens.map((f, i) => (
            <div key={f.chave}
              className={`relative overflow-hidden rounded-[3px] border ${i === 0 ? "border-ouro" : "border-linha"}`}>
              <img src={f.urlThumb ?? f.url} alt="" className="block aspect-[3/2] w-full object-cover" />

              {/* posição e capa */}
              <span className="absolute left-1.5 top-1.5 rounded-sm bg-bg0/85 px-1.5 py-0.5 font-mono text-[9px] text-inkDim">
                {i + 1}
              </span>
              {i === 0 && (
                <span className="absolute left-7 top-1.5 rounded-sm bg-ouro px-1.5 py-0.5 font-mono text-[8px] tracking-[0.1em] text-bg0">
                  CAPA
                </span>
              )}
              {f.nova && (
                <span className="absolute right-1.5 top-1.5 rounded-sm bg-verde/90 px-1.5 py-0.5 font-mono text-[8px] tracking-[0.1em] text-white">
                  NOVA
                </span>
              )}

              {/* controles */}
              <div className="flex items-stretch justify-between border-t border-linha bg-bg0/90">
                <button type="button" onClick={() => mover(i, i - 1)} disabled={i === 0}
                  aria-label="Mover para trás" className="flex-1 py-2 disabled:opacity-25">
                  <ChevronLeft size={15} className="mx-auto text-inkDim" />
                </button>
                <button type="button" onClick={() => virarCapa(i)} disabled={i === 0}
                  aria-label="Tornar capa" className="flex-1 border-x border-linha py-2 disabled:opacity-25">
                  <Star size={14} className="mx-auto text-ouro" />
                </button>
                <button type="button" onClick={() => mover(i, i + 1)} disabled={i === itens.length - 1}
                  aria-label="Mover para frente" className="flex-1 py-2 disabled:opacity-25">
                  <ChevronRight size={15} className="mx-auto text-inkDim" />
                </button>
                <button type="button" onClick={() => remover(i)}
                  aria-label="Remover foto" className="flex-1 border-l border-linha py-2">
                  <Trash2 size={14} className="mx-auto text-[#C25454]" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[3px] border border-dashed border-linha bg-bg0 py-7">
          <Camera size={20} className="text-ouro" />
          <span className="text-[13px] text-inkDim">Tirar foto agora</span>
          <input type="file" accept="image/*" capture="environment" multiple className="hidden"
            onChange={(e) => { aoEscolher(e.target.files); e.target.value = ""; }} />
        </label>

        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[3px] border border-dashed border-linha bg-bg0 py-7">
          <ImagePlus size={20} className="text-inkFaint" />
          <span className="text-[13px] text-inkDim">Escolher da galeria</span>
          <input type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => { aoEscolher(e.target.files); e.target.value = ""; }} />
        </label>
      </div>

      {falhas.length > 0 && (
        <ul className="mt-2 space-y-1">
          {falhas.map((f) => (
            <li key={f.arquivo} className="text-[11px] text-[#C25454]">{f.arquivo}: {f.motivo}</li>
          ))}
        </ul>
      )}

      {processando ? (
        <p className="mt-2 text-[12px] text-ouro">{processando}</p>
      ) : novas > 0 ? (
        <p className="mt-2 text-[11px] text-verde">
          Comprimidas em {formato} no próprio aparelho{ganho > 0 && ` — ${ganho}% mais leves`}.
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-inkFaint">
          A primeira foto é a capa. Use as setas para ordenar e a estrela para promover a capa.
        </p>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { supabase, type Banner } from "@/lib/supabase";
import { prepararFoto } from "@/lib/imagem";

const campo = "w-full rounded-[3px] border border-linha bg-bg1 px-3 py-2.5 text-sm text-ink";
const rotulo = "mb-1.5 block font-mono text-[9px] uppercase tracking-[0.14em] text-inkFaint";

type BannerEditavel = Partial<Banner> & { ativo?: boolean; ordem?: number };

export default function FormBanner({
  banner, lojaId, fechar, salvo,
}: { banner: BannerEditavel; lojaId: string; fechar: () => void; salvo: () => void }) {
  const [b, setB] = useState<any>({
    titulo: "", legenda: "", link: "", ativo: true, ordem: 0, ...banner,
  });
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(banner.imagem_url ?? null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  function escolherImagem(lista: FileList | null) {
    const f = lista?.[0];
    if (!f) return;
    setArquivo(f);
    setPrevia(URL.createObjectURL(f));
  }

  const valido = b.titulo?.trim() && (b.imagem_url || arquivo);

  async function salvar() {
    if (!valido) return;
    setSalvando(true); setErro("");

    let imagem_url = b.imagem_url ?? null;

    if (arquivo) {
      const pronta = await prepararFoto(arquivo);
      const nome = `banners/${Date.now()}.webp`;
      const { error: erroUpload } = await supabase.storage
        .from("marca")
        .upload(nome, pronta.grande, { upsert: true, contentType: "image/webp", cacheControl: "31536000" });

      if (erroUpload) { setErro(`Falha ao enviar a imagem: ${erroUpload.message}`); setSalvando(false); return; }
      imagem_url = supabase.storage.from("marca").getPublicUrl(nome).data.publicUrl;
    }

    const dados = {
      loja_id: lojaId,
      titulo: b.titulo, legenda: b.legenda || null, imagem_url,
      link: b.link || null, ativo: b.ativo, ordem: Number(b.ordem) || 0,
    };

    const { error } = b.id
      ? await supabase.from("banners").update(dados).eq("id", b.id)
      : await supabase.from("banners").insert(dados);

    if (error) { setErro(error.message); setSalvando(false); return; }

    setSalvando(false);
    salvo();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center" onClick={fechar}>
      <div className="max-h-full w-full max-w-[560px] overflow-y-auto rounded border border-linha bg-bg1"
        onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b border-linha bg-bg1 px-6 py-4">
          <h2 className="font-display text-lg uppercase tracking-[0.03em]">
            {b.id ? "Editar banner" : "Novo banner"}
          </h2>
          <button onClick={fechar} aria-label="Fechar"><X size={20} className="text-inkDim" /></button>
        </div>

        <div className="grid gap-4 p-6">
          <div>
            <span className={rotulo}>Imagem do banner (paisagem, larga)</span>
            {previa && (
              <div className="mb-3 overflow-hidden rounded-[3px] border border-linha">
                <img src={previa} alt="" className="block aspect-[16/7] w-full object-cover" />
              </div>
            )}
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[3px] border border-dashed border-linha bg-bg0 py-6">
              <span className="text-[13px] text-inkDim">{previa ? "Trocar imagem" : "Escolher imagem"}</span>
              <input type="file" accept="image/*" className="hidden"
                onChange={(e) => { escolherImagem(e.target.files); e.target.value = ""; }} />
            </label>
          </div>

          <label><span className={rotulo}>Título</span>
            <input value={b.titulo ?? ""} onChange={(e) => setB({ ...b, titulo: e.target.value })}
              className={campo} placeholder="Jeep Compass Blackhawk 2026" /></label>

          <label><span className={rotulo}>Legenda (opcional)</span>
            <input value={b.legenda ?? ""} onChange={(e) => setB({ ...b, legenda: e.target.value })}
              className={campo} placeholder="Condições especiais este mês" /></label>

          <label><span className={rotulo}>Mensagem do WhatsApp ao clicar (opcional)</span>
            <input value={b.link ?? ""} onChange={(e) => setB({ ...b, link: e.target.value })}
              className={campo} placeholder={`Olá! Vi a campanha "${b.titulo || "..."}" no site.`} /></label>

          <div className="grid grid-cols-2 gap-4">
            <label><span className={rotulo}>Ordem de exibição</span>
              <input type="number" value={b.ordem} onChange={(e) => setB({ ...b, ordem: e.target.value })}
                className={campo} /></label>
            <label className="flex items-end pb-2.5">
              <span className="flex cursor-pointer items-center gap-2 text-sm text-inkDim">
                <input type="checkbox" checked={b.ativo} className="accent-ouro"
                  onChange={(e) => setB({ ...b, ativo: e.target.checked })} /> Ativo no site
              </span>
            </label>
          </div>

          {erro && <p className="text-xs text-[#C25454]">{erro}</p>}
        </div>

        <div className="flex justify-end gap-3 px-6 pb-6">
          <button onClick={fechar} className="rounded-[3px] border border-linha px-5 py-3 text-sm font-semibold">Cancelar</button>
          <button onClick={salvar} disabled={!valido || salvando}
            className="rounded-[3px] bg-ouro px-5 py-3 text-sm font-semibold text-bg0 disabled:opacity-45">
            {salvando ? "Salvando..." : b.id ? "Salvar alterações" : "Criar banner"}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { X, Upload, Camera, ImagePlus, Trash2 } from "lucide-react";
import { supabase, type Veiculo } from "@/lib/supabase";
import { prepararFotos, kb, type FotoPronta, type ErroFoto } from "@/lib/imagem";

const campo = "w-full rounded-[3px] border border-linha bg-bg1 px-3 py-2.5 text-sm text-ink";
const rotulo = "mb-1.5 block font-mono text-[9px] uppercase tracking-[0.14em] text-inkFaint";

const gerarSlug = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function FormVeiculo({
  veiculo, lojaId, fechar, salvo,
}: { veiculo: Partial<Veiculo>; lojaId: string; fechar: () => void; salvo: () => void }) {
  const [v, setV] = useState<any>({
    marca: "", modelo: "", versao: "", ano_fabricacao: 2024, ano_modelo: 2025,
    km: 0, cambio: "Automático", combustivel: "Flex", cor: "", carroceria: "SUV",
    portas: 4, condicao: "seminovo", preco: 0, preco_de: null, opcionais: [],
    observacoes: "", publicado: true, destaque: false, ...veiculo,
  });
  const [fotos, setFotos] = useState<FotoPronta[]>([]);
  const [previas, setPrevias] = useState<string[]>([]);
  const [falhas, setFalhas] = useState<ErroFoto[]>([]);
  const [processando, setProcessando] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [progresso, setProgresso] = useState("");
  const [erro, setErro] = useState("");

  async function escolherFotos(lista: FileList | null) {
    const arquivos = Array.from(lista ?? []);
    if (!arquivos.length) return;
    setErro("");
    setProcessando(`Preparando 0 de ${arquivos.length}...`);
    const { prontas, erros } = await prepararFotos(arquivos, (f, t) =>
      setProcessando(`Preparando ${f} de ${t}...`));
    setFotos((atual) => [...atual, ...prontas]);
    setPrevias((atual) => [...atual, ...prontas.map((f) => URL.createObjectURL(f.thumb))]);
    setFalhas(erros);
    setProcessando("");
  }

  function removerFoto(i: number) {
    URL.revokeObjectURL(previas[i]);
    setFotos((f) => f.filter((_, j) => j !== i));
    setPrevias((p) => p.filter((_, j) => j !== i));
  }

  const pesoTotal = fotos.reduce((s, f) => s + f.grande.size + f.thumb.size, 0);
  const ganhoMedio = fotos.length
    ? Math.round(fotos.reduce((s, f) => s + f.ganho, 0) / fotos.length) : 0;
  const formato = fotos[0]?.ext === "webp" ? "WebP" : "JPEG";

  const set = (k: string, num = false) => (e: any) =>
    setV({ ...v, [k]: num ? Number(e.target.value) : e.target.value });

  const valido = v.marca?.trim() && v.modelo?.trim() && v.preco > 0;

  async function salvar() {
    if (!valido) return;
    setSalvando(true); setErro("");

    const slug = v.slug || gerarSlug(`${v.marca} ${v.modelo} ${v.versao ?? ""} ${v.ano_modelo}`);
    const dados = {
      loja_id: lojaId, slug,
      marca: v.marca, modelo: v.modelo, versao: v.versao,
      ano_fabricacao: v.ano_fabricacao, ano_modelo: v.ano_modelo,
      km: v.km, cambio: v.cambio, combustivel: v.combustivel, motor: v.motor,
      potencia_cv: v.potencia_cv, cor: v.cor, carroceria: v.carroceria, portas: v.portas,
      condicao: v.condicao, preco: v.preco, preco_de: v.preco_de,
      opcionais: v.opcionais, observacoes: v.observacoes,
      publicado: v.publicado, destaque: v.destaque,
    };

    const { data, error } = v.id
      ? await supabase.from("veiculos").update(dados).eq("id", v.id).select("id").single()
      : await supabase.from("veiculos").insert(dados).select("id").single();

    if (error) { setErro(error.message); setSalvando(false); return; }

    // sobe grande + thumb já em WebP
    const marca = Date.now();
    for (let i = 0; i < fotos.length; i++) {
      const f = fotos[i];
      setProgresso(`Enviando foto ${i + 1} de ${fotos.length}...`);
      const nome = `${slug}/${marca}-${String(i).padStart(2, "0")}`;
      const arqGrande = `${nome}.${f.ext}`;
      const arqThumb = `${nome}-thumb.${f.ext}`;

      const [g, t] = await Promise.all([
        supabase.storage.from("veiculos").upload(arqGrande, f.grande,
          { upsert: true, contentType: f.tipo, cacheControl: "31536000" }),
        supabase.storage.from("veiculos").upload(arqThumb, f.thumb,
          { upsert: true, contentType: f.tipo, cacheControl: "31536000" }),
      ]);

      if (g.error) {
        const m = /mime type/i.test(g.error.message)
          ? `o bucket "veiculos" está recusando ${f.tipo}. No Supabase, abra Storage → veiculos → Settings e deixe os tipos permitidos em branco (ou inclua image/webp e image/jpeg).`
          : g.error.message;
        setErro(`Falha ao enviar a foto ${i + 1}: ${m}`);
        setSalvando(false);
        return;
      }

      const url = supabase.storage.from("veiculos").getPublicUrl(arqGrande).data.publicUrl;
      const thumb = t.error ? null
        : supabase.storage.from("veiculos").getPublicUrl(arqThumb).data.publicUrl;

      await supabase.from("veiculo_fotos").insert({
        veiculo_id: data!.id, url, url_thumb: thumb, ordem: i, capa: i === 0 && !v.id,
      });
    }

    setProgresso("");
    setSalvando(false);
    salvo();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center" onClick={fechar}>
      <div className="max-h-full w-full max-w-[640px] overflow-y-auto rounded border border-linha bg-bg1"
        onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b border-linha bg-bg1 px-6 py-4">
          <h2 className="font-display text-lg uppercase tracking-[0.03em]">
            {v.id ? "Editar veículo" : "Cadastrar veículo"}
          </h2>
          <button onClick={fechar} aria-label="Fechar"><X size={20} className="text-inkDim" /></button>
        </div>

        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <label><span className={rotulo}>Marca</span><input value={v.marca} onChange={set("marca")} className={campo} placeholder="Jeep" /></label>
          <label><span className={rotulo}>Modelo</span><input value={v.modelo} onChange={set("modelo")} className={campo} placeholder="Compass" /></label>
          <label className="sm:col-span-2"><span className={rotulo}>Versão</span>
            <input value={v.versao ?? ""} onChange={set("versao")} className={campo} placeholder="Blackhawk Hurricane 2.0 T270 4x4 Aut." /></label>
          <label><span className={rotulo}>Condição</span>
            <select value={v.condicao} onChange={set("condicao")} className={campo}>
              <option value="seminovo">Seminovo</option><option value="novo">Novo (0 km)</option>
            </select></label>
          <label><span className={rotulo}>Carroceria</span>
            <select value={v.carroceria} onChange={set("carroceria")} className={campo}>
              <option>SUV</option><option>Sedã</option><option>Hatch</option><option>Picape</option>
            </select></label>
          <label><span className={rotulo}>Ano de fabricação</span>
            <input type="number" value={v.ano_fabricacao} onChange={set("ano_fabricacao", true)} className={campo} /></label>
          <label><span className={rotulo}>Ano do modelo</span>
            <input type="number" value={v.ano_modelo} onChange={set("ano_modelo", true)} className={campo} /></label>
          <label><span className={rotulo}>Quilometragem</span>
            <input type="number" value={v.km} onChange={set("km", true)} className={campo} /></label>
          <label><span className={rotulo}>Câmbio</span>
            <select value={v.cambio} onChange={set("cambio")} className={campo}>
              <option>Automático</option><option>CVT</option><option>Manual</option>
            </select></label>
          <label><span className={rotulo}>Preço de (opcional)</span>
            <input type="number" value={v.preco_de ?? ""} className={campo}
              onChange={(e) => setV({ ...v, preco_de: e.target.value ? Number(e.target.value) : null })} /></label>
          <label><span className={rotulo}>Preço por (R$)</span>
            <input type="number" value={v.preco} onChange={set("preco", true)} className={campo} /></label>
          <label><span className={rotulo}>Combustível</span>
            <select value={v.combustivel} onChange={set("combustivel")} className={campo}>
              <option>Flex</option><option>Gasolina</option><option>Diesel</option><option>Híbrido</option><option>Elétrico</option>
            </select></label>
          <label><span className={rotulo}>Cor</span><input value={v.cor ?? ""} onChange={set("cor")} className={campo} /></label>

          <label className="sm:col-span-2"><span className={rotulo}>Itens de série (um por linha)</span>
            <textarea rows={4} className={`${campo} resize-y`} value={(v.opcionais ?? []).join("\n")}
              onChange={(e) => setV({ ...v, opcionais: e.target.value.split("\n").filter(Boolean) })} /></label>

          <label className="sm:col-span-2"><span className={rotulo}>Observações</span>
            <textarea rows={2} value={v.observacoes ?? ""} onChange={set("observacoes")} className={`${campo} resize-y`} /></label>

          <div className="sm:col-span-2">
            <span className={rotulo}>
              Fotos {fotos.length > 0 && `· ${fotos.length} prontas · ${kb(pesoTotal)}`}
            </span>

            {previas.length > 0 && (
              <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {previas.map((src, i) => (
                  <div key={src} className="relative overflow-hidden rounded-[3px] border border-linha">
                    <img src={src} alt="" className="block aspect-[3/2] w-full object-cover" />
                    {i === 0 && (
                      <span className="absolute left-1 top-1 rounded-sm bg-ouro px-1.5 py-0.5 font-mono text-[8px] tracking-[0.1em] text-bg0">
                        CAPA
                      </span>
                    )}
                    <button type="button" onClick={() => removerFoto(i)} aria-label="Remover foto"
                      className="absolute right-1 top-1 rounded-sm bg-bg0/80 p-1">
                      <Trash2 size={12} className="text-inkDim" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[3px] border border-dashed border-linha bg-bg0 py-7">
                <Camera size={20} className="text-ouro" />
                <span className="text-[13px] text-inkDim">Tirar foto agora</span>
                <input type="file" accept="image/*" capture="environment" multiple className="hidden"
                  onChange={(e) => { escolherFotos(e.target.files); e.target.value = ""; }} />
              </label>

              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[3px] border border-dashed border-linha bg-bg0 py-7">
                <ImagePlus size={20} className="text-inkFaint" />
                <span className="text-[13px] text-inkDim">Escolher da galeria</span>
                <input type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => { escolherFotos(e.target.files); e.target.value = ""; }} />
              </label>
            </div>

            {falhas.length > 0 && (
              <ul className="mt-2 space-y-1">
                {falhas.map((f) => (
                  <li key={f.arquivo} className="text-[11px] text-[#C25454]">
                    {f.arquivo}: {f.motivo}
                  </li>
                ))}
              </ul>
            )}

            {processando ? (
              <p className="mt-2 text-[12px] text-ouro">{processando}</p>
            ) : fotos.length > 0 ? (
              <p className="mt-2 text-[11px] text-verde">
                Comprimidas em {formato} no próprio aparelho
                {ganhoMedio > 0 && ` — ${ganhoMedio}% mais leves que os originais`}.
              </p>
            ) : (
              <p className="mt-2 text-[11px] text-inkFaint">
                A primeira foto vira a capa. Fotografe na horizontal, com o carro centralizado.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-5 sm:col-span-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-inkDim">
              <input type="checkbox" checked={v.publicado} className="accent-ouro"
                onChange={(e) => setV({ ...v, publicado: e.target.checked })} /> Publicar no site
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-inkDim">
              <input type="checkbox" checked={v.destaque} className="accent-ouro"
                onChange={(e) => setV({ ...v, destaque: e.target.checked })} /> Marcar como destaque
            </label>
          </div>

          {erro && <p className="text-xs text-[#C25454] sm:col-span-2">{erro}</p>}
        </div>

        <div className="flex justify-end gap-3 px-6 pb-6">
          <button onClick={fechar} className="rounded-[3px] border border-linha px-5 py-3 text-sm font-semibold">Cancelar</button>
          <button onClick={salvar} disabled={!valido || salvando}
            className="rounded-[3px] bg-ouro px-5 py-3 text-sm font-semibold text-bg0 disabled:opacity-45">
            {salvando ? (progresso || "Salvando...") : v.id ? "Salvar alterações" : "Cadastrar veículo"}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { supabase, type Veiculo } from "@/lib/supabase";
import { prepararFotos, type ErroFoto } from "@/lib/imagem";
import GestorFotos, { type ItemFoto } from "./GestorFotos";

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
  // começa com as fotos que já estão no banco, na ordem salva
  const [itens, setItens] = useState<ItemFoto[]>(() =>
    [...((veiculo as any)?.veiculo_fotos ?? [])]
      .sort((a: any, b: any) => a.ordem - b.ordem)
      .map((f: any) => ({
        chave: f.id ?? f.url,
        id: f.id,
        url: f.url,
        urlThumb: f.url_thumb,
        nova: false,
      })));

  const [removidas, setRemovidas] = useState<{ id: string; url: string; urlThumb?: string | null }[]>([]);
  const [falhas, setFalhas] = useState<ErroFoto[]>([]);
  const [processando, setProcessando] = useState("");
  const [ultimoFormato, setUltimoFormato] = useState("JPEG");
  const [ultimoGanho, setUltimoGanho] = useState(0);
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

    setItens((atual) => [
      ...atual,
      ...prontas.map((f, i) => ({
        chave: `nova-${Date.now()}-${i}`,
        url: URL.createObjectURL(f.thumb),
        urlThumb: null,
        nova: true,
        blobGrande: f.grande,
        blobThumb: f.thumb,
        ext: f.ext,
        tipo: f.tipo,
      })),
    ]);

    if (prontas.length) {
      setUltimoFormato(prontas[0].ext === "webp" ? "WebP" : "JPEG");
      setUltimoGanho(Math.round(prontas.reduce((a, f) => a + f.ganho, 0) / prontas.length));
    }
    setFalhas(erros);
    setProcessando("");
  }

  // guarda as removidas que já existiam, para apagar do banco e do Storage
  function atualizarItens(f: (atual: ItemFoto[]) => ItemFoto[]) {
    setItens((atual) => {
      const novo = f(atual);
      const sumiram = atual.filter(
        (x) => !x.nova && x.id && !novo.some((y) => y.chave === x.chave));
      if (sumiram.length) {
        setRemovidas((r) => [...r, ...sumiram.map((x) => ({
          id: x.id!, url: x.url, urlThumb: x.urlThumb,
        }))]);
      }
      return novo;
    });
  }

  // "https://projeto.supabase.co/storage/v1/object/public/veiculos/pasta/arq.jpg"
  // vira "pasta/arq.jpg"
  const caminhoNoStorage = (url?: string | null) => {
    if (!url) return null;
    const partes = url.split("/object/public/veiculos/");
    return partes[1] ? decodeURIComponent(partes[1]) : null;
  };

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
    const veiculoId = data!.id;

    // 1. apaga as que o usuário removeu — linha e arquivos
    if (removidas.length) {
      setProgresso("Removendo fotos...");
      await supabase.from("veiculo_fotos").delete().in("id", removidas.map((r) => r.id));
      const caminhos = removidas
        .flatMap((r) => [caminhoNoStorage(r.url), caminhoNoStorage(r.urlThumb)])
        .filter(Boolean) as string[];
      if (caminhos.length) await supabase.storage.from("veiculos").remove(caminhos);
    }

    // 2. sobe as novas, na posição em que estão na lista
    const marca = Date.now();
    const urls = new Map<string, { url: string; thumb: string | null }>();
    const novas = itens.filter((f) => f.nova);
    let n = 0;

    for (const f of novas) {
      n++;
      setProgresso(`Enviando foto ${n} de ${novas.length}...`);
      const base = `${slug}/${marca}-${String(itens.indexOf(f)).padStart(2, "0")}`;
      const arqGrande = `${base}.${f.ext}`;
      const arqThumb = `${base}-thumb.${f.ext}`;

      const [g, t] = await Promise.all([
        supabase.storage.from("veiculos").upload(arqGrande, f.blobGrande!,
          { upsert: true, contentType: f.tipo, cacheControl: "31536000" }),
        supabase.storage.from("veiculos").upload(arqThumb, f.blobThumb!,
          { upsert: true, contentType: f.tipo, cacheControl: "31536000" }),
      ]);

      if (g.error) {
        const m = /mime type/i.test(g.error.message)
          ? `o bucket "veiculos" está recusando ${f.tipo}. Rode o script corrigir-bucket.sql no Supabase.`
          : /row-level security/i.test(g.error.message)
          ? 'faltam as permissões de Storage. Rode o script corrigir-permissoes-storage.sql no Supabase.'
          : g.error.message;
        setErro(`Falha ao enviar a foto ${n}: ${m}`);
        setSalvando(false); setProgresso("");
        return;
      }

      urls.set(f.chave, {
        url: supabase.storage.from("veiculos").getPublicUrl(arqGrande).data.publicUrl,
        thumb: t.error ? null
          : supabase.storage.from("veiculos").getPublicUrl(arqThumb).data.publicUrl,
      });
    }

    // 3. grava a ordem final. A primeira da lista é sempre a capa.
    setProgresso("Salvando a ordem...");
    for (let i = 0; i < itens.length; i++) {
      const f = itens[i];
      if (f.nova) {
        const u = urls.get(f.chave)!;
        await supabase.from("veiculo_fotos").insert({
          veiculo_id: veiculoId, url: u.url, url_thumb: u.thumb,
          ordem: i, capa: i === 0,
        });
      } else {
        await supabase.from("veiculo_fotos")
          .update({ ordem: i, capa: i === 0 }).eq("id", f.id!);
      }
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

          <GestorFotos
            itens={itens}
            setItens={atualizarItens}
            aoEscolher={escolherFotos}
            processando={processando}
            falhas={falhas}
            formato={ultimoFormato}
            ganho={ultimoGanho}
          />

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

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

/** Extensão pelo tipo real do arquivo: a capa pode ser WebP e a miniatura
 * JPEG (ou o contrário), conforme o que o navegador conseguiu gerar. */
const extensao = (tipo: string) =>
  tipo === "image/webp" ? "webp" : tipo === "image/png" ? "png" : "jpg";

/** Para onde mandar quem esbarra numa recusa do Storage: é o script do
 * repositório que define pasta por loja e formatos aceitos. */
const AJUDA_STORAGE = "Rode o migracao-seguranca.sql no Supabase (SQL Editor) e tente de novo.";

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

  // O que ainda falta para poder salvar. Botão travado sem explicação é o
  // tipo de coisa que faz a pessoa achar que o sistema quebrou.
  const faltando = [
    !v.marca?.trim() ? "marca" : null,
    !v.modelo?.trim() ? "modelo" : null,
    !(Number(v.preco) > 0) ? "preço" : null,
  ].filter(Boolean) as string[];
  const valido = faltando.length === 0;

  /** O endereço do carro no site (slug) é único por loja. Se a loja tem dois
   * carros iguais no pátio — mesmo modelo, versão e ano — o segundo precisa de
   * um endereço próprio, senão o banco recusa o cadastro. */
  async function slugLivre(base: string) {
    const { data } = await supabase.from("veiculos")
      .select("slug").eq("loja_id", lojaId).like("slug", `${base}%`);
    const usados = new Set((data ?? []).map((r) => r.slug as string));
    if (!usados.has(base)) return base;
    for (let i = 2; i <= 50; i++) {
      if (!usados.has(`${base}-${i}`)) return `${base}-${i}`;
    }
    return `${base}-${Date.now().toString(36)}`;
  }

  async function salvar() {
    if (!valido) {
      setErro(`Falta preencher: ${faltando.join(", ")}.`);
      return;
    }
    setSalvando(true); setErro("");

    const base = v.slug || gerarSlug(`${v.marca} ${v.modelo} ${v.versao ?? ""} ${v.ano_modelo}`);
    let slug = v.id ? base : await slugLivre(base);

    const dados = (s: string) => ({
      loja_id: lojaId, slug: s,
      marca: v.marca, modelo: v.modelo, versao: v.versao,
      ano_fabricacao: v.ano_fabricacao, ano_modelo: v.ano_modelo,
      km: v.km, cambio: v.cambio, combustivel: v.combustivel, motor: v.motor,
      potencia_cv: v.potencia_cv, cor: v.cor, carroceria: v.carroceria, portas: v.portas,
      condicao: v.condicao, preco: v.preco, preco_de: v.preco_de,
      opcionais: v.opcionais, observacoes: v.observacoes,
      publicado: v.publicado, destaque: v.destaque,
    });

    let resposta = v.id
      ? await supabase.from("veiculos").update(dados(slug)).eq("id", v.id).select("id").single()
      : await supabase.from("veiculos").insert(dados(slug)).select("id").single();

    // 23505 = endereço repetido. Só acontece se o slug foi ocupado entre a
    // checagem e o cadastro; tenta de novo com um sufixo único.
    if (resposta.error && !v.id && resposta.error.code === "23505") {
      slug = `${base}-${Date.now().toString(36)}`;
      resposta = await supabase.from("veiculos").insert(dados(slug)).select("id").single();
    }

    if (resposta.error) {
      setErro(resposta.error.code === "23505"
        ? "Já existe um veículo com esse mesmo endereço no site. Mude a versão ou o ano e tente de novo."
        : resposta.error.message);
      setSalvando(false);
      return;
    }

    // Guarda o id assim que o veículo é criado: se o envio das fotos falhar no
    // meio, um novo clique em salvar atualiza este carro em vez de cadastrar
    // um segundo igual.
    const veiculoId = resposta.data!.id as string;
    if (!v.id) setV((atual: any) => ({ ...atual, id: veiculoId, slug }));

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
      // A pasta da loja vem primeiro: é por ela que o Storage decide quem grava
      // (migracao-seguranca.sql). Sem ela, o envio é recusado.
      const base = `${lojaId}/${slug}/${marca}-${String(itens.indexOf(f)).padStart(2, "0")}`;
      const tipoGrande = f.blobGrande!.type || f.tipo || "image/jpeg";
      const tipoThumb = f.blobThumb!.type || tipoGrande;
      const arqGrande = `${base}.${extensao(tipoGrande)}`;
      const arqThumb = `${base}-thumb.${extensao(tipoThumb)}`;

      const [g, t] = await Promise.all([
        supabase.storage.from("veiculos").upload(arqGrande, f.blobGrande!,
          { upsert: true, contentType: tipoGrande, cacheControl: "31536000" }),
        supabase.storage.from("veiculos").upload(arqThumb, f.blobThumb!,
          { upsert: true, contentType: tipoThumb, cacheControl: "31536000" }),
      ]);

      if (g.error) {
        const m = /mime type/i.test(g.error.message)
          ? `o Storage está recusando fotos em ${tipoGrande}. ${AJUDA_STORAGE}`
          : /row-level security/i.test(g.error.message)
          ? `o Storage recusou a pasta da loja. ${AJUDA_STORAGE}`
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
          <label><span className={rotulo}>Motor</span>
            <input value={v.motor ?? ""} onChange={set("motor")} className={campo} placeholder="2.0 Turbo" /></label>
          <label><span className={rotulo}>Potência (cv)</span>
            <input type="number" inputMode="numeric" min={0} max={2000}
              value={v.potencia_cv ?? ""} className={campo} placeholder="272"
              onChange={(e) => setV({ ...v, potencia_cv: e.target.value ? Number(e.target.value) : null })} /></label>

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

        {!valido && !erro && (
          <p className="px-6 pb-3 text-right text-[12px] text-inkFaint">
            Falta preencher: {faltando.join(", ")}.
          </p>
        )}

        <div className="flex justify-end gap-3 px-6 pb-6">
          <button onClick={fechar} className="rounded-[3px] border border-linha px-5 py-3 text-sm font-semibold">Cancelar</button>
          <button onClick={salvar} disabled={salvando}
            className="rounded-[3px] bg-ouro px-5 py-3 text-sm font-semibold text-bg0 disabled:opacity-45">
            {salvando ? (progresso || "Salvando...") : v.id ? "Salvar alterações" : "Cadastrar veículo"}
          </button>
        </div>
      </div>
    </div>
  );
}

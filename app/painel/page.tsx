"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Eye, EyeOff, Users, Package, LogOut, Image as ImageIcon, Store, Search, Car as CarIcon, BarChart3, ArrowUpRight, ArrowDownRight, ExternalLink } from "lucide-react";
import { supabase, brl, formatKm, type Veiculo, type Banner, type Loja } from "@/lib/supabase";
import { GA_RELATORIO } from "@/lib/rastreio";
import FormVeiculo from "@/components/FormVeiculo";
import FormBanner from "@/components/FormBanner";

type Lead = {
  id: string; nome: string; telefone: string; email: string | null; origem: string;
  tipo: string; status: string; mensagem: string | null; veiculo_id: string | null;
  veiculo_troca: Record<string, unknown> | null; criado_em: string;
};

const ROTULOS_STATUS: Record<string, string> = {
  novo: "Novo", em_atendimento: "Em atendimento", ganho: "Ganho", perdido: "Perdido",
};

const ROTULOS_ORIGEM: Record<string, string> = {
  site: "Site", agenciamento: "Agenciamento", financiamento: "Financiamento",
};

type Visita = {
  visitante: string; caminho: string; origem: string | null; criado_em: string;
};

/** Teto da consulta de visitas. Suficiente com folga para o volume de uma
 * loja; se um dia encostar nele, o painel esconde a comparação. */
const LIMITE_VISITAS = 20000;

/** Nomes bonitos para a lista de "de onde vem o acesso". O que não estiver
 * aqui aparece com o próprio endereço do site de origem. */
const ROTULOS_CANAL: Record<string, string> = {
  direto: "Acesso direto", instagram: "Instagram", facebook: "Facebook",
  whatsapp: "WhatsApp", google: "Google", busca: "Outros buscadores",
  portais: "Portais de anúncio", youtube: "YouTube", tiktok: "TikTok",
  linkedin: "LinkedIn",
};

/** Variação percentual contra o período anterior. null quando não há base de
 * comparação — melhor não mostrar nada do que mostrar "+100%" de dois acessos. */
function variacao(atual: number, anterior: number) {
  if (!anterior) return null;
  return Math.round(((atual - anterior) / anterior) * 100);
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

/** Mostra os detalhes guardados em veiculo_troca — que muda de cara conforme
 * a origem: carro pra dar na troca (vender/agenciamento) ou simulação de
 * financiamento (Simulador). */
function DetalhesExtras({ troca }: { troca: Record<string, unknown> | null }) {
  if (!troca) return null;

  if (troca.simulacao) {
    return (
      <p className="text-[13px] text-inkDim">
        <span className="text-inkFaint">Simulação:</span> entrada {brl(Number(troca.entrada) || 0)} ·{" "}
        {String(troca.prazo)}x de {brl(Number(troca.parcela_estimada) || 0)}
      </p>
    );
  }

  if (troca.marca || troca.modelo) {
    return (
      <p className="text-[13px] text-inkDim">
        <span className="text-inkFaint">Carro na troca:</span> {String(troca.marca ?? "")} {String(troca.modelo ?? "")}
        {troca.ano ? ` · ${troca.ano}` : ""}{troca.km ? ` · ${troca.km} km` : ""}
        {troca.valor_pretendido ? ` · pretende ${troca.valor_pretendido}` : ""}
      </p>
    );
  }

  if (troca.tem_troca) {
    return <p className="text-[13px] text-inkDim">Tem um carro para dar na troca.</p>;
  }

  return null;
}

export default function Painel() {
  const [aba, setAba] = useState<"estoque" | "leads" | "acessos" | "banners" | "loja">("estoque");
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loja, setLoja] = useState<Loja | null>(null);
  const [lojaId, setLojaId] = useState<string | null>(null);
  const [editando, setEditando] = useState<Partial<Veiculo> | null>(null);
  const [editandoBanner, setEditandoBanner] = useState<Partial<Banner> | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [buscaLead, setBuscaLead] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroOrigem, setFiltroOrigem] = useState("todas");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [periodo, setPeriodo] = useState(30);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [leadsDoPeriodo, setLeadsDoPeriodo] = useState(0);
  const [carregandoAcessos, setCarregandoAcessos] = useState(false);
  const [visitasCortadas, setVisitasCortadas] = useState(false);
  const router = useRouter();

  const origensDosLeads = useMemo(
    () => Array.from(new Set(leads.map((l) => l.origem))).sort(), [leads]);

  const leadsFiltrados = useMemo(() => leads.filter((l) =>
    `${l.nome} ${l.mensagem ?? ""}`.toLowerCase().includes(buscaLead.toLowerCase()) &&
    (filtroTipo === "todos" || l.tipo === filtroTipo) &&
    (filtroOrigem === "todas" || l.origem === filtroOrigem) &&
    (filtroStatus === "todos" || l.status === filtroStatus)
  ), [leads, buscaLead, filtroTipo, filtroOrigem, filtroStatus]);

  const carregar = useCallback(async () => {
    const { data: sessao } = await supabase.auth.getSession();
    if (!sessao.session) return router.push("/login");

    const { data: perfil } = await supabase.from("perfis")
      .select("loja_id").eq("id", sessao.session.user.id).single();
    if (!perfil?.loja_id) { setCarregando(false); return; }
    setLojaId(perfil.loja_id);

    const [v, l, b, lj] = await Promise.all([
      supabase.from("veiculos")
        .select("*, veiculo_fotos(id,url,url_thumb,ordem,capa)")
        .eq("loja_id", perfil.loja_id).order("criado_em", { ascending: false }),
      supabase.from("leads").select("*")
        .eq("loja_id", perfil.loja_id).order("criado_em", { ascending: false }).limit(50),
      supabase.from("banners").select("*")
        .eq("loja_id", perfil.loja_id).order("ordem", { ascending: true }),
      supabase.from("lojas").select("*").eq("id", perfil.loja_id).single(),
    ]);
    setVeiculos((v.data ?? []) as unknown as Veiculo[]);
    setLeads((l.data ?? []) as Lead[]);
    setBanners((b.data ?? []) as Banner[]);
    setLoja((lj.data ?? null) as Loja | null);
    setCarregando(false);
  }, [router]);

  useEffect(() => { carregar(); }, [carregar]);

  // Busca o dobro do período para poder comparar com o intervalo anterior.
  // Só roda quando a aba está aberta — não atrasa o resto do painel.
  const carregarAcessos = useCallback(async () => {
    if (!lojaId) return;
    setCarregandoAcessos(true);
    const dia = 86400000;
    const desde = new Date(Date.now() - periodo * 2 * dia).toISOString();
    const inicioAtual = new Date(Date.now() - periodo * dia).toISOString();

    const [v, l] = await Promise.all([
      supabase.from("visitas").select("visitante, caminho, origem, criado_em")
        .eq("loja_id", lojaId).gte("criado_em", desde)
        .order("criado_em", { ascending: false }).limit(LIMITE_VISITAS),
      supabase.from("leads").select("*", { count: "exact", head: true })
        .eq("loja_id", lojaId).gte("criado_em", inicioAtual),
    ]);

    // Se bateu no teto da consulta, o período anterior veio pela metade e a
    // comparação mentiria — melhor escondê-la do que mostrar alta falsa.
    const linhas = (v.data ?? []) as Visita[];
    setVisitasCortadas(linhas.length >= LIMITE_VISITAS);
    setVisitas(linhas);
    setLeadsDoPeriodo(l.count ?? 0);
    setCarregandoAcessos(false);
  }, [lojaId, periodo]);

  useEffect(() => { if (aba === "acessos") carregarAcessos(); }, [aba, carregarAcessos]);

  const acessos = useMemo(() => {
    const inicioAtual = Date.now() - periodo * 86400000;
    const atual: Visita[] = [];
    const anterior: Visita[] = [];
    visitas.forEach((v) => {
      (new Date(v.criado_em).getTime() >= inicioAtual ? atual : anterior).push(v);
    });

    const contaVisitantes = (lista: Visita[]) => new Set(lista.map((v) => v.visitante)).size;

    const porCarro = new Map<string, number>();
    atual.forEach((v) => {
      const achado = v.caminho.match(/^\/veiculo\/(.+)$/);
      if (achado) porCarro.set(achado[1], (porCarro.get(achado[1]) ?? 0) + 1);
    });
    const carros = Array.from(porCarro.entries())
      .map(([slug, total]) => ({ slug, total, veiculo: veiculos.find((x) => x.slug === slug) ?? null }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const porCanal = new Map<string, number>();
    atual.forEach((v) => {
      const canal = v.origem || "direto";
      porCanal.set(canal, (porCanal.get(canal) ?? 0) + 1);
    });
    const canais = Array.from(porCanal.entries())
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    const visitantes = contaVisitantes(atual);
    return {
      visitas: atual.length,
      visitasAntes: anterior.length,
      visitantes,
      visitantesAntes: contaVisitantes(anterior),
      conversao: visitantes ? (leadsDoPeriodo / visitantes) * 100 : 0,
      carros,
      canais,
    };
  }, [visitas, periodo, veiculos, leadsDoPeriodo]);

  async function alternarPublicacao(v: Veiculo) {
    await supabase.from("veiculos").update({ publicado: !(v as any).publicado }).eq("id", v.id);
    carregar();
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este veículo? A ação não pode ser desfeita.")) return;
    await supabase.from("veiculos").delete().eq("id", id);
    carregar();
  }

  async function alternarBannerAtivo(b: Banner) {
    await supabase.from("banners").update({ ativo: !b.ativo }).eq("id", b.id);
    carregar();
  }

  async function excluirBanner(id: string) {
    if (!confirm("Excluir este banner? A ação não pode ser desfeita.")) return;
    await supabase.from("banners").delete().eq("id", id);
    carregar();
  }

  async function enviarLogo(arquivo: File) {
    if (!lojaId) return;
    const { prepararFoto } = await import("@/lib/imagem");
    const pronta = await prepararFoto(arquivo);
    const nome = `logo/${lojaId}-${Date.now()}.webp`;
    const { error: erroUpload } = await supabase.storage
      .from("marca").upload(nome, pronta.grande, { upsert: true, contentType: "image/webp", cacheControl: "31536000" });
    if (erroUpload) { alert(`Falha ao enviar a logo: ${erroUpload.message}`); return; }
    const url = supabase.storage.from("marca").getPublicUrl(nome).data.publicUrl;
    const { error } = await supabase.from("lojas").update({ logo_claro_url: url }).eq("id", lojaId);
    if (error) { alert(`Falha ao salvar a logo: ${error.message}`); return; }
    carregar();
  }

  async function atualizarStatusLead(id: string, status: string) {
    setLeads((atual) => atual.map((l) => (l.id === id ? { ...l, status } : l)));
    const { error } = await supabase.from("leads").update({ status }).eq("id", id);
    if (error) alert(`Falha ao atualizar status: ${error.message}`);
  }

  async function sair() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (carregando) return <main className="p-10 text-inkDim">Carregando...</main>;

  return (
    <main className="mx-auto max-w-[1180px] px-5 py-8">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl uppercase tracking-[0.03em]">Painel da loja</h1>
        <button onClick={sair} className="inline-flex items-center gap-2 rounded-[3px] border border-linha px-4 py-2.5 text-sm text-inkDim">
          <LogOut size={15} /> Sair
        </button>
      </div>

      <div className="mb-7 flex flex-wrap gap-2">
        {([
          ["estoque", "Estoque", Package],
          ["leads", "Leads", Users],
          ["acessos", "Acessos", BarChart3],
          ["banners", "Banners", ImageIcon],
          ["loja", "Loja", Store],
        ] as const).map(([k, rot, Ic]) => (
          <button key={k} onClick={() => setAba(k)}
            className={`inline-flex items-center gap-2 rounded-[3px] px-4 py-2.5 text-sm font-medium ${
              aba === k ? "bg-ouro/15 text-ouro" : "text-inkDim"}`}>
            <Ic size={15} /> {rot}
          </button>
        ))}
      </div>

      {aba === "estoque" && (
        <>
          <button onClick={() => setEditando({})}
            className="mb-5 inline-flex items-center gap-2 rounded-[3px] bg-ouro px-5 py-3 text-sm font-semibold text-bg0">
            <Plus size={16} /> Cadastrar carro
          </button>

          <div className="grid gap-3">
            {veiculos.map((v) => (
              <div key={v.id} className="flex flex-col gap-4 rounded border border-linha bg-card p-4 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <p className="text-[15px] font-semibold">
                    {v.marca} {v.modelo} <span className="font-normal text-inkDim">{v.versao}</span>
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-inkFaint">
                    {v.ano_fabricacao}/{v.ano_modelo} · {formatKm(v.km)} · {v.veiculo_fotos?.length ?? 0} fotos
                  </p>
                </div>
                <p className="font-display text-xl text-ouro">{brl(v.preco)}</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => alternarPublicacao(v)}
                    className={`inline-flex items-center gap-2 rounded-[3px] border px-3 py-2 font-mono text-[9px] tracking-[0.1em] ${
                      (v as any).publicado ? "border-verde/45 bg-verde/15 text-[#8FC7A3]" : "border-linha bg-bg2 text-inkFaint"}`}>
                    {(v as any).publicado ? <Eye size={13} /> : <EyeOff size={13} />}
                    {(v as any).publicado ? "NO AR" : "FORA DO AR"}
                  </button>
                  <button onClick={() => setEditando(v)} aria-label="Editar"
                    className="rounded-[3px] border border-linha p-2.5"><Pencil size={14} /></button>
                  <button onClick={() => excluir(v.id)} aria-label="Excluir"
                    className="rounded-[3px] border border-linha p-2.5"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {aba === "leads" && (
        <>
          <div className="mb-4 flex flex-col gap-2.5 sm:flex-row">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-3 text-inkFaint" />
              <input value={buscaLead} onChange={(e) => setBuscaLead(e.target.value)}
                placeholder="Buscar por nome ou mensagem"
                className="w-full rounded-[3px] border border-linha bg-bg1 py-2.5 pl-10 pr-3 text-sm text-ink" />
            </div>
            <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}
              className="rounded-[3px] border border-linha bg-bg1 px-3 py-2.5 text-sm text-ink">
              <option value="todos">Compra e reposição</option>
              <option value="compra">Só compra</option>
              <option value="reposicao">Só reposição</option>
            </select>
            <select value={filtroOrigem} onChange={(e) => setFiltroOrigem(e.target.value)}
              className="rounded-[3px] border border-linha bg-bg1 px-3 py-2.5 text-sm text-ink">
              <option value="todas">Todas as origens</option>
              {origensDosLeads.map((o) => (
                <option key={o} value={o}>{ROTULOS_ORIGEM[o] ?? o}</option>
              ))}
            </select>
            <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}
              className="rounded-[3px] border border-linha bg-bg1 px-3 py-2.5 text-sm text-ink">
              <option value="todos">Todos os status</option>
              {Object.entries(ROTULOS_STATUS).map(([v, rot]) => <option key={v} value={v}>{rot}</option>)}
            </select>
          </div>

          <p className="mb-3 font-mono text-[11px] tracking-[0.1em] text-inkFaint">
            {leadsFiltrados.length} DE {leads.length} {leads.length === 1 ? "LEAD" : "LEADS"}
          </p>

          <div className="grid gap-3">
            {leadsFiltrados.map((l) => {
              const veiculoInteresse = l.veiculo_id ? veiculos.find((v) => v.id === l.veiculo_id) : null;
              return (
                <div key={l.id} className="rounded border border-linha bg-card p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[15px] font-semibold">{l.nome}</p>
                      <p className="mt-1 font-mono text-[11px] text-inkFaint">
                        {formatarData(l.criado_em)} · {l.telefone}{l.email ? ` · ${l.email}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-sm border px-2 py-1 font-mono text-[9px] tracking-[0.12em] ${
                        l.tipo === "reposicao" ? "border-ouro/35 bg-ouro/10 text-ouro" : "border-linha bg-bg2 text-inkDim"}`}>
                        {l.tipo === "reposicao" ? "REPOSIÇÃO" : "COMPRA"}
                      </span>
                      <span className="rounded-sm border border-linha bg-bg2 px-2 py-1 font-mono text-[9px] tracking-[0.1em] text-inkDim">
                        {(ROTULOS_ORIGEM[l.origem] ?? l.origem).toUpperCase()}
                      </span>
                      <select value={l.status} onChange={(e) => atualizarStatusLead(l.id, e.target.value)}
                        className="rounded-sm border border-linha bg-bg2 px-2 py-1.5 font-mono text-[9px] tracking-[0.1em] text-inkDim">
                        {Object.entries(ROTULOS_STATUS).map(([v, rot]) => (
                          <option key={v} value={v}>{rot.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {(veiculoInteresse || l.veiculo_troca || l.mensagem) && (
                    <div className="mt-3 space-y-1.5 border-t border-linha pt-3">
                      {veiculoInteresse && (
                        <p className="flex items-center gap-1.5 text-[13px] text-inkDim">
                          <CarIcon size={13} className="shrink-0 text-inkFaint" />
                          Interesse em: {veiculoInteresse.marca} {veiculoInteresse.modelo} {veiculoInteresse.versao} — {brl(veiculoInteresse.preco)}
                        </p>
                      )}
                      <DetalhesExtras troca={l.veiculo_troca} />
                      {l.mensagem && <p className="text-[13px] text-inkDim">{l.mensagem}</p>}
                    </div>
                  )}

                  <a href={`https://wa.me/55${l.telefone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                    className="mt-3 inline-flex rounded-[3px] bg-zap px-3 py-2 text-xs font-semibold text-white">
                    Responder no WhatsApp
                  </a>
                </div>
              );
            })}
            {leadsFiltrados.length === 0 && (
              <p className="rounded border border-dashed border-linha py-10 text-center text-sm text-inkDim">
                {leads.length === 0 ? "Nenhum lead ainda." : "Nenhum lead com esses filtros."}
              </p>
            )}
          </div>
        </>
      )}

      {aba === "acessos" && (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {[7, 30, 90].map((d) => (
              <button key={d} onClick={() => setPeriodo(d)}
                className={`rounded-[3px] border px-4 py-2 font-mono text-[10px] tracking-[0.1em] ${
                  periodo === d ? "border-ouro bg-ouro/10 text-ouro" : "border-linha text-inkDim"}`}>
                {d} DIAS
              </button>
            ))}
            {carregandoAcessos && <span className="text-[12px] text-inkFaint">Carregando...</span>}

            <a href={GA_RELATORIO} target="_blank" rel="noreferrer"
              className="ml-auto inline-flex items-center gap-2 rounded-[3px] border border-linha px-4 py-2 text-[13px] text-inkDim transition-colors hover:border-ouro hover:text-ouro">
              Abrir no Google Analytics <ExternalLink size={14} />
            </a>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <CartaoNumero rotulo="Visitas" valor={acessos.visitas.toLocaleString("pt-BR")}
              nota="páginas abertas"
              variacao={visitasCortadas ? null : variacao(acessos.visitas, acessos.visitasAntes)} />
            <CartaoNumero rotulo="Visitantes" valor={acessos.visitantes.toLocaleString("pt-BR")}
              nota="pessoas diferentes"
              variacao={visitasCortadas ? null : variacao(acessos.visitantes, acessos.visitantesAntes)} />
            <CartaoNumero rotulo="Leads" valor={String(leadsDoPeriodo)} nota="no mesmo período" />
            <CartaoNumero rotulo="Conversão" valor={`${acessos.conversao.toFixed(1)}%`}
              nota="dos visitantes viraram lead" />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div>
              <h2 className="mb-3 font-mono text-[11px] tracking-[0.14em] text-inkFaint">CARROS MAIS VISTOS</h2>
              <div className="grid gap-2">
                {acessos.carros.map(({ slug, total, veiculo }) => (
                  <div key={slug} className="flex items-center justify-between gap-4 rounded border border-linha bg-card px-4 py-3">
                    <span className="text-[14px]">
                      {veiculo ? `${veiculo.marca} ${veiculo.modelo}` : slug}
                      {veiculo?.versao && <span className="text-inkDim"> {veiculo.versao}</span>}
                    </span>
                    <span className="shrink-0 font-mono text-[12px] text-ouro">{total}</span>
                  </div>
                ))}
                {acessos.carros.length === 0 && (
                  <p className="rounded border border-dashed border-linha py-8 text-center text-sm text-inkDim">
                    Nenhuma visita a página de veículo nesse período.
                  </p>
                )}
              </div>
            </div>

            <div>
              <h2 className="mb-3 font-mono text-[11px] tracking-[0.14em] text-inkFaint">DE ONDE VEM O ACESSO</h2>
              <div className="grid gap-2">
                {acessos.canais.map(({ nome, total }) => {
                  const fatia = acessos.visitas ? Math.round((total / acessos.visitas) * 100) : 0;
                  return (
                    <div key={nome} className="rounded border border-linha bg-card px-4 py-3">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[14px]">{ROTULOS_CANAL[nome] ?? nome}</span>
                        <span className="shrink-0 font-mono text-[12px] text-inkDim">{total} · {fatia}%</span>
                      </div>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-bg2">
                        <div className="h-full bg-ouro" style={{ width: `${fatia}%` }} />
                      </div>
                    </div>
                  );
                })}
                {acessos.canais.length === 0 && (
                  <p className="rounded border border-dashed border-linha py-8 text-center text-sm text-inkDim">
                    Sem acessos registrados nesse período.
                  </p>
                )}
              </div>
            </div>
          </div>

          <p className="mt-6 text-[12px] leading-relaxed text-inkFaint">
            A contagem começa na data em que esta atualização entrou no ar — períodos
            anteriores aparecem vazios. Visitas ao painel não entram na conta.
          </p>
        </>
      )}

      {aba === "banners" && (
        <>
          <button onClick={() => setEditandoBanner({})}
            className="mb-5 inline-flex items-center gap-2 rounded-[3px] bg-ouro px-5 py-3 text-sm font-semibold text-bg0">
            <Plus size={16} /> Novo banner
          </button>

          <div className="grid gap-3">
            {banners.map((b) => (
              <div key={b.id} className="flex flex-col gap-4 rounded border border-linha bg-card p-4 sm:flex-row sm:items-center">
                <img src={b.imagem_url} alt="" className="h-16 w-28 shrink-0 rounded-[3px] object-cover" />
                <div className="flex-1">
                  <p className="text-[15px] font-semibold">{b.titulo}</p>
                  <p className="mt-1 text-[13px] text-inkDim">{b.legenda}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => alternarBannerAtivo(b)}
                    className={`inline-flex items-center gap-2 rounded-[3px] border px-3 py-2 font-mono text-[9px] tracking-[0.1em] ${
                      b.ativo ? "border-verde/45 bg-verde/15 text-[#8FC7A3]" : "border-linha bg-bg2 text-inkFaint"}`}>
                    {b.ativo ? <Eye size={13} /> : <EyeOff size={13} />}
                    {b.ativo ? "NO AR" : "FORA DO AR"}
                  </button>
                  <button onClick={() => setEditandoBanner(b)} aria-label="Editar"
                    className="rounded-[3px] border border-linha p-2.5"><Pencil size={14} /></button>
                  <button onClick={() => excluirBanner(b.id)} aria-label="Excluir"
                    className="rounded-[3px] border border-linha p-2.5"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
            {banners.length === 0 && (
              <p className="rounded border border-dashed border-linha py-10 text-center text-sm text-inkDim">
                Nenhum banner cadastrado ainda.
              </p>
            )}
          </div>
        </>
      )}

      {aba === "loja" && (
        <div className="max-w-[420px] rounded border border-linha bg-card p-6">
          <p className={rotuloLoja}>Logo da loja (fundo transparente, de preferência)</p>
          {loja?.logo_claro_url ? (
            <img src={loja.logo_claro_url} alt="Logo atual" className="mt-3 h-14 w-auto rounded bg-bg0 p-2" />
          ) : (
            <p className="mt-3 text-sm text-inkDim">Nenhuma logo enviada ainda.</p>
          )}
          <label className="mt-4 flex cursor-pointer flex-col items-center gap-2 rounded-[3px] border border-dashed border-linha bg-bg0 py-6">
            <span className="text-[13px] text-inkDim">Enviar / trocar logo</span>
            <input type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarLogo(f); e.target.value = ""; }} />
          </label>
        </div>
      )}

      {editando && lojaId && (
        <FormVeiculo veiculo={editando} lojaId={lojaId}
          fechar={() => setEditando(null)} salvo={() => { setEditando(null); carregar(); }} />
      )}

      {editandoBanner && lojaId && (
        <FormBanner banner={editandoBanner} lojaId={lojaId}
          fechar={() => setEditandoBanner(null)} salvo={() => { setEditandoBanner(null); carregar(); }} />
      )}
    </main>
  );
}

const rotuloLoja = "font-mono text-[9px] uppercase tracking-[0.14em] text-inkFaint";

function CartaoNumero({
  rotulo, valor, nota, variacao: variou,
}: { rotulo: string; valor: string; nota: string; variacao?: number | null }) {
  return (
    <div className="rounded border border-linha bg-card p-5">
      <p className={rotuloLoja}>{rotulo}</p>
      <div className="mt-2 flex items-end gap-2">
        <span className="font-display text-3xl leading-none">{valor}</span>
        {variou != null && variou !== 0 && (
          <span className={`mb-0.5 inline-flex items-center gap-0.5 font-mono text-[11px] ${
            variou > 0 ? "text-[#8FC7A3]" : "text-[#C25454]"}`}>
            {variou > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(variou)}%
          </span>
        )}
      </div>
      <p className="mt-1.5 text-[12px] text-inkFaint">{nota}</p>
    </div>
  );
}

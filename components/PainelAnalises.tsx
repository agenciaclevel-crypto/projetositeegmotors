"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, ArrowDownRight, ExternalLink, RefreshCw } from "lucide-react";
import { supabase, brl, type Veiculo } from "@/lib/supabase";
import { GA_RELATORIO } from "@/lib/rastreio";
import {
  analisar, buscarTudo, inicioDoPeriodo, tabelaAusente, variacao, DIAS_SEMANA,
  type Analise, type CarroDoEstoque, type Evento, type LeadDoPeriodo, type Visita,
} from "@/lib/analises";

/** Nomes bonitos para "de onde vem o acesso". O que não estiver aqui aparece
 * com o próprio endereço do site de origem. */
const ROTULOS_CANAL: Record<string, string> = {
  direto: "Acesso direto", instagram: "Instagram", facebook: "Facebook",
  whatsapp: "WhatsApp", google: "Google", busca: "Outros buscadores",
  portais: "Portais de anúncio", youtube: "YouTube", tiktok: "TikTok",
  linkedin: "LinkedIn",
};

const ROTULOS_PAGINA: Record<string, string> = {
  "/": "Início (estoque)", "/veiculo/": "Páginas de carros", "/vender": "Venda seu carro",
  "/agenciamento": "Agenciamento", "/contato": "Contato",
};

const ROTULOS_APARELHO: Record<string, string> = {
  celular: "Celular", computador: "Computador", tablet: "Tablet",
};

/** Mapa de calor: um tom de dourado só, do mais apagado ao cheio. Validado
 * contra o fundo dos cartões (#20232A): cada degrau se distingue do vizinho e
 * o mais claro ainda aparece. Zero fica na cor de trilho, fora da escala. */
const ESCALA_CALOR = ["#6B5C41", "#89734A", "#A78A53", "#C7A25C"];

const rotulo = "font-mono text-[9px] uppercase tracking-[0.14em] text-inkFaint";
const tituloBloco = "mb-3 font-mono text-[11px] tracking-[0.14em] text-inkFaint";

const inteiro = (n: number) => n.toLocaleString("pt-BR");
const porcento = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const fatia = (parte: number, todo: number) => (todo ? (parte / todo) * 100 : 0);

function formatarTempo(segundos: number) {
  const s = Math.round(segundos);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min ${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}min`;
}

const formatarDia = (d: Date) =>
  `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} (${DIAS_SEMANA[(d.getDay() + 6) % 7].toLowerCase()})`;

type Resultado = {
  analise: Analise;
  leadsAntes: number | null;
  leads: number;
  faltaTabela: boolean;
  cortado: boolean;
};

export default function PainelAnalises({ lojaId, veiculos }: { lojaId: string; veiculos: Veiculo[] }) {
  const [dias, setDias] = useState(30);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const ultimoPedido = useRef(0);

  const estoque = useMemo<CarroDoEstoque[]>(() => veiculos.map((v) => ({
    id: v.id, slug: v.slug, marca: v.marca, modelo: v.modelo, versao: v.versao, preco: v.preco,
    publicado: (v as { publicado?: boolean }).publicado,
    status: (v as { status?: string }).status,
  })), [veiculos]);

  // Só roda com a aba aberta (o componente só existe nela) — não atrasa o
  // resto do painel. Busca o dobro do período para comparar com o anterior.
  const carregar = useCallback(async () => {
    const pedido = ++ultimoPedido.current;
    setCarregando(true);
    const agora = new Date();
    const fim = agora.toISOString();
    const inicio = inicioDoPeriodo(dias, agora).toISOString();
    const inicioAnterior = inicioDoPeriodo(dias * 2, agora).toISOString();

    const [v, ev, ld, antes] = await Promise.all([
      buscarTudo<Visita>((de, ate, contar) => supabase.from("visitas")
        .select("visitante, caminho, origem, campanha:utm->>utm_campaign, criado_em",
          contar ? { count: "exact" } : undefined)
        .eq("loja_id", lojaId).gte("criado_em", inicioAnterior).lte("criado_em", fim)
        .order("criado_em", { ascending: false }).order("id", { ascending: false })
        .range(de, ate)),
      buscarTudo<Evento>((de, ate, contar) => supabase.from("eventos")
        .select("visitante, caminho, tipo, rotulo, valor, rolagem, dispositivo, criado_em",
          contar ? { count: "exact" } : undefined)
        .eq("loja_id", lojaId).gte("criado_em", inicio).lte("criado_em", fim)
        .order("criado_em", { ascending: false }).order("id", { ascending: false })
        .range(de, ate)),
      // Clique no WhatsApp pelo banner também vira "lead", sem telefone: é
      // registro de origem e já entra como contato pelos eventos.
      buscarTudo<LeadDoPeriodo>((de, ate, contar) => supabase.from("leads")
        .select("veiculo_id, criado_em", contar ? { count: "exact" } : undefined)
        .eq("loja_id", lojaId).neq("telefone", "").gte("criado_em", inicio).lte("criado_em", fim)
        .order("criado_em", { ascending: false }).order("id", { ascending: false })
        .range(de, ate)),
      supabase.from("leads").select("id", { count: "exact", head: true })
        .eq("loja_id", lojaId).neq("telefone", "")
        .gte("criado_em", inicioAnterior).lt("criado_em", inicio),
    ]);

    // trocou de período no meio da busca: esta resposta já não vale
    if (pedido !== ultimoPedido.current) return;

    const faltaTabela = tabelaAusente(ev.erro);
    const falha = v.erro ?? (faltaTabela ? null : ev.erro) ?? ld.erro ?? antes.error;
    setErro(falha ? `Parte dos números não carregou: ${falha.message}` : "");

    setResultado({
      analise: analisar({
        dias, agora, visitas: v.linhas, eventos: ev.linhas, leads: ld.linhas, veiculos: estoque,
      }),
      leads: ld.linhas.length,
      leadsAntes: antes.error ? null : antes.count ?? 0,
      faltaTabela,
      cortado: v.cortado || ev.cortado,
    });
    setCarregando(false);
  }, [lojaId, dias, estoque]);

  useEffect(() => { carregar(); }, [carregar]);

  const a = resultado?.analise;
  const temEventos = !!resultado && !resultado.faltaTabela;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {[7, 30, 90].map((d) => (
          <button key={d} onClick={() => setDias(d)}
            className={`rounded-[3px] border px-4 py-2 font-mono text-[10px] tracking-[0.1em] ${
              dias === d ? "border-ouro bg-ouro/10 text-ouro" : "border-linha text-inkDim"}`}>
            {d} DIAS
          </button>
        ))}
        <button onClick={carregar} disabled={carregando} aria-label="Atualizar os números"
          className="rounded-[3px] border border-linha p-2 text-inkDim disabled:opacity-45">
          <RefreshCw size={14} className={carregando ? "animate-spin" : ""} />
        </button>

        <a href={GA_RELATORIO} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-[3px] border border-linha px-4 py-2 text-[13px] text-inkDim transition-colors hover:border-ouro hover:text-ouro sm:ml-auto">
          Abrir no Google Analytics <ExternalLink size={14} />
        </a>
      </div>

      {erro && (
        <p className="mb-5 rounded border border-[#C25454]/45 bg-[#C25454]/10 px-4 py-3 text-sm text-[#E08A8A]">{erro}</p>
      )}

      {resultado?.faltaTabela && (
        <div className="mb-5 rounded border border-ouro/35 bg-ouro/10 px-4 py-3 text-[13px] leading-relaxed text-inkDim">
          <p className="font-semibold text-ink">Falta um passo para ligar os dados de comportamento.</p>
          <p className="mt-1">
            Visitas, canais e carros mais vistos já aparecem abaixo. Cliques no WhatsApp, buscas no
            estoque, tempo de leitura e formulários abandonados começam a contar depois que o
            script <span className="font-mono text-[12px] text-ink">migracao-comportamento.sql</span> for
            rodado no Supabase (SQL Editor → colar → Run).
          </p>
        </div>
      )}

      {resultado?.cortado && (
        <p className="mb-5 text-[12px] text-inkFaint">
          Volume acima do teto de leitura do painel: os números do período mais antigo podem vir
          incompletos, e a comparação com o período anterior foi escondida.
        </p>
      )}

      {!a ? (
        <p className="py-10 text-center text-sm text-inkDim">Carregando os números...</p>
      ) : (
        <div className={carregando ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <CartaoNumero rotulo="Visitantes" valor={inteiro(a.visitantes)} nota="pessoas diferentes"
              variacao={resultado.cortado ? null : variacao(a.visitantes, a.visitantesAntes)} />
            <CartaoNumero rotulo="Páginas vistas" valor={inteiro(a.paginas)}
              nota={a.visitantes ? `${(a.paginas / a.visitantes).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} por visitante` : "páginas abertas"}
              variacao={resultado.cortado ? null : variacao(a.paginas, a.paginasAntes)} />
            <CartaoNumero rotulo="Contatos" valor={temEventos ? inteiro(a.contatos) : "—"}
              nota="WhatsApp, ligação ou formulário" />
            <CartaoNumero rotulo="Conversão"
              valor={porcento(fatia(temEventos ? a.contatos : resultado.leads, a.visitantes))}
              nota={temEventos ? "dos visitantes chamaram a loja" : "dos visitantes viraram lead"} />
            <CartaoNumero rotulo="Leads" valor={inteiro(resultado.leads)} nota="formulários com WhatsApp"
              variacao={resultado.leadsAntes == null ? null : variacao(resultado.leads, resultado.leadsAntes)} />
            <CartaoNumero rotulo="Tempo no site" valor={temEventos ? formatarTempo(a.segundosPorVisitante) : "—"}
              nota="em média, por visitante" />
          </div>

          <Bloco titulo="VISITANTES POR DIA" className="mt-8">
            <GraficoDiario dias={a.porDia} temEventos={temEventos} />
          </Bloco>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Bloco titulo="DO ACESSO AO CONTATO">
              <Funil etapas={[
                { rotulo: "Entraram no site", valor: a.funil.visitantes },
                { rotulo: "Abriram a página de um carro", valor: a.funil.viramCarro },
                ...(temEventos ? [{ rotulo: "Chamaram a loja", valor: a.funil.contataram }] : []),
              ]} />
              {temEventos && (
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <MiniNumero rotulo="WhatsApp" valor={a.acoes.whatsapp} nota={`${inteiro(a.cliquesWhatsapp)} cliques`} />
                  <MiniNumero rotulo="Ligaram" valor={a.acoes.telefone} />
                  <MiniNumero rotulo="Formulário" valor={a.acoes.lead} />
                  <MiniNumero rotulo="Rota até a loja" valor={a.acoes.rota} />
                  <MiniNumero rotulo="Viram as fotos" valor={a.acoes.galeria} />
                  <MiniNumero rotulo="Voltaram outro dia" valor={a.voltaram}
                    nota={porcento(fatia(a.voltaram, a.visitantes))} />
                </div>
              )}
              {temEventos && <p className="mt-2 text-[11px] text-inkFaint">Pessoas diferentes em cada ação.</p>}
            </Bloco>

            <Bloco titulo="FORMULÁRIOS: COMEÇARAM X ENVIARAM">
              {!temEventos ? <Pendente /> : a.formularios.length === 0 ? (
                <Vazio texto="Ninguém mexeu em formulário nesse período." />
              ) : (
                <div className="grid gap-2">
                  {a.formularios.map((f) => {
                    const enviou = fatia(f.enviaram, Math.max(f.comecaram, f.enviaram));
                    return (
                      <div key={f.chave} className="rounded border border-linha bg-card px-4 py-3">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-[14px]">{f.nome}</span>
                          <span className="shrink-0 font-mono text-[12px] text-inkDim">
                            {inteiro(f.comecaram)} → {inteiro(f.enviaram)}
                          </span>
                        </div>
                        <Trilho pct={enviou} />
                        <p className="mt-1.5 text-[11px] text-inkFaint">
                          {f.comecaram > f.enviaram
                            ? `${inteiro(f.comecaram - f.enviaram)} desistiram no meio — ${porcento(100 - enviou)}`
                            : "Ninguém desistiu no meio."}
                        </p>
                      </div>
                    );
                  })}
                  <p className="text-[11px] leading-relaxed text-inkFaint">
                    Muita desistência num formulário costuma ser campo demais ou pergunta que trava.
                  </p>
                </div>
              )}
            </Bloco>
          </div>

          <Bloco titulo="DESEMPENHO DE CADA CARRO" className="mt-8"
            nota={temEventos && a.leituraCarros.chegaramAoFim != null
              ? `Quem abre um carro fica, em média, ${formatarTempo(a.leituraCarros.segundosMedios)} na página, e ${porcento(a.leituraCarros.chegaramAoFim)} rolam até o fim.`
              : undefined}>
            <TabelaCarros carros={a.carros} temEventos={temEventos} />
            {a.semVisita.length > 0 && (
              <div className="mt-4 rounded border border-dashed border-linha p-4">
                <p className="text-[13px] text-inkDim">
                  <span className="font-semibold text-ink">{a.semVisita.length} {a.semVisita.length === 1 ? "carro publicado ficou" : "carros publicados ficaram"} sem nenhuma visita</span>{" "}
                  nesse período. Vale divulgar de novo ou revisar foto e preço.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {a.semVisita.slice(0, 30).map((v) => (
                    <span key={v.id} className="rounded-sm border border-linha bg-bg2 px-2 py-1 text-[12px] text-inkDim">
                      {v.marca} {v.modelo} {v.versao ?? ""}
                    </span>
                  ))}
                  {a.semVisita.length > 30 && (
                    <span className="px-2 py-1 text-[12px] text-inkFaint">e mais {a.semVisita.length - 30}</span>
                  )}
                </div>
              </div>
            )}
          </Bloco>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Bloco titulo="DE ONDE VEM O ACESSO">
              <ListaBarras total={a.visitantes} vazio="Sem acessos registrados nesse período."
                itens={a.canais.slice(0, 8).map((c) => ({
                  chave: c.nome,
                  rotulo: ROTULOS_CANAL[c.nome] ?? c.nome,
                  valor: c.visitantes,
                  detalhe: temEventos
                    ? `${inteiro(c.visitantes)} · ${inteiro(c.contatos)} ${c.contatos === 1 ? "contato" : "contatos"} (${porcento(fatia(c.contatos, c.visitantes))})`
                    : `${inteiro(c.visitantes)} · ${Math.round(fatia(c.visitantes, a.visitantes))}%`,
                }))} />
              {temEventos && (
                <p className="mt-2 text-[11px] leading-relaxed text-inkFaint">
                  Visitantes de cada canal e quantos deles chamaram a loja. O canal que traz menos
                  gente mas converte mais costuma ser o melhor lugar para investir.
                </p>
              )}
            </Bloco>

            <Bloco titulo="CAMPANHAS (UTM)">
              {a.campanhas.length === 0 ? (
                <Vazio texto="Nenhum acesso com utm_campaign nesse período. Use links com utm nos anúncios para separar uma campanha da outra aqui." />
              ) : (
                <ListaBarras total={a.campanhas[0].visitantes}
                  itens={a.campanhas.slice(0, 8).map((c) => ({
                    chave: c.nome, rotulo: c.nome, valor: c.visitantes,
                    detalhe: temEventos
                      ? `${inteiro(c.visitantes)} · ${inteiro(c.contatos)} ${c.contatos === 1 ? "contato" : "contatos"}`
                      : inteiro(c.visitantes),
                  }))} />
              )}
            </Bloco>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Bloco titulo="O QUE PROCURAM NA BUSCA">
              {!temEventos ? <Pendente /> : a.buscas.length === 0 ? (
                <Vazio texto="Ninguém usou a busca do estoque nesse período." />
              ) : (
                <>
                  <div className="overflow-hidden rounded border border-linha bg-card">
                    {a.buscas.slice(0, 12).map((b, i) => (
                      <div key={b.termo} className={`flex items-center justify-between gap-3 px-4 py-2.5 ${i ? "border-t border-linha" : ""}`}>
                        <span className="truncate text-[14px]">{b.termo}</span>
                        <span className="flex shrink-0 items-center gap-2">
                          {b.achados === 0 && (
                            <span className="rounded-sm border border-ouro/35 bg-ouro/10 px-1.5 py-0.5 font-mono text-[9px] tracking-[0.1em] text-ouro">
                              FORA DO ESTOQUE
                            </span>
                          )}
                          <span className="font-mono text-[12px] text-inkDim">
                            {inteiro(b.vezes)} {b.vezes === 1 ? "pessoa" : "pessoas"}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-inkFaint">
                    &quot;Fora do estoque&quot; é procura que a loja não atendeu: boa pista do que comprar para o pátio.
                  </p>
                </>
              )}
            </Bloco>

            <Bloco titulo="FILTROS MAIS USADOS">
              {!temEventos ? <Pendente /> : (
                <ListaBarras total={a.filtros[0]?.pessoas ?? 0} vazio="Nenhum filtro usado nesse período."
                  itens={a.filtros.slice(0, 8).map((f) => ({
                    chave: f.rotulo, rotulo: f.rotulo, valor: f.pessoas,
                    detalhe: `${inteiro(f.pessoas)} ${f.pessoas === 1 ? "pessoa" : "pessoas"}`,
                  }))} />
              )}
            </Bloco>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[3fr_2fr]">
            <Bloco titulo="QUANDO ACESSAM"
              nota={a.pico
                ? `Pico: ${DIAS_SEMANA[a.pico.dia].toLowerCase()} às ${a.pico.hora}h. Bom horário para postar e para ter alguém atendendo o WhatsApp.`
                : undefined}>
              <MapaDeCalor horarios={a.horarios} />
            </Bloco>

            <div className="grid content-start gap-6">
              <Bloco titulo="APARELHO">
                {!temEventos ? <Pendente /> : (
                  <ListaBarras total={a.pessoasComAparelho} vazio="Ainda sem dados nesse período."
                    itens={a.aparelhos.map((p) => ({
                      chave: p.nome, rotulo: ROTULOS_APARELHO[p.nome] ?? p.nome, valor: p.pessoas,
                      detalhe: porcento(fatia(p.pessoas, a.pessoasComAparelho)),
                    }))} />
                )}
              </Bloco>

              <Bloco titulo="PÁGINAS MAIS VISTAS">
                <ListaBarras total={a.paginas} vazio="Sem acessos registrados nesse período."
                  itens={a.paginasMaisVistas.slice(0, 6).map((p) => ({
                    chave: p.caminho, rotulo: ROTULOS_PAGINA[p.caminho] ?? p.caminho, valor: p.paginas,
                    detalhe: `${inteiro(p.paginas)} · ${inteiro(p.visitantes)} ${p.visitantes === 1 ? "pessoa" : "pessoas"}`,
                  }))} />
              </Bloco>
            </div>
          </div>

          <p className="mt-8 text-[12px] leading-relaxed text-inkFaint">
            Visitas ao painel e à tela de login não entram na conta. Visitas contam desde que o registro
            de acessos entrou no ar; o comportamento (cliques, buscas, tempo e formulários), desde que o
            script de comportamento foi rodado — períodos anteriores aparecem vazios. Cada navegador conta
            como uma pessoa: quem abre no celular e depois no computador conta duas vezes.
          </p>
        </div>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- */
/*  Peças                                                            */
/* ---------------------------------------------------------------- */

function Bloco({
  titulo, nota, className = "", children,
}: { titulo: string; nota?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={className}>
      <h2 className={tituloBloco}>{titulo}</h2>
      {nota && <p className="-mt-1 mb-3 text-[13px] leading-relaxed text-inkDim">{nota}</p>}
      {children}
    </section>
  );
}

function CartaoNumero({
  rotulo: titulo, valor, nota, variacao: variou,
}: { rotulo: string; valor: string; nota: string; variacao?: number | null }) {
  return (
    <div className="rounded border border-linha bg-card p-4 sm:p-5">
      <p className={rotulo}>{titulo}</p>
      <div className="mt-2 flex flex-wrap items-end gap-x-2">
        <span className="font-display text-3xl leading-none">{valor}</span>
        {variou != null && variou !== 0 && (
          <span className={`mb-0.5 inline-flex items-center gap-0.5 font-mono text-[11px] ${
            variou > 0 ? "text-[#8FC7A3]" : "text-[#E08A8A]"}`}>
            {variou > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(variou)}%
          </span>
        )}
      </div>
      <p className="mt-1.5 text-[12px] leading-snug text-inkFaint">{nota}</p>
    </div>
  );
}

function MiniNumero({ rotulo: titulo, valor, nota }: { rotulo: string; valor: number; nota?: string }) {
  return (
    <div className="rounded border border-linha bg-card px-3 py-2.5">
      <p className={rotulo}>{titulo}</p>
      <p className="mt-1 font-display text-xl leading-none">{inteiro(valor)}</p>
      {nota && <p className="mt-1 text-[11px] text-inkFaint">{nota}</p>}
    </div>
  );
}

function Trilho({ pct }: { pct: number }) {
  return (
    <div className="mt-2 h-1 overflow-hidden rounded-full bg-bg2">
      <div className="h-full rounded-full bg-ouro" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <p className="rounded border border-dashed border-linha px-4 py-8 text-center text-sm leading-relaxed text-inkDim">
      {texto}
    </p>
  );
}

function Pendente() {
  return <Vazio texto="Aparece depois que o script migracao-comportamento.sql for rodado no Supabase." />;
}

/** Barra proporcional a "total": a soma (quando as fatias somam o todo, como
 * nos canais) ou o maior item (quando só a ordem importa, como nos filtros). */
function ListaBarras({
  itens, total, vazio = "Sem dados nesse período.",
}: {
  itens: { chave: string; rotulo: string; valor: number; detalhe: string }[];
  total: number;
  vazio?: string;
}) {
  if (itens.length === 0) return <Vazio texto={vazio} />;
  return (
    <div className="grid gap-2">
      {itens.map((i) => (
        <div key={i.chave} className="rounded border border-linha bg-card px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <span className="truncate text-[14px]">{i.rotulo}</span>
            <span className="shrink-0 font-mono text-[12px] text-inkDim">{i.detalhe}</span>
          </div>
          <Trilho pct={fatia(i.valor, total)} />
        </div>
      ))}
    </div>
  );
}

function Funil({ etapas }: { etapas: { rotulo: string; valor: number }[] }) {
  const topo = etapas[0]?.valor ?? 0;
  return (
    <div className="grid gap-2">
      {etapas.map((e, i) => (
        <div key={e.rotulo} className="rounded border border-linha bg-card px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[14px]">{e.rotulo}</span>
            <span className="shrink-0 font-mono text-[12px] text-inkDim">
              {inteiro(e.valor)}{i > 0 && topo ? ` · ${porcento(fatia(e.valor, topo))}` : ""}
            </span>
          </div>
          <Trilho pct={fatia(e.valor, topo)} />
        </div>
      ))}
    </div>
  );
}

function GraficoDiario({
  dias, temEventos,
}: { dias: Analise["porDia"]; temEventos: boolean }) {
  const [foco, setFoco] = useState<number | null>(null);
  const maximo = Math.max(1, ...dias.map((d) => d.visitantes));
  const total = dias.reduce((s, d) => s + d.visitantes, 0);
  const melhor = dias.reduce((m, d, i) => (d.visitantes > dias[m].visitantes ? i : m), 0);
  const d = foco != null ? dias[foco] : null;

  // Leitura de um dia: passando o mouse (ou tocando) numa coluna.
  const leitura = d
    ? `${formatarDia(d.dia)} · ${inteiro(d.visitantes)} ${d.visitantes === 1 ? "visitante" : "visitantes"} · ${inteiro(d.paginas)} páginas${temEventos ? ` · ${inteiro(d.contatos)} ${d.contatos === 1 ? "contato" : "contatos"}` : ""}`
    : total
      ? `Melhor dia: ${formatarDia(dias[melhor].dia)}, com ${inteiro(dias[melhor].visitantes)} visitantes. Passe o dedo ou o mouse nas colunas.`
      : "Sem visitas nesse período.";

  const marcas = [0, Math.floor((dias.length - 1) / 2), dias.length - 1];

  return (
    <div className="rounded border border-linha bg-card p-4 sm:p-5">
      <p className="min-h-[20px] text-[13px] text-inkDim" aria-live="polite">{leitura}</p>

      <div className="relative mt-3">
        <span className="absolute -top-0.5 left-0 font-mono text-[10px] text-inkFaint">{inteiro(maximo)}</span>
        <div className="border-t border-linha pt-4" />
        <div role="img" aria-label={`Visitantes por dia nos últimos ${dias.length} dias, ${inteiro(total)} no total.`}
          onPointerLeave={() => setFoco(null)}
          className={`flex h-36 items-end ${dias.length > 31 ? "gap-px" : "gap-[2px]"}`}>
          {dias.map((dia, i) => {
            const altura = (dia.visitantes / maximo) * 100;
            return (
              <div key={i} onPointerEnter={() => setFoco(i)} onPointerDown={() => setFoco(i)}
                title={`${formatarDia(dia.dia)}: ${dia.visitantes} visitantes`}
                className="flex h-full min-w-0 flex-1 cursor-default items-end justify-center">
                <div className={`w-full max-w-[24px] rounded-t-[4px] transition-opacity ${
                    foco != null && foco !== i ? "bg-ouro opacity-35" : "bg-ouro"}`}
                  style={{ height: dia.visitantes ? `max(${altura}%, 2px)` : "0" }} />
              </div>
            );
          })}
        </div>
        <div className="border-t border-linha" />
        <div className="relative mt-1.5 h-4 font-mono text-[10px] text-inkFaint">
          {marcas.map((i, n) => (
            <span key={n} className="absolute"
              style={n === 0 ? { left: 0 } : n === 2 ? { right: 0 } : { left: "50%", transform: "translateX(-50%)" }}>
              {i === dias.length - 1 ? "hoje" : dias[i]?.dia.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function MapaDeCalor({ horarios }: { horarios: number[][] }) {
  const [foco, setFoco] = useState<{ dia: number; hora: number } | null>(null);
  const maximo = Math.max(0, ...horarios.flat());
  const cor = (n: number) => {
    if (!n || !maximo) return "#1D2027";
    return ESCALA_CALOR[Math.min(ESCALA_CALOR.length - 1, Math.ceil((n / maximo) * ESCALA_CALOR.length) - 1)];
  };

  const leitura = foco
    ? `${DIAS_SEMANA[foco.dia]}, das ${foco.hora}h às ${foco.hora + 1}h · ${inteiro(horarios[foco.dia][foco.hora])} páginas`
    : maximo ? "Passe o dedo ou o mouse nos quadrados." : "Sem visitas nesse período.";

  return (
    <div className="rounded border border-linha bg-card p-4 sm:p-5">
      <p className="min-h-[20px] text-[13px] text-inkDim" aria-live="polite">{leitura}</p>
      <div role="img" aria-label="Páginas abertas por dia da semana e hora do dia"
        onPointerLeave={() => setFoco(null)} className="mt-3 grid gap-[2px]"
        style={{ gridTemplateColumns: "28px repeat(24, minmax(0, 1fr))" }}>
        {horarios.map((linha, dia) => (
          <div key={dia} className="contents">
            <span className="self-center font-mono text-[9px] text-inkFaint">{DIAS_SEMANA[dia]}</span>
            {linha.map((n, hora) => (
              <div key={hora} onPointerEnter={() => setFoco({ dia, hora })} onPointerDown={() => setFoco({ dia, hora })}
                title={`${DIAS_SEMANA[dia]} ${hora}h: ${n} páginas`}
                className={`aspect-square rounded-[2px] ${foco?.dia === dia && foco?.hora === hora ? "ring-1 ring-ink" : ""}`}
                style={{ background: cor(n) }} />
            ))}
          </div>
        ))}
        <span />
        {Array.from({ length: 24 }, (_, hora) => (
          <span key={hora} className="pt-1 text-center font-mono text-[9px] text-inkFaint">
            {hora % 6 === 0 ? `${hora}h` : ""}
          </span>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 font-mono text-[9px] text-inkFaint">
        menos
        {ESCALA_CALOR.map((c) => <span key={c} className="h-2.5 w-2.5 rounded-[2px]" style={{ background: c }} />)}
        mais
      </div>
    </div>
  );
}

function TabelaCarros({ carros, temEventos }: { carros: Analise["carros"]; temEventos: boolean }) {
  const [todos, setTodos] = useState(false);
  if (carros.length === 0) return <Vazio texto="Nenhuma visita a página de veículo nesse período." />;
  const visiveis = todos ? carros : carros.slice(0, 10);
  const celula = "px-3 py-2.5 text-right font-mono text-[12px] tabular-nums";

  return (
    <>
      <div className="overflow-x-auto rounded border border-linha bg-card">
        <table className="w-full min-w-[620px] text-left">
          <thead>
            <tr className="border-b border-linha">
              <th className={`${rotulo} px-4 py-2.5 font-normal`}>Carro</th>
              <th className={`${rotulo} px-3 py-2.5 text-right font-normal`}>Visitas</th>
              <th className={`${rotulo} px-3 py-2.5 text-right font-normal`}>Pessoas</th>
              {temEventos && <th className={`${rotulo} px-3 py-2.5 text-right font-normal`}>WhatsApp</th>}
              <th className={`${rotulo} px-3 py-2.5 text-right font-normal`}>Leads</th>
              {temEventos && <th className={`${rotulo} px-4 py-2.5 text-right font-normal`}>Tempo médio</th>}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((c) => (
              <tr key={c.slug} className="border-t border-linha first:border-t-0">
                <td className="px-4 py-2.5">
                  <p className="text-[14px]">
                    {c.veiculo ? `${c.veiculo.marca} ${c.veiculo.modelo}` : c.slug}
                    {c.veiculo?.versao && <span className="text-inkDim"> {c.veiculo.versao}</span>}
                  </p>
                  {c.veiculo && <p className="font-mono text-[11px] text-inkFaint">{brl(c.veiculo.preco)}</p>}
                </td>
                <td className={`${celula} text-ink`}>{inteiro(c.paginas)}</td>
                <td className={`${celula} text-inkDim`}>{inteiro(c.visitantes)}</td>
                {temEventos && <td className={`${celula} text-inkDim`}>{inteiro(c.whatsapp)}</td>}
                <td className={`${celula} text-inkDim`}>{inteiro(c.leads)}</td>
                {temEventos && <td className={`${celula} pr-4 text-inkDim`}>{c.segundosMedios ? formatarTempo(c.segundosMedios) : "—"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {carros.length > 10 && (
        <button onClick={() => setTodos((t) => !t)}
          className="mt-2 w-full rounded-[3px] border border-linha py-2.5 text-[13px] text-inkDim">
          {todos ? "Mostrar só os 10 mais vistos" : `Ver todos os ${carros.length} carros`}
        </button>
      )}
      <p className="mt-2 text-[11px] leading-relaxed text-inkFaint">
        Carro com muita visita e pouco contato pede revisão de preço ou de fotos. WhatsApp conta quem
        clicou estando na página do carro; leads são os formulários ligados a ele.
      </p>
    </>
  );
}

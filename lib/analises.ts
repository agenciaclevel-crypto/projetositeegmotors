/**
 * Contas da aba "Análises" do painel.
 *
 * Tudo aqui é cálculo puro sobre as linhas já baixadas de visitas, eventos e
 * leads — sem banco e sem tela —, para os números poderem ser conferidos
 * isoladamente. Quem busca os dados é components/PainelAnalises.tsx.
 */

export const DIA_MS = 86_400_000;

export type Visita = {
  visitante: string; caminho: string; origem: string | null;
  campanha: string | null; criado_em: string;
};

export type Evento = {
  visitante: string; caminho: string; tipo: string; rotulo: string | null;
  valor: number | string | null; rolagem: number | null;
  dispositivo: string | null; criado_em: string;
};

export type LeadDoPeriodo = { veiculo_id: string | null; criado_em: string };

export type CarroDoEstoque = {
  id: string; slug: string; marca: string; modelo: string; versao: string | null;
  preco: number; publicado?: boolean; status?: string;
};

/** O que conta como "entrou em contato com a loja". */
const CONTATO = new Set(["whatsapp", "telefone", "lead"]);

/** Formulários do site, pelo data-formulario do bloco (que é também a
 * categoria do lead em lib/rastreio.ts). */
export const NOMES_FORMULARIO: Record<string, string> = {
  financiamento: "Simulador de financiamento",
  avaliacao_veiculo: "Venda seu carro",
  agenciamento: "Agenciamento",
  interesse_veiculo: "Interesse no carro",
};

export const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/** Meia-noite de (hoje - dias + 1), no fuso do navegador. "7 dias" é hoje e
 * os seis anteriores, inteiros. */
export function inicioDoPeriodo(dias: number, agora = new Date()) {
  const d = new Date(agora);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (dias - 1));
  return d;
}

/** Variação percentual contra o período anterior. null quando não há base de
 * comparação — melhor não mostrar nada do que mostrar "+100%" de dois acessos. */
export function variacao(atual: number, anterior: number) {
  if (!anterior) return null;
  return Math.round(((atual - anterior) / anterior) * 100);
}

export function slugDoCaminho(caminho: string) {
  const achado = caminho.match(/^\/veiculo\/([^/?#]+)/);
  if (!achado) return null;
  try { return decodeURIComponent(achado[1]); } catch { return achado[1]; }
}

/** Sem acento, sem caixa e sem espaço sobrando: "Corolla", "corolla " e
 * "Coróla" caem no mesmo termo. */
export function normalizarTermo(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim().replace(/\s+/g, " ");
}

const chaveDia = (d: Date) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const tempo = (iso: string) => new Date(iso).getTime();
const numero = (v: number | string | null) => (v == null ? 0 : Number(v) || 0);

/** Conta pessoas diferentes por chave: Map<chave, Set<visitante>>. */
function contarPessoas() {
  const mapa = new Map<string, Set<string>>();
  return {
    mapa,
    somar(chave: string, visitante: string) {
      let pessoas = mapa.get(chave);
      if (!pessoas) mapa.set(chave, (pessoas = new Set()));
      pessoas.add(visitante);
    },
    total: (chave: string) => mapa.get(chave)?.size ?? 0,
  };
}

export function analisar(dados: {
  dias: number;
  agora: Date;
  /** Período atual e o anterior, para comparar. */
  visitas: Visita[];
  /** Só o período atual. Vazio quando a tabela ainda não existe. */
  eventos: Evento[];
  /** Leads com contato do período atual. */
  leads: LeadDoPeriodo[];
  veiculos: CarroDoEstoque[];
}) {
  const { dias, agora, eventos, leads, veiculos } = dados;
  const inicio = inicioDoPeriodo(dias, agora).getTime();

  const atual: Visita[] = [];
  const anterior: Visita[] = [];
  dados.visitas.forEach((v) => (tempo(v.criado_em) >= inicio ? atual : anterior).push(v));

  const pessoas = (lista: { visitante: string }[]) => new Set(lista.map((x) => x.visitante));
  const visitantesAtuais = pessoas(atual);
  const visitantes = visitantesAtuais.size;

  /* ---------- canal de cada contato: a visita que veio logo antes ---------- */

  const visitasPorPessoa = new Map<string, Visita[]>();
  dados.visitas.forEach((v) => {
    const lista = visitasPorPessoa.get(v.visitante);
    if (lista) lista.push(v); else visitasPorPessoa.set(v.visitante, [v]);
  });
  visitasPorPessoa.forEach((lista) => lista.sort((a, b) => tempo(a.criado_em) - tempo(b.criado_em)));

  function visitaDeOrigem(visitante: string, quando: number) {
    const lista = visitasPorPessoa.get(visitante);
    if (!lista?.length) return null;
    let achada = lista[0];
    // folga de alguns segundos: a visita é gravada ao abrir a página e pode
    // chegar ao banco depois do clique
    for (const v of lista) {
      if (tempo(v.criado_em) <= quando + 5000) achada = v; else break;
    }
    return achada;
  }

  const contatos = eventos.filter((e) => CONTATO.has(e.tipo));
  const pessoasQueContataram = pessoas(contatos);

  /* ---------- por dia ---------- */

  const porDia = Array.from({ length: dias }, (_, i) => {
    const dia = inicioDoPeriodo(dias, agora);
    dia.setDate(dia.getDate() + i);
    return { dia, paginas: 0, visitantes: new Set<string>(), contatos: new Set<string>() };
  });
  const indiceDoDia = new Map(porDia.map((d, i) => [chaveDia(d.dia), i]));
  atual.forEach((v) => {
    const i = indiceDoDia.get(chaveDia(new Date(v.criado_em)));
    if (i == null) return;
    porDia[i].paginas++;
    porDia[i].visitantes.add(v.visitante);
  });
  contatos.forEach((e) => {
    const i = indiceDoDia.get(chaveDia(new Date(e.criado_em)));
    if (i != null) porDia[i].contatos.add(e.visitante);
  });

  /* ---------- carros ---------- */

  const veiculoPorSlug = new Map(veiculos.map((v) => [v.slug, v]));
  const veiculoPorId = new Map(veiculos.map((v) => [v.id, v]));
  const carros = new Map<string, {
    slug: string; paginas: number; visitantes: Set<string>;
    whatsapp: Set<string>; leads: number; segundos: number;
  }>();
  const carro = (slug: string) => {
    let c = carros.get(slug);
    if (!c) {
      c = { slug, paginas: 0, visitantes: new Set(), whatsapp: new Set(), leads: 0, segundos: 0 };
      carros.set(slug, c);
    }
    return c;
  };

  const viramCarro = new Set<string>();
  atual.forEach((v) => {
    const slug = slugDoCaminho(v.caminho);
    if (!slug) return;
    viramCarro.add(v.visitante);
    const c = carro(slug);
    c.paginas++;
    c.visitantes.add(v.visitante);
  });

  // rolagem máxima de cada pessoa em cada carro, para saber quem chegou ao fim
  const rolagemNoCarro = new Map<string, number>();
  let segundosEmCarros = 0;
  eventos.forEach((e) => {
    const slug = slugDoCaminho(e.caminho);
    if (!slug || !carros.has(slug)) return;
    const c = carro(slug);
    if (e.tipo === "whatsapp" || e.tipo === "telefone") c.whatsapp.add(e.visitante);
    if (e.tipo === "leitura") {
      c.segundos += numero(e.valor);
      segundosEmCarros += numero(e.valor);
      const chave = `${e.visitante}|${slug}`;
      rolagemNoCarro.set(chave, Math.max(rolagemNoCarro.get(chave) ?? 0, e.rolagem ?? 0));
    }
  });
  leads.forEach((l) => {
    const v = l.veiculo_id ? veiculoPorId.get(l.veiculo_id) : null;
    if (v) carro(v.slug).leads++;
  });

  const listaCarros = Array.from(carros.values())
    .map((c) => ({
      slug: c.slug,
      veiculo: veiculoPorSlug.get(c.slug) ?? null,
      paginas: c.paginas,
      visitantes: c.visitantes.size,
      whatsapp: c.whatsapp.size,
      leads: c.leads,
      segundosMedios: c.paginas ? c.segundos / c.paginas : 0,
    }))
    .sort((a, b) => b.paginas - a.paginas || b.leads - a.leads);

  const vistos = new Set(listaCarros.filter((c) => c.paginas > 0).map((c) => c.slug));
  const semVisita = veiculos.filter((v) =>
    v.publicado !== false
    && (!v.status || v.status === "disponivel" || v.status === "reservado")
    && !vistos.has(v.slug));

  const leiturasDeCarro = Array.from(rolagemNoCarro.values());
  const paginasDeCarro = listaCarros.reduce((s, c) => s + c.paginas, 0);

  /* ---------- canais e campanhas ---------- */

  const canais = contarPessoas();
  const contatosPorCanal = contarPessoas();
  const campanhas = contarPessoas();
  const contatosPorCampanha = contarPessoas();
  atual.forEach((v) => {
    canais.somar(v.origem || "direto", v.visitante);
    if (v.campanha) campanhas.somar(v.campanha, v.visitante);
  });
  contatos.forEach((e) => {
    const origem = visitaDeOrigem(e.visitante, tempo(e.criado_em));
    contatosPorCanal.somar(origem?.origem || "direto", e.visitante);
    if (origem?.campanha) contatosPorCampanha.somar(origem.campanha, e.visitante);
  });
  const listaCanais = Array.from(canais.mapa.keys())
    .map((nome) => ({ nome, visitantes: canais.total(nome), contatos: contatosPorCanal.total(nome) }))
    .sort((a, b) => b.visitantes - a.visitantes);
  const listaCampanhas = Array.from(campanhas.mapa.keys())
    .map((nome) => ({ nome, visitantes: campanhas.total(nome), contatos: contatosPorCampanha.total(nome) }))
    .sort((a, b) => b.visitantes - a.visitantes);

  /* ---------- buscas e filtros ---------- */

  // "hil" digitado com pausa e depois "hilux" é uma busca só: some o termo
  // que for começo de outro termo da mesma pessoa.
  const termosPorPessoa = new Map<string, Map<string, { achados: number; quando: number }>>();
  eventos.filter((e) => e.tipo === "busca" && e.rotulo).forEach((e) => {
    const termo = normalizarTermo(e.rotulo!);
    if (termo.length < 2) return;
    let termos = termosPorPessoa.get(e.visitante);
    if (!termos) termosPorPessoa.set(e.visitante, (termos = new Map()));
    const quando = tempo(e.criado_em);
    const antes = termos.get(termo);
    if (!antes || quando >= antes.quando) termos.set(termo, { achados: numero(e.valor), quando });
  });
  const buscas = new Map<string, { vezes: number; achados: number; quando: number }>();
  termosPorPessoa.forEach((termos) => {
    const lista = Array.from(termos.keys());
    termos.forEach((info, termo) => {
      if (lista.some((outro) => outro !== termo && outro.startsWith(termo))) return;
      const b = buscas.get(termo);
      if (!b) buscas.set(termo, { vezes: 1, ...info });
      else {
        b.vezes++;
        if (info.quando > b.quando) { b.achados = info.achados; b.quando = info.quando; }
      }
    });
  });
  const listaBuscas = Array.from(buscas.entries())
    .map(([termo, b]) => ({ termo, vezes: b.vezes, achados: b.achados }))
    .sort((a, b) => b.vezes - a.vezes || a.termo.localeCompare(b.termo, "pt-BR"));

  const filtros = contarPessoas();
  eventos.filter((e) => e.tipo === "filtro" && e.rotulo).forEach((e) => filtros.somar(e.rotulo!, e.visitante));
  const listaFiltros = Array.from(filtros.mapa.keys())
    .map((rotulo) => ({ rotulo, pessoas: filtros.total(rotulo) }))
    .sort((a, b) => b.pessoas - a.pessoas);

  /* ---------- quando acessam ---------- */

  const horarios = DIAS_SEMANA.map(() => Array<number>(24).fill(0));
  atual.forEach((v) => {
    const d = new Date(v.criado_em);
    horarios[(d.getDay() + 6) % 7][d.getHours()]++;
  });
  let pico: { dia: number; hora: number; paginas: number } | null = null;
  horarios.forEach((linha, dia) => linha.forEach((paginas, hora) => {
    if (paginas && (!pico || paginas > pico.paginas)) pico = { dia, hora, paginas };
  }));

  /* ---------- aparelho e volta ---------- */

  const aparelhoDaPessoa = new Map<string, string>();
  eventos.forEach((e) => { if (e.dispositivo) aparelhoDaPessoa.set(e.visitante, e.dispositivo); });
  const aparelhos = new Map<string, number>();
  aparelhoDaPessoa.forEach((a) => aparelhos.set(a, (aparelhos.get(a) ?? 0) + 1));
  const listaAparelhos = Array.from(aparelhos.entries())
    .map(([nome, pessoasNoAparelho]) => ({ nome, pessoas: pessoasNoAparelho }))
    .sort((a, b) => b.pessoas - a.pessoas);

  // Quem abriu o site em dois dias diferentes (contando o período anterior):
  // em carro, quem volta para olhar de novo é quem está perto de comprar.
  let voltaram = 0;
  visitantesAtuais.forEach((visitante) => {
    const diasDistintos = new Set((visitasPorPessoa.get(visitante) ?? []).map((v) => chaveDia(new Date(v.criado_em))));
    if (diasDistintos.size > 1) voltaram++;
  });

  /* ---------- páginas ---------- */

  const paginas = new Map<string, { paginas: number; visitantes: Set<string> }>();
  atual.forEach((v) => {
    const chave = slugDoCaminho(v.caminho) ? "/veiculo/" : v.caminho;
    let p = paginas.get(chave);
    if (!p) paginas.set(chave, (p = { paginas: 0, visitantes: new Set() }));
    p.paginas++;
    p.visitantes.add(v.visitante);
  });
  const listaPaginas = Array.from(paginas.entries())
    .map(([caminho, p]) => ({ caminho, paginas: p.paginas, visitantes: p.visitantes.size }))
    .sort((a, b) => b.paginas - a.paginas);

  /* ---------- formulários e ações ---------- */

  const comecaram = contarPessoas();
  const enviaram = contarPessoas();
  eventos.forEach((e) => {
    if (!e.rotulo || !NOMES_FORMULARIO[e.rotulo]) return;
    if (e.tipo === "formulario") comecaram.somar(e.rotulo, e.visitante);
    if (e.tipo === "lead") enviaram.somar(e.rotulo, e.visitante);
  });
  const formularios = Object.keys(NOMES_FORMULARIO)
    .map((chave) => ({ chave, nome: NOMES_FORMULARIO[chave], comecaram: comecaram.total(chave), enviaram: enviaram.total(chave) }))
    .filter((f) => f.comecaram || f.enviaram);

  // O clique no banner também chega como "lead", mas é ida ao WhatsApp, não
  // formulário — já está contado no whatsapp.
  const acoes = contarPessoas();
  eventos.forEach((e) => {
    if (e.tipo === "leitura" || (e.tipo === "lead" && e.rotulo === "banner")) return;
    acoes.somar(e.tipo, e.visitante);
  });

  const segundosTotais = eventos.reduce((s, e) => (e.tipo === "leitura" ? s + numero(e.valor) : s), 0);
  const cliquesWhatsapp = eventos.filter((e) => e.tipo === "whatsapp").length;

  return {
    visitantes,
    visitantesAntes: pessoas(anterior).size,
    paginas: atual.length,
    paginasAntes: anterior.length,
    cliquesWhatsapp,
    contatos: pessoasQueContataram.size,
    segundosPorVisitante: visitantes ? segundosTotais / visitantes : 0,
    porDia: porDia.map((d) => ({
      dia: d.dia, paginas: d.paginas, visitantes: d.visitantes.size, contatos: d.contatos.size,
    })),
    funil: { visitantes, viramCarro: viramCarro.size, contataram: pessoasQueContataram.size },
    carros: listaCarros,
    semVisita,
    leituraCarros: {
      segundosMedios: paginasDeCarro ? segundosEmCarros / paginasDeCarro : 0,
      chegaramAoFim: leiturasDeCarro.length
        ? (leiturasDeCarro.filter((r) => r >= 90).length / leiturasDeCarro.length) * 100 : null,
    },
    canais: listaCanais,
    campanhas: listaCampanhas,
    buscas: listaBuscas,
    filtros: listaFiltros,
    horarios,
    pico: pico as { dia: number; hora: number; paginas: number } | null,
    aparelhos: listaAparelhos,
    pessoasComAparelho: aparelhoDaPessoa.size,
    voltaram,
    paginasMaisVistas: listaPaginas,
    formularios,
    acoes: {
      whatsapp: acoes.total("whatsapp"),
      telefone: acoes.total("telefone"),
      rota: acoes.total("rota"),
      galeria: acoes.total("galeria"),
      lead: acoes.total("lead"),
      instagram: acoes.total("instagram"),
    },
  };
}

export type Analise = ReturnType<typeof analisar>;

/* ---------------------------------------------------------------- */
/*  Busca paginada                                                    */
/* ---------------------------------------------------------------- */

type Erro = { message: string; code?: string };
type Pagina<T> = PromiseLike<{ data: T[] | null; error: Erro | null; count?: number | null }>;

/** Teto de linhas por consulta: sobra para o volume de uma loja. Se um dia
 * encostar nele, o painel avisa e esconde a comparação com o período anterior. */
export const TETO_LINHAS = 60_000;

/**
 * O Supabase devolve no máximo 1.000 linhas por pedido (é o padrão do
 * projeto), por mais que a consulta peça mais. Esta função pede de página em
 * página até trazer tudo. A primeira resposta diz o total e o tamanho real da
 * página, e o resto vem em lotes paralelos.
 *
 * A consulta precisa ter fim fixo no tempo (lte criado_em) e ordem estável,
 * senão uma visita que chega no meio empurra as páginas e duplica linha.
 */
export async function buscarTudo<T>(
  consulta: (de: number, ate: number, contar: boolean) => Pagina<T>,
  teto = TETO_LINHAS,
): Promise<{ linhas: T[]; erro: Erro | null; cortado: boolean }> {
  const primeira = await consulta(0, 999, true);
  if (primeira.error) return { linhas: [], erro: primeira.error, cortado: false };

  const linhas = [...(primeira.data ?? [])];
  const total = primeira.count ?? linhas.length;
  const passo = linhas.length;
  if (!passo || total <= passo) return { linhas, erro: null, cortado: false };

  const alvo = Math.min(total, teto);
  const inicios: number[] = [];
  for (let de = passo; de < alvo; de += passo) inicios.push(de);

  const LOTE = 6;
  for (let i = 0; i < inicios.length; i += LOTE) {
    const respostas = await Promise.all(inicios.slice(i, i + LOTE)
      .map((de) => consulta(de, Math.min(de + passo, alvo) - 1, false)));
    const falha = respostas.find((r) => r.error)?.error;
    if (falha) return { linhas: [], erro: falha, cortado: false };
    respostas.forEach((r) => linhas.push(...(r.data ?? [])));
  }
  return { linhas, erro: null, cortado: total > teto };
}

/** A tabela "eventos" ainda não existe no banco (script não rodado). */
export const tabelaAusente = (erro: Erro | null) =>
  !!erro && (erro.code === "42P01" || erro.code === "PGRST205"
    || /does not exist|could not find the table/i.test(erro.message));

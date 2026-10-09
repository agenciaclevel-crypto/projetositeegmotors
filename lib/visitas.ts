/**
 * Registro de acesso e de comportamento no site — alimenta a aba "Análises"
 * do painel.
 *
 * Fica de propósito no nosso banco, e não no Google Analytics: assim o dono
 * da loja vê visita, carro mais visto, clique no WhatsApp e lead na mesma
 * tela, sem precisar entrar em outra ferramenta. O GA4 continua existindo
 * para a agência.
 *
 * Duas tabelas: "visitas" conta cada página aberta (migracao-visitas.sql) e
 * "eventos" guarda o que a pessoa fez nela (migracao-comportamento.sql).
 *
 * Nada aqui identifica pessoa: o "visitante" é um número aleatório guardado
 * no navegador, só para separar quem voltou de quem chegou agora.
 */

import { supabase } from "./supabase";

const CHAVE_VISITANTE = "egm_visitante";
const CHAVE_ORIGEM = "egm_origem";
const CHAVE_UTM = "egm_utm";

/** Usado quando o navegador bloqueia storage (aba anônima com restrição,
 * cookies desligados): vale só enquanto a aba estiver aberta. */
const IDS_DA_MEMORIA: { visitante?: string } = {};

const aleatorio = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `v${Date.now()}${Math.random().toString(36).slice(2, 10)}`;

function idVisitante() {
  try {
    let id = localStorage.getItem(CHAVE_VISITANTE);
    if (!id) {
      id = aleatorio();
      localStorage.setItem(CHAVE_VISITANTE, id);
    }
    return id;
  } catch {
    if (!IDS_DA_MEMORIA.visitante) IDS_DA_MEMORIA.visitante = aleatorio();
    return IDS_DA_MEMORIA.visitante;
  }
}

/** Área da loja não é visita de cliente. */
const areaDaLoja = (caminho: string) =>
  caminho.startsWith("/painel") || caminho.startsWith("/login");

/** Sites que valem a pena aparecer com nome próprio no relatório. */
const CANAIS: [RegExp, string][] = [
  [/instagram|ig\.me/i, "instagram"],
  [/facebook|fb\.com|fb\.me/i, "facebook"],
  [/whatsapp|wa\.me/i, "whatsapp"],
  [/google/i, "google"],
  [/bing|duckduckgo|yahoo|ecosia/i, "busca"],
  [/olx|webmotors|mobiauto|icarros|karvi|usadosbr/i, "portais"],
  [/youtube/i, "youtube"],
  [/tiktok/i, "tiktok"],
  [/linkedin/i, "linkedin"],
];

function detectarOrigem() {
  try {
    const utm = new URLSearchParams(window.location.search).get("utm_source");
    if (utm) return utm.toLowerCase().slice(0, 40);

    const referencia = document.referrer;
    if (!referencia) return "direto";

    const host = new URL(referencia).hostname;
    if (host === window.location.hostname) return "interno";
    for (const [padrao, nome] of CANAIS) if (padrao.test(host)) return nome;
    return host.replace(/^www\./, "").slice(0, 60);
  } catch {
    return "direto";
  }
}

/** A origem é da visita inteira, não de cada página: quem chegou pelo
 * Instagram e navegou por cinco carros veio do Instagram nas cinco. */
function origemDaSessao() {
  try {
    const guardada = sessionStorage.getItem(CHAVE_ORIGEM);
    if (guardada) return guardada;
    const detectada = detectarOrigem();
    const valor = detectada === "interno" ? "direto" : detectada;
    sessionStorage.setItem(CHAVE_ORIGEM, valor);
    return valor;
  } catch {
    const detectada = detectarOrigem();
    return detectada === "interno" ? "direto" : detectada;
  }
}

/** Guarda os utm do anúncio que trouxe a visita, se houver. */
function utmDaSessao() {
  try {
    const guardado = sessionStorage.getItem(CHAVE_UTM);
    if (guardado) return JSON.parse(guardado) as Record<string, string> | null;

    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    for (const campo of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
      const valor = params.get(campo);
      if (valor) utm[campo] = valor.slice(0, 120);
    }
    const resultado = Object.keys(utm).length ? utm : null;
    sessionStorage.setItem(CHAVE_UTM, JSON.stringify(resultado));
    return resultado;
  } catch {
    return null;
  }
}

/** Grava um acesso. Silencioso em qualquer falha — contagem de visita nunca
 * pode atrapalhar quem está olhando carro. */
export async function registrarVisita(lojaId: string, caminho: string) {
  if (typeof window === "undefined" || !lojaId) return;
  if (areaDaLoja(caminho)) return;

  try {
    await supabase.from("visitas").insert({
      loja_id: lojaId,
      visitante: idVisitante(),
      caminho: caminho.slice(0, 300),
      origem: origemDaSessao(),
      utm: utmDaSessao(),
    });
  } catch {
    /* ignora */
  }
}

/* ---------------------------------------------------------------- */
/*  Comportamento: o que a pessoa faz depois que a página abre       */
/* ---------------------------------------------------------------- */

export type TipoEvento =
  | "leitura" | "whatsapp" | "telefone" | "rota" | "instagram"
  | "formulario" | "lead" | "busca" | "filtro" | "galeria";

type DadosEvento = {
  caminho?: string;
  rotulo?: string | null;
  valor?: number | null;
  rolagem?: number | null;
};

/** Definida pelo RegistroVisita assim que o site abre: os componentes
 * registram ação sem precisar receber o id da loja. */
let lojaAtual = "";
export function definirLoja(lojaId: string) {
  lojaAtual = lojaId;
}

/** Fica falso quando o banco responde que a tabela não existe (script
 * migracao-comportamento.sql ainda não rodado): para de tentar até a
 * próxima vez que o site for aberto. */
let eventosLigados = true;

const ENDERECO_EVENTOS = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/eventos`;
const CHAVE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

let aparelho: string | null | undefined;
/** Celular, tablet ou computador — pela tela e pelo tipo de toque, sem
 * guardar modelo nem navegador. */
function dispositivo() {
  if (aparelho !== undefined) return aparelho;
  try {
    const toque = window.matchMedia("(pointer: coarse)").matches;
    aparelho = !toque ? "computador"
      : Math.min(window.screen.width, window.screen.height) < 600 ? "celular" : "tablet";
  } catch {
    aparelho = null;
  }
  return aparelho;
}

/** Vai por fetch direto, e não pelo cliente do Supabase, para poder usar
 * keepalive: o tempo de leitura é enviado quando a pessoa sai da página, e
 * sem isso o navegador corta o envio no meio. Se o navegador recusar o
 * keepalive, tenta de novo do jeito comum. */
function enviar(linha: Record<string, unknown>) {
  const pedido = (keepalive: boolean) =>
    fetch(ENDERECO_EVENTOS, {
      method: "POST",
      keepalive,
      headers: {
        apikey: CHAVE_ANON,
        Authorization: `Bearer ${CHAVE_ANON}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(linha),
    }).then((resposta) => {
      if (resposta.status === 404) eventosLigados = false;
    });

  try {
    pedido(true).catch(() => pedido(false).catch(() => {}));
  } catch {
    /* ignora */
  }
}

/** Grava uma ação do visitante. Silencioso em qualquer falha, como a visita. */
export function registrarEvento(tipo: TipoEvento, dados: DadosEvento = {}) {
  if (typeof window === "undefined" || !lojaAtual || !eventosLigados) return;
  const caminho = dados.caminho ?? window.location.pathname;
  if (areaDaLoja(caminho)) return;

  const valor = dados.valor != null && Number.isFinite(dados.valor)
    ? Math.min(Math.max(Math.round(dados.valor), 0), 100_000_000) : null;
  const rolagem = dados.rolagem != null && Number.isFinite(dados.rolagem)
    ? Math.min(Math.max(Math.round(dados.rolagem), 0), 100) : null;

  enviar({
    loja_id: lojaAtual,
    visitante: idVisitante(),
    caminho: caminho.slice(0, 300),
    tipo,
    rotulo: dados.rotulo ? dados.rotulo.slice(0, 120) : null,
    valor,
    rolagem,
    dispositivo: dispositivo(),
  });
}

const jaRegistrados = new Set<string>();
/** Para ação que só interessa uma vez por página: "passou as fotos",
 * "começou o formulário". Vinte cliques na galeria continuam sendo uma
 * pessoa interessada nas fotos. */
export function registrarUmaVez(tipo: TipoEvento, rotulo?: string) {
  if (typeof window === "undefined") return;
  const chave = `${window.location.pathname}|${tipo}|${rotulo ?? ""}`;
  if (jaRegistrados.has(chave)) return;
  jaRegistrados.add(chave);
  registrarEvento(tipo, { rotulo });
}

/** Links de saída que contam como contato com a loja. */
const DESTINOS: [RegExp, TipoEvento][] = [
  [/wa\.me|whatsapp\.com/i, "whatsapp"],
  [/^tel:/i, "telefone"],
  [/google\.[^/]+\/maps|maps\.google|maps\.app\.goo/i, "rota"],
  [/instagram\.com/i, "instagram"],
];

/** Ligado no documento inteiro: qualquer botão de WhatsApp, telefone ou
 * rota conta, inclusive os que forem criados depois. O "onde estava o
 * botão" vem do atributo data-rastreio do link (ou de quem o envolve). */
export function registrarClique(evento: MouseEvent) {
  const alvo = evento.target as Element | null;
  const link = alvo?.closest?.("a[href]");
  if (!link) return;
  const href = link.getAttribute("href") ?? "";
  const tipo = DESTINOS.find(([padrao]) => padrao.test(href))?.[1];
  if (!tipo) return;

  const local = link.closest("[data-rastreio]")?.getAttribute("data-rastreio");
  const texto = (link.getAttribute("aria-label") || link.textContent || "").trim();
  registrarEvento(tipo, { rotulo: (local || texto || "link").slice(0, 60) });
}

/** Primeiro toque em qualquer campo de um bloco marcado com
 * data-formulario="nome". Comparado com os envios, mostra onde o cliente
 * desiste no meio do caminho. */
export function registrarInteracaoFormulario(evento: Event) {
  const alvo = evento.target as Element | null;
  const formulario = alvo?.closest?.("[data-formulario]")?.getAttribute("data-formulario");
  if (formulario) registrarUmaVez("formulario", formulario);
}

/** Uma aba esquecida aberta não pode virar "leu por três horas": o tempo só
 * corre com a página visível e com algum movimento no último minuto. */
const INATIVIDADE_MS = 60_000;
const TETO_LEITURA_S = 1800;

/**
 * Mede quanto tempo a página fica aberta e em uso, e até onde a pessoa rolou.
 * Envia ao sair (troca de página, troca de aba ou de aplicativo) e devolve a
 * função que encerra a medição.
 */
export function medirLeitura(caminho: string) {
  if (typeof window === "undefined" || areaDaLoja(caminho)) return () => {};

  let segundos = 0;
  let rolagem = 0;
  let ultimaAtividade = Date.now();

  const atividade = () => { ultimaAtividade = Date.now(); };

  const medirRolagem = () => {
    atividade();
    const util = document.documentElement.scrollHeight - window.innerHeight;
    const agora = util > 0 ? (window.scrollY / util) * 100 : 100;
    rolagem = Math.max(rolagem, Math.min(100, Math.round(agora)));
  };

  const relogio = window.setInterval(() => {
    if (document.visibilityState === "visible" && Date.now() - ultimaAtividade < INATIVIDADE_MS) {
      segundos++;
    }
  }, 1000);

  // Zera depois de enviar: se a pessoa volta para a aba, a próxima saída
  // manda só o tempo novo, e o painel soma os dois.
  const enviarLeitura = () => {
    if (segundos < 1) return;
    registrarEvento("leitura", { caminho, valor: Math.min(segundos, TETO_LEITURA_S), rolagem });
    segundos = 0;
  };

  const aoMudarVisibilidade = () => {
    if (document.visibilityState === "hidden") enviarLeitura();
    else atividade();
  };

  const sinaisDeAtividade = ["pointerdown", "pointermove", "keydown", "touchstart"] as const;
  sinaisDeAtividade.forEach((s) => window.addEventListener(s, atividade, { passive: true }));
  window.addEventListener("scroll", medirRolagem, { passive: true });
  document.addEventListener("visibilitychange", aoMudarVisibilidade);
  window.addEventListener("pagehide", enviarLeitura);
  // página curta, que cabe inteira na tela, conta como lida até o fim
  const primeiraMedida = window.setTimeout(medirRolagem, 1200);

  return () => {
    enviarLeitura();
    window.clearInterval(relogio);
    window.clearTimeout(primeiraMedida);
    sinaisDeAtividade.forEach((s) => window.removeEventListener(s, atividade));
    window.removeEventListener("scroll", medirRolagem);
    document.removeEventListener("visibilitychange", aoMudarVisibilidade);
    window.removeEventListener("pagehide", enviarLeitura);
  };
}

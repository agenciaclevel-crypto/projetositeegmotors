/**
 * Registro de acesso ao site — alimenta a aba "Acessos" do painel.
 *
 * Fica de propósito no nosso banco, e não no Google Analytics: assim o dono
 * da loja vê visita, carro mais visto e lead na mesma tela, sem precisar
 * entrar em outra ferramenta. O GA4 continua existindo para a agência.
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
  // área da loja não é visita de cliente
  if (caminho.startsWith("/painel") || caminho.startsWith("/login")) return;

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

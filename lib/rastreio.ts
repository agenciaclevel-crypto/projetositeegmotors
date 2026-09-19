/**
 * Google Analytics 4 e os eventos de conversão do site.
 *
 * ATENÇÃO ao replicar este site para outra loja: troque o ID abaixo pela
 * medição da loja nova (e o pixel em lib/pixel.ts), senão os dados do novo
 * cliente caem na conta da EG Motors. Deixe vazio ("") para não carregar.
 */

import { eventoPixel } from "./pixel";

export const GA_ID: string = "G-Y02WZDZE08";

/**
 * Para onde vai o botão "Abrir no Google Analytics" do painel. O endereço
 * genérico abre a última propriedade que a pessoa acessou, o que resolve na
 * prática. Se quiser cair direto no relatório desta loja, troque pelo link
 * completo que aparece na barra do navegador com o GA4 aberto — ele tem o
 * número da propriedade, algo como .../web/#/p123456789/reports/intelligenthome
 */
export const GA_RELATORIO = "https://analytics.google.com/analytics/web/";

declare global {
  interface Window {
    gtag?: (...argumentos: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

/** Dispara um evento no Google Analytics. Silencioso se o gtag não carregou. */
export function eventoGA(evento: string, dados?: Record<string, unknown>) {
  if (typeof window === "undefined" || !GA_ID) return;
  try {
    window.gtag?.("event", evento, dados);
  } catch {
    /* ignora: rastreamento nunca pode atrapalhar o site */
  }
}

/**
 * Conversão do site: alguém preencheu um formulário. Avisa o pixel da Meta
 * ("Lead") e o Google Analytics ("generate_lead") de uma vez só, para as
 * campanhas dos dois lados poderem otimizar por lead em vez de tráfego.
 */
export function eventoLead(dados: { nome: string; categoria: string; valor?: number }) {
  const valor = dados.valor ? { value: dados.valor, currency: "BRL" } : {};

  eventoPixel("Lead", {
    content_name: dados.nome,
    content_category: dados.categoria,
    ...valor,
  });

  eventoGA("generate_lead", {
    item_name: dados.nome,
    lead_source: dados.categoria,
    ...valor,
  });
}

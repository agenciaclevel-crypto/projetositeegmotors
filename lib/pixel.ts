/**
 * Meta Pixel (anúncios do Facebook e Instagram).
 *
 * ATENÇÃO ao replicar este site para outra loja: troque o ID abaixo pelo
 * pixel da loja nova, senão os eventos dela caem no pixel da EG Motors.
 * Deixe vazio ("") para não carregar pixel nenhum.
 */
export const PIXEL_META: string = "1111162774934147";

type Fbq = (acao: string, evento: string, dados?: Record<string, unknown>) => void;

declare global {
  interface Window {
    fbq?: Fbq;
  }
}

/**
 * Dispara um evento no pixel. Silencioso se o pixel não carregou — bloqueador
 * de anúncio, pixel desligado, conexão ruim — porque rastreamento nunca pode
 * derrubar o formulário do cliente.
 */
export function eventoPixel(evento: string, dados?: Record<string, unknown>) {
  if (typeof window === "undefined" || !PIXEL_META) return;
  try {
    window.fbq?.("track", evento, dados);
  } catch {
    /* ignora: o lead já foi salvo, o pixel é secundário */
  }
}

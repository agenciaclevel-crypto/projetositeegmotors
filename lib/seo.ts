/**
 * SEO regional (local SEO).
 *
 * Tudo que o Google usa pra entender "esta loja fica em tal cidade e atende
 * tal região" sai daqui: dados estruturados da loja, endereço completo e a
 * lista de cidades atendidas.
 *
 * Os dados vêm da tabela `lojas` — nada é escrito na mão — com uma exceção
 * marcada abaixo (CIDADES_ATENDIDAS), que muda de loja para loja.
 */

import { digitosNacionais, type Loja } from "./supabase";

/** Ajuste por loja: cidades vizinhas que a loja atende de fato. Entram no
 * texto da home e nos dados estruturados. Não invente cidades onde a loja
 * não vende — isso não ajuda e ainda gera visita perdida. */
export const CIDADES_ATENDIDAS = [
  "Parnamirim",
  "São Gonçalo do Amarante",
  "Macaíba",
  "Extremoz",
];

const UFS: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia",
  CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
  MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí",
  RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul",
  RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo",
  SE: "Sergipe", TO: "Tocantins",
};

export const siteUrl = () =>
  (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

/** "Natal/RN" — usado em títulos e textos. */
export const regiaoCurta = (loja: Loja) =>
  [loja.cidade, loja.uf].filter(Boolean).join("/");

/** "Rio Grande do Norte" a partir de "RN". */
export const nomeDoEstado = (uf: string | null) =>
  (uf && UFS[uf.toUpperCase()]) || uf || "";

/** Endereço completo, no mesmo formato em todo lugar do site — o Google
 * compara isso com o Google Meu Negócio e com os portais. */
export const enderecoCompleto = (loja: Loja) =>
  [
    loja.endereco,
    loja.bairro,
    [loja.cidade, loja.uf].filter(Boolean).join(" - "),
  ].filter(Boolean).join(", ");

export const telefoneE164 = (loja: Loja) => {
  const d = digitosNacionais(loja.whatsapp);
  return d.length >= 10 ? `+55${d}` : undefined;
};

export const urlInstagram = (loja: Loja) => {
  const i = (loja.instagram ?? "").trim();
  if (!i) return null;
  if (i.startsWith("http")) return i;
  return `https://instagram.com/${i.replace(/^@/, "")}`;
};

/** Lê "Seg a Sex, 08h às 18h" e devolve ["08:00", "18:00"]. Se não conseguir
 * entender o texto, devolve null — melhor não declarar horário nenhum do que
 * declarar horário errado pro Google. */
function faixaHoraria(texto: string | null | undefined): [string, string] | null {
  const achados = [...(texto ?? "").matchAll(/(\d{1,2})\s*h\s*(\d{2})?/gi)];
  if (achados.length < 2) return null;
  const formata = (m: RegExpMatchArray) =>
    `${m[1].padStart(2, "0")}:${(m[2] ?? "00").padStart(2, "0")}`;
  return [formata(achados[0]), formata(achados[1])];
}

function horarios(loja: Loja) {
  const lista: Record<string, unknown>[] = [];
  const semana = faixaHoraria(loja.horario_semana);
  const sabado = faixaHoraria(loja.horario_sabado);

  if (semana) {
    lista.push({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: semana[0],
      closes: semana[1],
    });
  }
  if (sabado) {
    lista.push({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Saturday"],
      opens: sabado[0],
      closes: sabado[1],
    });
  }
  return lista;
}

/** Endereço no formato que o Google lê (schema.org/PostalAddress). */
export function enderecoEstruturado(loja: Loja) {
  return {
    "@type": "PostalAddress",
    streetAddress: [loja.endereco, loja.bairro].filter(Boolean).join(" - "),
    addressLocality: loja.cidade ?? undefined,
    addressRegion: loja.uf ?? undefined,
    addressCountry: "BR",
  };
}

/** Ficha da loja pro Google: quem é, onde fica, quando abre, o que atende.
 * É o principal sinal de SEO regional que sai do código — o resto é Google
 * Meu Negócio e citações em portais. */
export function jsonLdLoja(loja: Loja) {
  const base = siteUrl();
  const telefone = telefoneE164(loja);
  const instagram = urlInstagram(loja);
  const estado = nomeDoEstado(loja.uf);

  return {
    "@context": "https://schema.org",
    "@type": "AutoDealer",
    "@id": `${base}/#loja`,
    name: loja.nome,
    url: base,
    ...(loja.slogan ? { description: loja.slogan } : {}),
    ...(loja.logo_claro_url ? { logo: loja.logo_claro_url, image: loja.logo_claro_url } : {}),
    ...(telefone ? { telephone: telefone } : {}),
    address: enderecoEstruturado(loja),
    openingHoursSpecification: horarios(loja),
    areaServed: [
      ...(loja.cidade ? [{ "@type": "City", name: loja.cidade }] : []),
      ...CIDADES_ATENDIDAS.map((c) => ({ "@type": "City", name: c })),
      ...(estado ? [{ "@type": "AdministrativeArea", name: estado }] : []),
    ],
    ...(instagram ? { sameAs: [instagram] } : {}),
    priceRange: "$$",
    currenciesAccepted: "BRL",
    paymentAccepted: "Dinheiro, Pix, Financiamento, Cartão",
    knowsLanguage: "pt-BR",
  };
}

/** Descrição padrão do site — cai na meta description e no compartilhamento
 * em WhatsApp/redes. Fica em ~155 caracteres, que é o que o Google mostra. */
export function descricaoDaLoja(loja: Loja) {
  const onde = regiaoCurta(loja);
  const bairro = loja.bairro ? `, no ${loja.bairro}` : "";
  return `Loja de carros em ${onde}${bairro}. Novos e seminovos revisados, com laudo cautelar, financiamento e transferência feita na loja.`;
}

/** Monograma da loja pro favicon: "EG Motors" -> "EG", "Garagem 7" -> "GA".
 * Em 16px a logo inteira vira borrão; duas letras continuam legíveis. */
export function monograma(nome: string) {
  const primeira = nome.trim().split(/\s+/).filter(Boolean)[0] ?? "";
  if (!primeira) return "EG";
  return (primeira.length <= 3 ? primeira : primeira.slice(0, 2)).toUpperCase();
}

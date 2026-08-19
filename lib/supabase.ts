import { createClient } from "@supabase/supabase-js";

// Chave anon: só enxerga o que as policies de RLS permitem
// (loja ativa, veículo publicado, banner no ar) e só escreve lead.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/* ---------------------------------------------------------------- */
/*  Tipos                                                            */
/* ---------------------------------------------------------------- */

export type Loja = {
  id: string;
  nome: string;
  slug: string;
  dominio: string | null;
  logo_claro_url: string | null;
  cor_marca: string;
  slogan: string | null;
  whatsapp: string | null;
  instagram: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  horario_semana: string;
  horario_sabado: string;
};

export type Foto = {
  url: string;
  url_thumb: string | null;
  ordem: number;
  capa: boolean;
};

export type Veiculo = {
  id: string;
  slug: string;
  marca: string;
  modelo: string;
  versao: string | null;
  ano_fabricacao: number;
  ano_modelo: number;
  km: number;
  cambio: string | null;
  combustivel: string | null;
  motor: string | null;
  potencia_cv: number | null;
  cor: string | null;
  carroceria: string | null;
  portas: number;
  condicao: "novo" | "seminovo";
  preco: number;
  preco_de: number | null;
  opcionais: string[];
  observacoes: string | null;
  laudo_cautelar: boolean;
  unico_dono: boolean;
  destaque: boolean;
  veiculo_fotos: Foto[];
};

export type Banner = {
  id: string;
  titulo: string | null;
  legenda: string | null;
  imagem_url: string;
  imagem_mobile_url: string | null;
  link: string | null;
  ativo?: boolean;
  ordem?: number;
};

const CAMPOS_VEICULO = `
  id, slug, marca, modelo, versao, ano_fabricacao, ano_modelo, km,
  cambio, combustivel, motor, potencia_cv, cor, carroceria, portas,
  condicao, preco, preco_de, opcionais, observacoes,
  laudo_cautelar, unico_dono, destaque,
  veiculo_fotos ( url, url_thumb, ordem, capa )
`;

/* ---------------------------------------------------------------- */
/*  Queries                                                          */
/* ---------------------------------------------------------------- */

// O slug da loja vem do domínio, no middleware. Em dev, cai no .env.
export async function getLoja(slug = process.env.NEXT_PUBLIC_LOJA_SLUG!) {
  const { data, error } = await supabase
    .from("lojas")
    .select("*")
    .eq("slug", slug)
    .single();
  if (error) throw error;
  return data as Loja;
}

export type FiltrosVitrine = {
  marca?: string;
  condicao?: "novo" | "seminovo";
  cambio?: string;
  precoMax?: number;
  busca?: string;
  ordem?: "destaque" | "menor" | "maior" | "km";
};

export async function getVeiculos(lojaId: string, f: FiltrosVitrine = {}) {
  let q = supabase
    .from("veiculos")
    .select(CAMPOS_VEICULO)
    .eq("loja_id", lojaId)
    .eq("publicado", true)
    .in("status", ["disponivel", "reservado"]);

  if (f.marca) q = q.eq("marca", f.marca);
  if (f.condicao) q = q.eq("condicao", f.condicao);
  if (f.cambio) q = q.eq("cambio", f.cambio);
  if (f.precoMax) q = q.lte("preco", f.precoMax);
  if (f.busca) {
    const t = `%${f.busca}%`;
    q = q.or(`marca.ilike.${t},modelo.ilike.${t},versao.ilike.${t}`);
  }

  if (f.ordem === "menor") q = q.order("preco", { ascending: true });
  else if (f.ordem === "maior") q = q.order("preco", { ascending: false });
  else if (f.ordem === "km") q = q.order("km", { ascending: true });
  else q = q.order("destaque", { ascending: false }).order("criado_em", { ascending: false });

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as Veiculo[];
}

export async function getVeiculo(lojaId: string, slug: string) {
  const { data, error } = await supabase
    .from("veiculos")
    .select(CAMPOS_VEICULO)
    .eq("loja_id", lojaId)
    .eq("slug", slug)
    .eq("publicado", true)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as Veiculo | null;
}

export async function getBanners(lojaId: string) {
  const hoje = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("banners")
    .select("id, titulo, legenda, imagem_url, imagem_mobile_url, link")
    .eq("loja_id", lojaId)
    .eq("ativo", true)
    .or(`inicia_em.is.null,inicia_em.lte.${hoje}`)
    .or(`termina_em.is.null,termina_em.gte.${hoje}`)
    .order("ordem");
  if (error) throw error;
  return (data ?? []) as Banner[];
}

export async function criarLead(input: {
  loja_id: string;
  nome: string;
  telefone: string;
  email?: string;
  tipo?: "compra" | "reposicao";
  origem?: string;
  veiculo_id?: string | null;
  mensagem?: string;
  veiculo_troca?: Record<string, unknown> | null;
  utm?: Record<string, string> | null;
}) {
  const { error } = await supabase.from("leads").insert({
    tipo: "compra",
    origem: "site",
    ...input,
  });
  if (error) throw error;
}

/* ---------------------------------------------------------------- */
/*  Helpers                                                          */
/* ---------------------------------------------------------------- */

export const brl = (n: number) =>
  n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

export const formatKm = (n: number) =>
  n === 0 ? "0 km" : `${n.toLocaleString("pt-BR")} km`;

export const capaDe = (v: Veiculo) => {
  const fotos = [...(v.veiculo_fotos ?? [])].sort((a, b) => a.ordem - b.ordem);
  return fotos.find((f) => f.capa) ?? fotos[0] ?? null;
};

export const linkWhatsApp = (loja: Loja, texto: string) =>
  `https://wa.me/${(loja.whatsapp ?? "").replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`;

// Tira tudo que não é dígito e remove o 55 do país, se vier junto — devolve
// só o DDD + número (10 ou 11 dígitos), pronto pra montar link tel:/wa.me.
export const digitosNacionais = (raw: string | null | undefined) => {
  let d = (raw ?? "").replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return d;
};

// Formata qualquer telefone BR (com ou sem 55, com ou sem pontuação) pro
// padrão de exibição "(84) 99149-7373". Se não reconhecer o formato,
// devolve o texto original em vez de quebrar a tela.
export const formatarTelefone = (raw: string | null | undefined) => {
  if (!raw) return "";
  const d = digitosNacionais(raw);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
};

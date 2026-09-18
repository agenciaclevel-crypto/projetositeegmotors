import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getLoja, getVeiculo, getVeiculos, brl, formatKm, capaDe, linkWhatsApp,
} from "@/lib/supabase";
import { enderecoEstruturado, enderecoCompleto, siteUrl } from "@/lib/seo";
import FormLead from "@/components/FormLead";
import Simulador from "@/components/Simulador";
import GaleriaVeiculo from "@/components/GaleriaVeiculo";

// Revalida a cada 5 min; o webhook do painel força revalidação na hora
// que o carro é vendido. Página estática = carrega rápido e indexa.
export const revalidate = 300;

export async function generateStaticParams() {
  const loja = await getLoja();
  const veiculos = await getVeiculos(loja.id);
  return veiculos.map((v) => ({ slug: v.slug }));
}

export async function generateMetadata({
  params,
}: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const loja = await getLoja();
  const v = await getVeiculo(loja.id, slug);
  if (!v) return { title: "Veículo não encontrado" };

  // Sem o nome da loja no fim: o template do layout já acrescenta
  // "| EG Motors — Natal/RN" em cima disso.
  const titulo = `${v.marca} ${v.modelo} ${v.versao ?? ""} ${v.ano_modelo} — ${brl(v.preco)}`;
  const descricao = `${v.marca} ${v.modelo} ${v.versao ?? ""} ${v.ano_fabricacao}/${v.ano_modelo}, ${formatKm(v.km)}, ${v.cambio}. À venda na ${loja.nome}, em ${enderecoCompleto(loja)}.`;
  const capa = capaDe(v);

  return {
    title: titulo,
    description: descricao,
    openGraph: {
      title: titulo,
      description: descricao,
      images: capa ? [{ url: capa.url }] : [],
      type: "website",
    },
    alternates: { canonical: `/veiculo/${v.slug}` },
  };
}

export default async function PaginaVeiculo({
  params,
}: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const loja = await getLoja();
  const v = await getVeiculo(loja.id, slug);
  if (!v) notFound();

  const fotos = [...(v.veiculo_fotos ?? [])].sort((a, b) => a.ordem - b.ordem);
  const nome = `${v.marca} ${v.modelo} ${v.versao ?? ""}`.trim();

  const base = siteUrl();
  const urlDoCarro = `${base}/veiculo/${v.slug}`;
  const condicao = v.condicao === "novo"
    ? "https://schema.org/NewCondition"
    : "https://schema.org/UsedCondition";

  // A loja aparece aqui de novo (com endereço) porque é o que diz ao Google
  // que este carro está à venda nesta cidade, e não em qualquer lugar.
  const vendedor = {
    "@type": "AutoDealer",
    "@id": `${base}/#loja`,
    name: loja.nome,
    url: base,
    address: enderecoEstruturado(loja),
  };

  // Dados estruturados: é o que faz o preço e a foto aparecerem no Google.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Car",
    name: nome,
    url: urlDoCarro,
    brand: { "@type": "Brand", name: v.marca },
    model: v.modelo,
    vehicleModelDate: String(v.ano_modelo),
    productionDate: String(v.ano_fabricacao),
    mileageFromOdometer: { "@type": "QuantitativeValue", value: v.km, unitCode: "KMT" },
    vehicleTransmission: v.cambio,
    fuelType: v.combustivel,
    color: v.cor,
    numberOfDoors: v.portas,
    itemCondition: condicao,
    ...(v.motor || v.potencia_cv
      ? {
          vehicleEngine: {
            "@type": "EngineSpecification",
            ...(v.motor ? { name: v.motor } : {}),
            ...(v.potencia_cv
              ? { enginePower: { "@type": "QuantitativeValue", value: v.potencia_cv, unitText: "cv" } }
              : {}),
          },
        }
      : {}),
    image: fotos.map((f) => f.url),
    offers: {
      "@type": "Offer",
      url: urlDoCarro,
      price: v.preco,
      priceCurrency: "BRL",
      availability: "https://schema.org/InStock",
      itemCondition: condicao,
      seller: vendedor,
      availableAtOrFrom: vendedor,
      areaServed: { "@type": "City", name: loja.cidade },
    },
  };

  const jsonLdCaminho = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: `Estoque ${loja.cidade}/${loja.uf}`, item: base },
      { "@type": "ListItem", position: 2, name: `${nome} ${v.ano_modelo}`, item: urlDoCarro },
    ],
  };

  const ficha: [string, string][] = [
    ["Ano", `${v.ano_fabricacao}/${v.ano_modelo}`],
    ["Quilometragem", formatKm(v.km)],
    ["Câmbio", v.cambio ?? "—"],
    ["Combustível", v.combustivel ?? "—"],
    ["Motor", v.motor ?? "—"],
    ["Potência", v.potencia_cv ? `${v.potencia_cv} cv` : "—"],
    ["Cor", v.cor ?? "—"],
    ["Carroceria", v.carroceria ?? "—"],
    ["Portas", String(v.portas)],
  ];

  return (
    <main className="mx-auto max-w-[1180px] px-5 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdCaminho) }}
      />

      <Link href="/" className="text-sm text-[#A6A9B2] hover:text-[#F3F0E9]">
        ← Voltar ao estoque
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-5">
        {/* Galeria */}
        <div className="lg:col-span-3">
          <GaleriaVeiculo fotos={fotos} nome={nome} />

          {/* Ficha técnica */}
          <h2 className="mt-10 font-mono text-[11px] tracking-[0.14em] text-[#6E7280]">
            FICHA TÉCNICA
          </h2>
          <div className="mt-4 grid grid-cols-2 overflow-hidden rounded border border-[#2C303A] sm:grid-cols-3">
            {ficha.map(([k, val]) => (
              <div key={k} className="border-b border-r border-[#2C303A] bg-[#20232A] p-4">
                <div className="font-mono text-[9px] tracking-[0.14em] text-[#6E7280]">
                  {k.toUpperCase()}
                </div>
                <div className="mt-1.5 text-sm font-semibold text-[#F3F0E9]">{val}</div>
              </div>
            ))}
          </div>

          {v.opcionais?.length > 0 && (
            <>
              <h2 className="mt-9 font-mono text-[11px] tracking-[0.14em] text-[#6E7280]">
                ITENS DE SÉRIE
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {v.opcionais.map((o) => (
                  <span
                    key={o}
                    className="rounded border border-[#2C303A] bg-[#1D2027] px-3 py-1.5 text-[13px] text-[#A6A9B2]"
                  >
                    {o}
                  </span>
                ))}
              </div>
            </>
          )}

          {v.observacoes && (
            <p className="mt-6 text-sm leading-relaxed text-[#A6A9B2]">{v.observacoes}</p>
          )}
        </div>

        {/* Conversão */}
        <aside className="lg:col-span-2">
          <div className="lg:sticky lg:top-24">
            <div className="mb-3 flex gap-2">
              {v.condicao === "novo" && <Selo>0 KM</Selo>}
              {v.preco_de && <Selo tom="verde">ABAIXO DA TABELA</Selo>}
              {v.unico_dono && <Selo tom="neutro">ÚNICO DONO</Selo>}
              {v.laudo_cautelar && <Selo tom="neutro">LAUDO CAUTELAR</Selo>}
            </div>

            <h1 className="font-display text-3xl uppercase leading-tight text-[#F3F0E9]">
              {v.marca} {v.modelo}
            </h1>
            <p className="mt-1.5 text-[15px] text-[#A6A9B2]">{v.versao}</p>

            {v.preco_de && (
              <div className="mt-5 font-mono text-[13px] text-[#6E7280] line-through">
                {brl(v.preco_de)}
              </div>
            )}
            <div className="font-display text-4xl text-[#C7A25C]">{brl(v.preco)}</div>

            <Simulador preco={v.preco} loja={loja} veiculoId={v.id} nomeVeiculo={nome} />

            <FormLead lojaId={loja.id} veiculoId={v.id} nomeVeiculo={nome} />

            <a
              href={linkWhatsApp(loja, `Olá! Tenho interesse no ${nome} ${v.ano_modelo} que vi no site.`)}
              className="mt-3 block rounded bg-[#1E8E4A] py-3 text-center text-sm font-semibold text-white"
            >
              Chamar no WhatsApp
            </a>

            <p className="mt-3 text-center text-[12px] leading-relaxed text-[#6E7280]">
              Para ver de perto: {loja.nome}, {enderecoCompleto(loja)}.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Selo({
  children,
  tom = "ouro",
}: { children: React.ReactNode; tom?: "ouro" | "verde" | "neutro" }) {
  const cores = {
    ouro: "text-[#C7A25C] bg-[#C7A25C]/10 border-[#C7A25C]/35",
    verde: "text-[#8FC7A3] bg-[#5B8A69]/15 border-[#5B8A69]/40",
    neutro: "text-[#A6A9B2] bg-[#1D2027] border-[#2C303A]",
  }[tom];
  return (
    <span className={`rounded-sm border px-2 py-1 font-mono text-[9px] tracking-[0.14em] ${cores}`}>
      {children}
    </span>
  );
}

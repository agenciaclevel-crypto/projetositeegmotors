import { getLoja, getVeiculos, capaDe } from "@/lib/supabase";

// Feed de estoque para importação pelos portais (OLX, iCarros, Mobiauto...).
// A loja informa este endereço na conta dela em cada portal.
// Cada portal tem seu dialeto: confirme os nomes das tags com o suporte
// antes de ativar. A estrutura abaixo cobre o que todos pedem.

export const revalidate = 600;

const esc = (v: unknown) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function GET() {
  const loja = await getLoja();
  const veiculos = await getVeiculos(loja.id);
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const itens = veiculos.map((v) => {
    const fotos = [...(v.veiculo_fotos ?? [])].sort((a, b) => a.ordem - b.ordem);
    const capa = capaDe(v);
    return `    <veiculo>
      <codigo>${esc(v.id)}</codigo>
      <marca>${esc(v.marca)}</marca>
      <modelo>${esc(v.modelo)}</modelo>
      <versao>${esc(v.versao)}</versao>
      <anoFabricacao>${v.ano_fabricacao}</anoFabricacao>
      <anoModelo>${v.ano_modelo}</anoModelo>
      <quilometragem>${v.km}</quilometragem>
      <cambio>${esc(v.cambio)}</cambio>
      <combustivel>${esc(v.combustivel)}</combustivel>
      <cor>${esc(v.cor)}</cor>
      <carroceria>${esc(v.carroceria)}</carroceria>
      <portas>${v.portas}</portas>
      <condicao>${v.condicao === "novo" ? "0km" : "usado"}</condicao>
      <preco>${v.preco}</preco>
      <opcionais>${esc((v.opcionais ?? []).join(", "))}</opcionais>
      <observacao>${esc(v.observacoes)}</observacao>
      <urlAnuncio>${esc(`${base}/veiculo/${v.slug}`)}</urlAnuncio>
      <fotoPrincipal>${esc(capa?.url)}</fotoPrincipal>
      <fotos>
${fotos.map((f) => `        <foto>${esc(f.url)}</foto>`).join("\n")}
      </fotos>
    </veiculo>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<estoque>
  <revenda>
    <nome>${esc(loja.nome)}</nome>
    <cidade>${esc(loja.cidade)}</cidade>
    <uf>${esc(loja.uf)}</uf>
    <telefone>${esc(loja.whatsapp)}</telefone>
    <atualizadoEm>${new Date().toISOString()}</atualizadoEm>
    <totalVeiculos>${veiculos.length}</totalVeiculos>
  </revenda>
  <veiculos>
${itens}
  </veiculos>
</estoque>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800",
    },
  });
}

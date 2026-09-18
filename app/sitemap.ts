import type { MetadataRoute } from "next";
import { getLoja, getVeiculos } from "@/lib/supabase";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const loja = await getLoja();
  const veiculos = await getVeiculos(loja.id);

  const agora = new Date();

  return [
    { url: base, lastModified: agora, changeFrequency: "daily", priority: 1 },
    { url: `${base}/vender`, lastModified: agora, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/agenciamento`, lastModified: agora, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/contato`, lastModified: agora, changeFrequency: "monthly", priority: 0.6 },
    ...veiculos.map((v) => ({
      url: `${base}/veiculo/${v.slug}`,
      lastModified: agora,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
  ];
}

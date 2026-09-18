import { ImageResponse } from "next/og";
import { getLoja } from "@/lib/supabase";
import { monograma } from "@/lib/seo";

/**
 * Favicon gerado no build (é o ícone que aparece na aba do navegador e ao
 * lado do site no Google). Usa o monograma da loja em dourado sobre grafite:
 * em 16px a logo inteira vira borrão, as duas letras continuam legíveis.
 */

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default async function Icon() {
  let texto = "EG";
  try {
    const loja = await getLoja();
    texto = monograma(loja.nome);
  } catch {
    texto = monograma(process.env.NEXT_PUBLIC_LOJA_SLUG ?? "EG");
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#16181D",
          color: "#C7A25C",
          fontSize: texto.length > 2 ? 190 : 250,
          fontWeight: 700,
          letterSpacing: "-0.04em",
          borderRadius: 96,
        }}
      >
        {texto}
      </div>
    ),
    { ...size }
  );
}

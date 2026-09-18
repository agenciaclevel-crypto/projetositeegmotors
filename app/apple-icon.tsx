import { ImageResponse } from "next/og";
import { getLoja } from "@/lib/supabase";
import { monograma } from "@/lib/seo";

/** Ícone de quando o cliente salva o site na tela inicial do iPhone. */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
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
          fontSize: texto.length > 2 ? 68 : 88,
          fontWeight: 700,
          letterSpacing: "-0.04em",
        }}
      >
        {texto}
      </div>
    ),
    { ...size }
  );
}

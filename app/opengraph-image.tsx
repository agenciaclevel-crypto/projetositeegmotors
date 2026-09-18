import { ImageResponse } from "next/og";
import { getLoja } from "@/lib/supabase";
import { enderecoCompleto, regiaoCurta } from "@/lib/seo";

/**
 * Imagem que aparece quando alguém manda o link do site no WhatsApp, no
 * Instagram ou no Facebook. Sem ela, o link vai "pelado" e converte menos.
 * As páginas de veículo têm a própria imagem (a foto do carro).
 */

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Carros novos e seminovos";

export default async function OpenGraphImage() {
  const loja = await getLoja();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#16181D",
          padding: 80,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 54, height: 3, background: "#C7A25C" }} />
          <div
            style={{
              color: "#C7A25C",
              fontSize: 26,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            {regiaoCurta(loja)}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            color: "#F3F0E9",
            fontSize: 86,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            marginTop: 26,
          }}
        >
          {loja.nome}
        </div>

        <div
          style={{
            display: "flex",
            color: "#A6A9B2",
            fontSize: 38,
            lineHeight: 1.3,
            marginTop: 18,
            maxWidth: 900,
          }}
        >
          Carros novos e seminovos revisados, com laudo cautelar e transferência
          feita na loja.
        </div>

        <div
          style={{
            display: "flex",
            color: "#6E7280",
            fontSize: 26,
            marginTop: 40,
          }}
        >
          {enderecoCompleto(loja)}
        </div>
      </div>
    ),
    { ...size }
  );
}

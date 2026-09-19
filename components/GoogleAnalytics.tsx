import Script from "next/script";
import { GA_ID } from "@/lib/rastreio";

/**
 * Google Analytics 4.
 *
 * A troca de página aqui é feita pelo Next, sem recarregar o site. Quem cuida
 * disso no GA4 é a "Medição avançada" do fluxo de dados, que conta cada
 * mudança de histórico do navegador como uma visualização — por isso não
 * disparamos page_view na mão, que geraria contagem dobrada.
 */
export default function GoogleAnalytics() {
  if (!GA_ID) return null;

  return (
    <>
      <Script
        id="ga-lib"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
      />
      <Script id="ga-config" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
      </Script>
    </>
  );
}

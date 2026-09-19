"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { PIXEL_META } from "@/lib/pixel";

export default function MetaPixel() {
  const caminho = usePathname();
  const primeiraCarga = useRef(true);

  // O snippet da Meta já dispara o PageView do primeiro carregamento. Como a
  // navegação entre as páginas aqui é feita pelo Next, sem recarregar o site,
  // os PageViews seguintes (carro a carro, por exemplo) precisam ser
  // disparados na mão — senão o pixel só enxerga a primeira página da visita.
  useEffect(() => {
    if (!PIXEL_META) return;
    if (primeiraCarga.current) {
      primeiraCarga.current = false;
      return;
    }
    window.fbq?.("track", "PageView");
  }, [caminho]);

  if (!PIXEL_META) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${PIXEL_META}');fbq('track','PageView');`}
      </Script>

      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          alt=""
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${PIXEL_META}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}

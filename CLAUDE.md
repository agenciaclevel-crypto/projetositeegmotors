# EG Motors — contexto do projeto

Site e painel de uma loja de veículos em Natal/RN. Feito pela agência C-LEVEL,
que pretende replicar a mesma base para outras lojas parceiras.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind
- Supabase: banco Postgres, Auth e Storage
- Deploy na Vercel

## Regras deste projeto

- **Multi-tenant:** toda tabela tem `loja_id`. Nunca escreva query sem filtrar
  por loja. O isolamento real é feito pelo RLS no Supabase.
- **Nunca** use a chave `service_role` em variável `NEXT_PUBLIC_`. O site
  público usa apenas a chave `anon`, protegida pelas policies.
- **Nunca** commite `.env.local`.
- As páginas públicas são estáticas com `revalidate = 300`. Não troque por
  renderização dinâmica sem motivo: a velocidade e o SEO dependem disso.
- Fotos são convertidas para WebP no navegador (`lib/imagem.ts`) antes do
  upload. Não suba arquivo original para o Storage.
- Textos de interface em português do Brasil, sem gerúndio desnecessário.
- Identidade visual: fundo grafite escuro, dourado #C7A25C como destaque,
  Oswald para títulos, Inter para texto, JetBrains Mono para dados.

## Estrutura

- `app/page.tsx` — home: banner, vitrine, filtros
- `app/veiculo/[slug]/` — página do veículo, com JSON-LD para o Google
- `app/vender/` — formulário de avaliação (lead de reposição)
- `app/contato/` — mapa e dados da loja
- `app/painel/` — área da loja: estoque e leads (protegida por RLS)
- `app/feed/estoque.xml/` — feed de estoque para os portais de anúncio
- `lib/supabase.ts` — cliente, tipos e queries
- `lib/imagem.ts` — conversão de foto para WebP

## Comandos

- `npm run dev` — ambiente local em http://localhost:3000
- `npm run build` — build de produção
- `npx tsc --noEmit` — checagem de tipos

## Variáveis de ambiente

Ver `.env.example`. Todas começam com `NEXT_PUBLIC_` porque são usadas no
navegador — o que é seguro aqui, já que a proteção está no RLS.

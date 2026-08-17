# EG Motors — site + painel

Projeto Next.js 15 (App Router) sobre Supabase. Multi-tenant: a mesma base
atende várias lojas, cada uma com seu domínio, cor e estoque.

---

## O que eu já fiz

| Arquivo | O que faz |
|---|---|
| `app/page.tsx` | Home com banner de campanha, vitrine e filtros |
| `app/veiculo/[slug]/page.tsx` | Página do carro, estática, com SEO e JSON-LD |
| `app/vender/page.tsx` | Formulário de avaliação (reposição) |
| `app/contato/page.tsx` | Mapa do Google e rota até a loja |
| `app/feed/estoque.xml/route.ts` | **Feed de estoque para os portais** |
| `app/painel/page.tsx` | Painel: estoque, leads, publicar/despublicar |
| `lib/imagem.ts` | Converte a foto da câmera para WebP antes de subir |
| `app/login/page.tsx` | Login com Supabase Auth |
| `app/sitemap.ts` / `robots.ts` | Indexação no Google |

---

## Passo a passo (você faz)

### 1. Supabase
1. Crie o projeto em supabase.com (região South America).
2. SQL Editor → rode `schema-clevel-supabase.sql`.
3. Storage → novo bucket **público** chamado `veiculos`.
4. Storage → bucket `marca` (também público) → suba `eg-motors-logo-claro.png`.
5. Table editor → `lojas` → cole a URL pública do logo em `logo_claro_url`.

### 2. Usuário da loja
1. Authentication → Users → Add user → e-mail e senha do gestor.
2. Copie o UUID gerado e rode:

```sql
insert into perfis (id, loja_id, nome, papel)
select 'COLE-O-UUID-AQUI', id, 'Gestor EG Motors', 'gestor'
from lojas where slug = 'eg-motors';
```

Sem essa linha o painel abre vazio: é ela que liga o usuário à loja.

### 3. Rodar local
```bash
npm install
cp .env.example .env.local   # preencha URL, chave anon e domínio
npm run dev
```

### 4. Publicar
1. Suba o projeto num repositório no GitHub.
2. Vercel → Import → selecione o repositório.
3. Cole as mesmas variáveis do `.env.local` em Environment Variables.
4. Deploy. Depois aponte o domínio `egmotors.com.br` para a Vercel.

### 5. Ligar os portais
Com o site no ar, o feed fica em:

```
https://egmotors.com.br/feed/estoque.xml
```

Informe esse endereço na conta da loja em cada portal. **Antes de ativar,
confirme com o suporte de cada um os nomes das tags** — cada portal tem seu
dialeto, e o formato do arquivo cobre o que todos pedem, mas alguns renomeiam
campos.

---

## Cuidados

- A chave `anon` é pública por natureza; quem protege os dados é o RLS do
  schema. **Nunca** coloque a `service_role` numa variável `NEXT_PUBLIC_`.
- As fotos são convertidas para WebP **no próprio celular**, antes de subir
  (`lib/imagem.ts`). Cada foto gera duas versões: 1600px para a galeria e
  720x480 para o card. A loja pode fotografar direto pelo painel.
- `revalidate = 300` deixa as páginas estáticas por 5 minutos. Quando o carro
  é vendido, ele sai do ar em até 5 min. Para sair na hora, chame
  `revalidatePath` a partir do painel.
- O painel ainda não tem as abas de banners, portais e aparência que existem
  no protótipo. Elas leem as tabelas `banners` e `integracoes_portal`, que já
  estão criadas no schema.

## Próxima rodada, na ordem que eu faria

1. Abas de banners e aparência no painel.
3. Webhook de revalidação ao vender o carro.
4. Leads do site entrando no funil do CRM com distribuição por vendedor.
5. Homologação como integrador nos portais, um de cada vez.

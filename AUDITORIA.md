# Auditoria de segurança e qualidade — EG Motors

Data: 01/10/2026 · Branch: `auditoria-seguranca` · Site: egmotorsrn.com

## Resumo

O código não tem chave secreta exposta, o RLS está ligado em todas as tabelas e
a checagem de tipos passa. Os riscos estavam em **dependências com falha
conhecida**, **regras de banco largas demais** para o que o visitante anônimo
pode gravar e **Storage sem regra versionada**. As correções estão nesta
branch, e a migração foi testada em Postgres local com 29 cenários de ataque e
de uso normal.

> **O banco de produção não foi verificado.** O site usa um projeto Supabase
> que não está na conta auditada. Rode `diagnostico-seguranca.sql` lá antes de
> aplicar a migração.

## Achados

| # | Gravidade | Achado | Situação |
|---|-----------|--------|----------|
| 1 | Crítica | `next` 15.5.23 com falha crítica publicada; `postcss` e `sharp` com falhas graves | Corrigido: `next` 15.5.27, `postcss` 8.5.28 forçado via `overrides`. `npm audit`: 0 |
| 2 | Alta | Storage sem policy versionada; os uploads não ficavam na pasta da loja, então não dava para isolar uma loja da outra | Corrigido: upload em `<loja_id>/...` + policies por pasta + só imagem (WebP, JPEG ou PNG) até 5 MB |
| 3 | Alta | Visitante anônimo cria lead em **qualquer loja**, já com status `ganho`, com texto de qualquer tamanho | Corrigido: só `novo`, só loja ativa, campos limitados, carro precisa ser da mesma loja |
| 4 | Média | Mesma brecha na tabela `visitas` (dá para inflar ou poluir o relatório de acessos) | Corrigido: só loja ativa, campos limitados |
| 5 | Média | `vendedor` tinha o mesmo poder do `gestor` (excluía carro, mexia em banner) | Corrigido: exclusão de carro, banners e logo só para o gestor |
| 6 | Média | Carro e banner de loja desativada continuavam públicos | Corrigido |
| 7 | Média | O painel ignorava erros do banco: a ação "funcionava" e nada mudava | Corrigido: aviso de falha e conferência de linhas afetadas |
| 8 | Baixa | O painel mostrava só os 50 leads mais recentes | Corrigido: botão "Carregar leads mais antigos" |
| 9 | Baixa | O painel grava a logo em `lojas`, mas o schema não tinha permissão de UPDATE | Corrigido: o gestor altera **só** a coluna da logo |
| 10 | Baixa | `.env.example` citado no CLAUDE.md não existia; `tsconfig.tsbuildinfo` versionado; CLAUDE.md citava um middleware que não existe | Corrigido |

## Ficou de fora (decisão sua)

- **Limite de envios / captcha nos formulários.** O RLS barra o lead adulterado,
  mas não impede um robô de mandar mil leads válidos. A solução é gravar o lead
  por uma rota no servidor com Cloudflare Turnstile e limite por IP.
- **Um deploy por loja.** Para atender várias lojas com um só deploy, falta o
  middleware que escolhe a loja pelo domínio. Antes de replicar para mais
  lojas, vale decidir esse modelo.
- **Repositório público.** O schema e as regras do produto ficam expostos.
  Recomendo torná-lo privado.
- **Fluxo de trabalho.** Os commits são "Add files via upload", sem branch nem
  revisão. Não há testes nem ESLint instalado. O ID do GA4 está fixo no código
  (`lib/rastreio.ts`) e precisa virar variável antes de replicar para outra loja.

## Como aplicar (a ordem importa)

1. Rodar `diagnostico-seguranca.sql` no Supabase de produção e guardar o resultado.
2. Fazer o merge desta branch e publicar na Vercel. O código novo já sobe as
   fotos na pasta da loja e funciona com as regras antigas.
3. Rodar `migracao-seguranca.sql` no Supabase (pode rodar mais de uma vez).
4. Apagar policies antigas de Storage criadas à mão (o fim da migração
   mostra a consulta).
5. Testar no painel: cadastrar carro com foto, trocar a logo, criar banner,
   mandar um lead pelo site.
6. Rodar o diagnóstico de novo e comparar.

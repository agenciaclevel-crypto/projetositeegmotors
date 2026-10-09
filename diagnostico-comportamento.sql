-- ---------------------------------------------------------------------------
-- DIAGNÓSTICO DA ABA "ANÁLISES" — só leitura, não altera nada.
--
-- Rode no Supabase da loja (SQL Editor -> New query -> colar -> Run) depois
-- de migracao-comportamento.sql e do ajuste de formatos do Storage. Cada
-- linha diz se um item está certo (✅), errado (❌) ou ainda sem dado (⏳).
--
-- Se der erro "relation eventos does not exist", o migracao-comportamento.sql
-- não foi rodado neste projeto.
-- ---------------------------------------------------------------------------

with
eventos_24h as (
  select tipo, count(*) as n from eventos
   where criado_em > now() - interval '24 hours' group by tipo
),
lojas_ativas as (select id, nome from lojas where ativa)

select '1. Tabela eventos existe' as item,
       case when to_regclass('public.eventos') is not null then '✅' else '❌' end as ok,
       '' as detalhe
union all
select '2. RLS ligado em eventos',
       case when (select relrowsecurity from pg_class where oid = 'public.eventos'::regclass) then '✅' else '❌' end,
       ''
union all
select '3. Regras de acesso de eventos',
       case when (select count(*) from pg_policies where tablename = 'eventos'
                   and policyname in ('eventos_insercao_publica', 'eventos_leitura_dono')) = 2
            then '✅' else '❌' end,
       (select coalesce(string_agg(policyname, ', '), 'nenhuma') from pg_policies where tablename = 'eventos')
union all
select '4. Site pode gravar eventos (anon)',
       case when has_table_privilege('anon', 'public.eventos', 'INSERT') then '✅' else '❌' end,
       ''
union all
select '5. Site NÃO pode ler eventos (anon)',
       case when not exists (select 1 from pg_policies where tablename = 'eventos' and cmd in ('SELECT', 'ALL')
                              and (roles @> array['anon']::name[] or qual = 'true'))
            then '✅' else '❌' end,
       ''
union all
select '6. Storage "' || b.id || '" aceita JPEG',
       case when b.allowed_mime_types is null or 'image/jpeg' = any(b.allowed_mime_types) then '✅' else '❌' end,
       coalesce(array_to_string(b.allowed_mime_types, ', '), 'qualquer formato')
  from storage.buckets b where b.id in ('veiculos', 'marca')
union all
select '7. Loja ativa (eventos só gravam nela)',
       case when (select count(*) from lojas_ativas) > 0 then '✅' else '❌' end,
       (select string_agg(nome, ', ') from lojas_ativas)
union all
select '8. Visitas chegando (24h)',
       case when (select count(*) from visitas where criado_em > now() - interval '24 hours') > 0 then '✅' else '⏳' end,
       (select count(*) from visitas where criado_em > now() - interval '24 hours')::text || ' páginas abertas'
union all
select '9. Eventos chegando (24h)',
       case when (select coalesce(sum(n), 0) from eventos_24h) > 0 then '✅' else '⏳' end,
       coalesce((select string_agg(tipo || ': ' || n, ', ' order by n desc) from eventos_24h),
                'nenhum ainda — abra o site no celular, navegue e clique no WhatsApp')
union all
select '10. Fotos novas na pasta da loja (24h)',
       case when (select count(*) from storage.objects where bucket_id = 'veiculos'
                   and created_at > now() - interval '24 hours') = 0 then '⏳'
            when (select count(*) from storage.objects o where o.bucket_id = 'veiculos'
                   and o.created_at > now() - interval '24 hours'
                   and (storage.foldername(o.name))[1] not in (select id::text from lojas)) = 0 then '✅'
            else '❌' end,
       (select count(*) from storage.objects where bucket_id = 'veiculos'
         and created_at > now() - interval '24 hours')::text || ' arquivo(s) enviados';

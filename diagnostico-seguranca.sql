-- ---------------------------------------------------------------------------
-- DIAGNÓSTICO DE SEGURANÇA — só leitura, não altera nada.
--
-- Rode no Supabase da loja (SQL Editor -> New query -> colar -> Run) ANTES de
-- aplicar migracao-seguranca.sql, e de novo DEPOIS, para comparar.
-- ---------------------------------------------------------------------------

-- 1. Tabelas sem RLS (deveria voltar vazio)
select 'tabela_sem_rls' as item, c.relname as nome, null as detalhe
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity

union all
-- 2. Todas as policies do site, com a regra de cada uma
select 'policy', tablename || '.' || policyname,
       cmd || ' | ' || coalesce(qual, '-') || ' | ' || coalesce(with_check, '-')
  from pg_policies
 where schemaname = 'public'
   and tablename in ('lojas', 'perfis', 'veiculos', 'veiculo_fotos', 'banners', 'leads', 'visitas', 'integracoes_portal')

union all
-- 3. Policies do Storage (procure escrita liberada sem checar a pasta da loja)
select 'storage_policy', policyname,
       cmd || ' | ' || array_to_string(roles, ',') || ' | ' || coalesce(qual, '-') || ' | ' || coalesce(with_check, '-')
  from pg_policies where schemaname = 'storage'

union all
-- 4. Buckets: públicos? limite de tamanho? tipos aceitos?
select 'bucket', id,
       'publico=' || public || ' | limite=' || coalesce(file_size_limit::text, 'sem limite')
       || ' | tipos=' || coalesce(array_to_string(allowed_mime_types, ','), 'qualquer')
  from storage.buckets

union all
-- 5. Usuários do painel e papel de cada um
select 'usuario_painel', u.email, p.papel || ' | loja=' || l.slug
  from perfis p join auth.users u on u.id = p.id join lojas l on l.id = p.loja_id

union all
-- 6. Sinais de abuso já ocorrido: lead criado fora do status "novo" ou
--    com texto enorme, e volume de leads por dia nos últimos 30 dias
select 'lead_suspeito', id::text, status || ' | ' || length(coalesce(mensagem, '')) || ' chars'
  from leads
 where criado_em > now() - interval '90 days'
   and length(coalesce(mensagem, '')) > 2000

union all
select 'leads_por_dia', to_char(date_trunc('day', criado_em), 'YYYY-MM-DD'), count(*)::text
  from leads where criado_em > now() - interval '30 days'
 group by 2

order by 1, 2;

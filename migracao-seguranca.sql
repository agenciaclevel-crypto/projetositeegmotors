-- ---------------------------------------------------------------------------
-- SEGURANÇA — correções da auditoria de outubro/2026
--
-- ORDEM IMPORTA: publique primeiro a versão do site que sobe as fotos dentro
-- da pasta da loja (<loja_id>/...). Só depois rode este script no Supabase:
-- SQL Editor -> New query -> colar -> Run. Pode rodar de novo sem medo.
--
-- O que muda:
--   1. Visitante só cria lead "novo", em loja ativa, com tamanho de campo
--      limitado. Antes dava para criar lead já "ganho" em qualquer loja.
--   2. Mesma trava para o registro de visitas.
--   3. Carro, foto e banner de loja desativada saem do ar junto com ela.
--   4. Vendedor não exclui carro nem mexe em banner; isso é do gestor.
--   5. Gestor pode trocar a logo da loja (e só a logo).
--   6. Storage: cada loja só grava na própria pasta; bucket aceita só WebP
--      de até 5 MB.
-- ---------------------------------------------------------------------------

-- Funções auxiliares. SECURITY DEFINER para ler perfis sem cair no RLS de
-- perfis dentro das próprias policies.
create or replace function public.loja_do_usuario() returns uuid
  language sql stable security definer set search_path = public as $$
  select loja_id from perfis where id = auth.uid()
$$;

create or replace function public.papel_do_usuario() returns text
  language sql stable security definer set search_path = public as $$
  select papel from perfis where id = auth.uid()
$$;

-- 1. LEADS -------------------------------------------------------------------
drop policy if exists "leads_insercao_publica" on leads;
create policy "leads_insercao_publica" on leads
  for insert with check (
    status = 'novo'
    and loja_id in (select id from lojas where ativa)
    and char_length(nome) between 2 and 120
    and char_length(telefone) <= 30
    and coalesce(char_length(email), 0) <= 200
    and coalesce(char_length(mensagem), 0) <= 2000
    and coalesce(char_length(origem), 0) <= 40
    and (veiculo_troca is null or pg_column_size(veiculo_troca) <= 4000)
    and (utm is null or pg_column_size(utm) <= 2000)
    and (veiculo_id is null or exists (
      select 1 from veiculos v where v.id = veiculo_id and v.loja_id = leads.loja_id
    ))
  );

-- 2. VISITAS -----------------------------------------------------------------
drop policy if exists "visitas_insercao_publica" on visitas;
create policy "visitas_insercao_publica" on visitas
  for insert with check (
    loja_id in (select id from lojas where ativa)
    and char_length(visitante) <= 64
    and char_length(caminho) <= 300
    and coalesce(char_length(origem), 0) <= 100
    and (utm is null or pg_column_size(utm) <= 2000)
  );

-- 3. LEITURA PÚBLICA SÓ DE LOJA ATIVA ----------------------------------------
drop policy if exists "veiculos_leitura_publica" on veiculos;
create policy "veiculos_leitura_publica" on veiculos
  for select using (publicado = true and loja_id in (select id from lojas where ativa));

drop policy if exists "banners_leitura_publica" on banners;
create policy "banners_leitura_publica" on banners
  for select using (ativo = true and loja_id in (select id from lojas where ativa));

-- 4. PAPÉIS: gestor x vendedor -----------------------------------------------
drop policy if exists "veiculos_gestao_dono" on veiculos;
drop policy if exists "veiculos_leitura_equipe" on veiculos;
drop policy if exists "veiculos_cadastro_equipe" on veiculos;
drop policy if exists "veiculos_edicao_equipe" on veiculos;
drop policy if exists "veiculos_exclusao_gestor" on veiculos;

create policy "veiculos_leitura_equipe" on veiculos
  for select using (loja_id = loja_do_usuario());
create policy "veiculos_cadastro_equipe" on veiculos
  for insert with check (loja_id = loja_do_usuario());
create policy "veiculos_edicao_equipe" on veiculos
  for update using (loja_id = loja_do_usuario())
  with check (loja_id = loja_do_usuario());
create policy "veiculos_exclusao_gestor" on veiculos
  for delete using (loja_id = loja_do_usuario() and papel_do_usuario() = 'gestor');

drop policy if exists "banners_gestao_dono" on banners;
drop policy if exists "banners_leitura_equipe" on banners;
drop policy if exists "banners_gestao_gestor" on banners;

create policy "banners_leitura_equipe" on banners
  for select using (loja_id = loja_do_usuario());
create policy "banners_gestao_gestor" on banners
  for all using (loja_id = loja_do_usuario() and papel_do_usuario() = 'gestor')
  with check (loja_id = loja_do_usuario() and papel_do_usuario() = 'gestor');

-- 5. LOGO DA LOJA ------------------------------------------------------------
-- O painel grava lojas.logo_claro_url, mas o schema original não tinha
-- policy de UPDATE em lojas. A permissão fica restrita a essa coluna, para o
-- gestor não conseguir mudar slug, domínio ou desativar a loja pelo navegador.
drop policy if exists "lojas_logo_gestor" on lojas;
create policy "lojas_logo_gestor" on lojas
  for update using (id = loja_do_usuario() and papel_do_usuario() = 'gestor')
  with check (id = loja_do_usuario() and papel_do_usuario() = 'gestor');

revoke update on lojas from anon, authenticated;
grant update (logo_claro_url) on lojas to authenticated;

-- 6. STORAGE -----------------------------------------------------------------
-- Os buckets continuam públicos para leitura (a URL da foto abre direto).
-- Escrita só na pasta da própria loja: <loja_id>/...
update storage.buckets
   set file_size_limit = 5242880, allowed_mime_types = array['image/webp']
 where id in ('veiculos', 'marca');

drop policy if exists "clevel_fotos_leitura_equipe" on storage.objects;
drop policy if exists "clevel_fotos_envio_equipe" on storage.objects;
drop policy if exists "clevel_fotos_troca_equipe" on storage.objects;
drop policy if exists "clevel_fotos_exclusao_equipe" on storage.objects;
drop policy if exists "clevel_marca_leitura_gestor" on storage.objects;
drop policy if exists "clevel_marca_envio_gestor" on storage.objects;
drop policy if exists "clevel_marca_troca_gestor" on storage.objects;
drop policy if exists "clevel_marca_exclusao_gestor" on storage.objects;

-- Leitura via API é necessária para o upsert; o público usa a URL pública.
create policy "clevel_fotos_leitura_equipe" on storage.objects
  for select to authenticated
  using (bucket_id = 'veiculos' and (storage.foldername(name))[1] = loja_do_usuario()::text);
create policy "clevel_fotos_envio_equipe" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'veiculos' and (storage.foldername(name))[1] = loja_do_usuario()::text);
create policy "clevel_fotos_troca_equipe" on storage.objects
  for update to authenticated
  using (bucket_id = 'veiculos' and (storage.foldername(name))[1] = loja_do_usuario()::text)
  with check (bucket_id = 'veiculos' and (storage.foldername(name))[1] = loja_do_usuario()::text);
create policy "clevel_fotos_exclusao_equipe" on storage.objects
  for delete to authenticated
  using (bucket_id = 'veiculos' and (storage.foldername(name))[1] = loja_do_usuario()::text);

create policy "clevel_marca_leitura_gestor" on storage.objects
  for select to authenticated
  using (bucket_id = 'marca' and (storage.foldername(name))[1] = loja_do_usuario()::text
         and papel_do_usuario() = 'gestor');
create policy "clevel_marca_envio_gestor" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'marca' and (storage.foldername(name))[1] = loja_do_usuario()::text
              and papel_do_usuario() = 'gestor');
create policy "clevel_marca_troca_gestor" on storage.objects
  for update to authenticated
  using (bucket_id = 'marca' and (storage.foldername(name))[1] = loja_do_usuario()::text
         and papel_do_usuario() = 'gestor')
  with check (bucket_id = 'marca' and (storage.foldername(name))[1] = loja_do_usuario()::text
              and papel_do_usuario() = 'gestor');
create policy "clevel_marca_exclusao_gestor" on storage.objects
  for delete to authenticated
  using (bucket_id = 'marca' and (storage.foldername(name))[1] = loja_do_usuario()::text
         and papel_do_usuario() = 'gestor');

-- ATENÇÃO: policies antigas de storage criadas à mão pelo painel do Supabase
-- (ex.: "Allow authenticated uploads") continuam valendo e anulam a trava
-- acima, porque policies se somam. Confira com:
--   select policyname, cmd, qual, with_check from pg_policies
--   where schemaname = 'storage' and policyname not like 'clevel_%';
-- e apague as que liberarem escrita nos buckets "veiculos" ou "marca".

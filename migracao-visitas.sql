-- ---------------------------------------------------------------------------
-- VISITAS — contagem de acesso ao site, lida na aba "Acessos" do painel
--
-- Rode este script uma vez no Supabase: SQL Editor -> New query -> colar ->
-- Run. Pode rodar de novo sem medo: nada aqui apaga dado, e as policies são
-- recriadas em vez de dar erro de "policy already exists".
--
-- O que é guardado: um id aleatório de navegador (não identifica a pessoa),
-- a página visitada, de onde veio o acesso e a data. Sem nome, sem e-mail,
-- sem IP.
-- ---------------------------------------------------------------------------

create table if not exists visitas (
  id         uuid primary key default gen_random_uuid(),
  loja_id    uuid not null references lojas (id) on delete cascade,
  visitante  text not null,
  caminho    text not null,
  origem     text,
  utm        jsonb,
  criado_em  timestamptz not null default now()
);

create index if not exists idx_visitas_loja_data on visitas (loja_id, criado_em desc);
create index if not exists idx_visitas_caminho on visitas (loja_id, caminho);

alter table visitas enable row level security;

-- O site é público: qualquer visitante registra o próprio acesso...
drop policy if exists "visitas_insercao_publica" on visitas;
create policy "visitas_insercao_publica" on visitas
  for insert with check (true);

-- ...mas só quem é da loja enxerga os números.
drop policy if exists "visitas_leitura_dono" on visitas;
create policy "visitas_leitura_dono" on visitas
  for select using (
    loja_id in (select loja_id from perfis where id = auth.uid())
  );

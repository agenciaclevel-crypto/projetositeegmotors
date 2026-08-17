-- ============================================================================
-- EG Motors / C-LEVEL — schema Supabase (Postgres)
-- Reconstruído a partir do código do projeto (lib/supabase.ts, app/painel,
-- app/feed/estoque.xml, app/veiculo) — o arquivo original citado no LEIA-ME
-- não veio no pacote enviado. Rode isto inteiro no SQL Editor do Supabase,
-- num projeto novo, região South America (São Paulo).
--
-- Multi-tenant: toda tabela de dados tem loja_id. O isolamento é feito por
-- Row Level Security (RLS) — a chave "anon" só enxerga o que as policies
-- abaixo permitem.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- LOJAS — uma linha por loja parceira (multi-tenant)
-- ----------------------------------------------------------------------------
create table if not exists lojas (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null,
  slug             text not null unique,
  dominio          text,
  logo_claro_url   text,
  cor_marca        text not null default '#C7A25C',
  slogan           text,
  whatsapp         text,
  instagram        text,
  endereco         text,
  bairro           text,
  cidade           text,
  uf               text,
  horario_semana   text not null default 'Seg a Sex, 08h às 18h',
  horario_sabado   text not null default 'Sáb, 08h às 13h',
  ativa            boolean not null default true,
  criado_em        timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- PERFIS — liga um usuário do Supabase Auth a uma loja (login do painel)
-- ----------------------------------------------------------------------------
create table if not exists perfis (
  id        uuid primary key references auth.users (id) on delete cascade,
  loja_id   uuid not null references lojas (id) on delete cascade,
  nome      text,
  papel     text not null default 'gestor' check (papel in ('gestor', 'vendedor')),
  criado_em timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- VEICULOS — estoque
-- ----------------------------------------------------------------------------
create table if not exists veiculos (
  id               uuid primary key default gen_random_uuid(),
  loja_id          uuid not null references lojas (id) on delete cascade,
  slug             text not null,
  marca            text not null,
  modelo           text not null,
  versao           text,
  ano_fabricacao   int not null,
  ano_modelo       int not null,
  km               int not null default 0,
  cambio           text,
  combustivel      text,
  motor            text,
  potencia_cv      int,
  cor              text,
  carroceria       text,
  portas           int not null default 4,
  condicao         text not null default 'seminovo' check (condicao in ('novo', 'seminovo')),
  preco            numeric(12, 2) not null,
  preco_de         numeric(12, 2),
  opcionais        text[] not null default '{}',
  observacoes      text,
  laudo_cautelar   boolean not null default false,
  unico_dono       boolean not null default false,
  destaque         boolean not null default false,
  publicado        boolean not null default false,
  status           text not null default 'disponivel'
                     check (status in ('disponivel', 'reservado', 'vendido')),
  criado_em        timestamptz not null default now(),
  unique (loja_id, slug)
);

create index if not exists idx_veiculos_loja on veiculos (loja_id);
create index if not exists idx_veiculos_publicado on veiculos (loja_id, publicado, status);

-- ----------------------------------------------------------------------------
-- VEICULO_FOTOS
-- ----------------------------------------------------------------------------
create table if not exists veiculo_fotos (
  id          uuid primary key default gen_random_uuid(),
  veiculo_id  uuid not null references veiculos (id) on delete cascade,
  url         text not null,
  url_thumb   text,
  ordem       int not null default 0,
  capa        boolean not null default false
);

create index if not exists idx_veiculo_fotos_veiculo on veiculo_fotos (veiculo_id);

-- ----------------------------------------------------------------------------
-- BANNERS — carrossel de campanha na home
-- ----------------------------------------------------------------------------
create table if not exists banners (
  id                 uuid primary key default gen_random_uuid(),
  loja_id            uuid not null references lojas (id) on delete cascade,
  titulo             text,
  legenda            text,
  imagem_url         text not null,
  imagem_mobile_url  text,
  link               text,
  ativo              boolean not null default true,
  ordem              int not null default 0,
  inicia_em          date,
  termina_em         date,
  criado_em          timestamptz not null default now()
);

create index if not exists idx_banners_loja on banners (loja_id, ativo);

-- ----------------------------------------------------------------------------
-- LEADS — formulário de compra (FormLead) e de venda/reposição (FormReposicao)
-- ----------------------------------------------------------------------------
create table if not exists leads (
  id             uuid primary key default gen_random_uuid(),
  loja_id        uuid not null references lojas (id) on delete cascade,
  nome           text not null,
  telefone       text not null,
  email          text,
  tipo           text not null default 'compra' check (tipo in ('compra', 'reposicao')),
  origem         text not null default 'site',
  veiculo_id     uuid references veiculos (id) on delete set null,
  mensagem       text,
  veiculo_troca  jsonb,
  utm            jsonb,
  status         text not null default 'novo'
                   check (status in ('novo', 'em_atendimento', 'ganho', 'perdido')),
  criado_em      timestamptz not null default now()
);

create index if not exists idx_leads_loja on leads (loja_id, criado_em desc);

-- ----------------------------------------------------------------------------
-- INTEGRACOES_PORTAL — configuração de envio a portais (OLX, iCarros, Mobiauto…)
-- citada no LEIA-ME como usada pelas abas futuras do painel
-- ----------------------------------------------------------------------------
create table if not exists integracoes_portal (
  id           uuid primary key default gen_random_uuid(),
  loja_id      uuid not null references lojas (id) on delete cascade,
  portal       text not null,
  ativo        boolean not null default false,
  configuracao jsonb not null default '{}',
  criado_em    timestamptz not null default now(),
  unique (loja_id, portal)
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table lojas enable row level security;
alter table perfis enable row level security;
alter table veiculos enable row level security;
alter table veiculo_fotos enable row level security;
alter table banners enable row level security;
alter table leads enable row level security;
alter table integracoes_portal enable row level security;

-- LOJAS: leitura pública (o site precisa ler nome/cor/whatsapp/etc antes do login)
create policy "lojas_leitura_publica" on lojas
  for select using (ativa = true);

-- PERFIS: cada usuário só vê o próprio perfil
create policy "perfis_self" on perfis
  for select using (auth.uid() = id);

-- VEICULOS: público só vê publicados; dono da loja (autenticado) vê e edita tudo da própria loja
create policy "veiculos_leitura_publica" on veiculos
  for select using (publicado = true);

create policy "veiculos_gestao_dono" on veiculos
  for all using (
    loja_id in (select loja_id from perfis where id = auth.uid())
  )
  with check (
    loja_id in (select loja_id from perfis where id = auth.uid())
  );

-- VEICULO_FOTOS: segue a visibilidade do veículo
create policy "fotos_leitura_publica" on veiculo_fotos
  for select using (
    veiculo_id in (select id from veiculos where publicado = true)
  );

create policy "fotos_gestao_dono" on veiculo_fotos
  for all using (
    veiculo_id in (
      select v.id from veiculos v
      join perfis p on p.loja_id = v.loja_id
      where p.id = auth.uid()
    )
  );

-- BANNERS: leitura pública dos ativos; gestão só pelo dono da loja
create policy "banners_leitura_publica" on banners
  for select using (ativo = true);

create policy "banners_gestao_dono" on banners
  for all using (
    loja_id in (select loja_id from perfis where id = auth.uid())
  );

-- LEADS: qualquer visitante pode CRIAR (o site precisa disso); só o dono da loja lê/gerencia
create policy "leads_insercao_publica" on leads
  for insert with check (true);

create policy "leads_leitura_dono" on leads
  for select using (
    loja_id in (select loja_id from perfis where id = auth.uid())
  );

create policy "leads_gestao_dono" on leads
  for update using (
    loja_id in (select loja_id from perfis where id = auth.uid())
  );

-- INTEGRACOES_PORTAL: só o dono da loja
create policy "integracoes_gestao_dono" on integracoes_portal
  for all using (
    loja_id in (select loja_id from perfis where id = auth.uid())
  );

-- ============================================================================
-- SEED — a loja piloto (EG Motors)
-- Depois de rodar, complete manualmente: dominio, whatsapp, instagram,
-- endereço e logo_claro_url (após subir a logo no bucket "marca").
-- ============================================================================
insert into lojas (nome, slug, cor_marca, whatsapp, instagram, cidade, uf)
values (
  'EG Motors',
  'eg-motors',
  '#C7A25C',
  '5584991497373',
  '@egmotorsrn',
  'Natal',
  'RN'
)
on conflict (slug) do nothing;

-- ============================================================================
-- Depois de rodar este arquivo:
-- 1. Storage → criar bucket público "veiculos" e bucket público "marca".
-- 2. Subir eg-motors-logo-claro.png no bucket "marca" e colar a URL pública
--    em lojas.logo_claro_url (update lojas set logo_claro_url = '...' where slug = 'eg-motors';).
-- 3. Authentication → Users → criar o usuário do gestor da loja (e-mail/senha).
-- 4. Rodar (trocando o UUID pelo do usuário criado no passo 3):
--    insert into perfis (id, loja_id, nome, papel)
--    select 'COLE-O-UUID-AQUI', id, 'Gestor EG Motors', 'gestor'
--    from lojas where slug = 'eg-motors';
-- ============================================================================

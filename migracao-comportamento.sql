-- ---------------------------------------------------------------------------
-- COMPORTAMENTO — o que o visitante faz no site, lido na aba "Análises" do
-- painel. Complementa a tabela "visitas" (migracao-visitas.sql), que continua
-- contando as páginas abertas.
--
-- Rode este script uma vez no Supabase: SQL Editor -> New query -> colar ->
-- Run. Pode rodar de novo sem medo: nada aqui apaga dado, e as policies são
-- recriadas em vez de dar erro de "policy already exists".
--
-- Enquanto ele não for rodado, o site funciona normal e o painel mostra só
-- visitas, canais e carros mais vistos. Os dados de comportamento começam a
-- contar a partir do momento em que a tabela existir.
--
-- O que é guardado: o mesmo id aleatório de navegador da tabela "visitas"
-- (não identifica a pessoa), a página, o tipo de ação, o tipo de aparelho e a
-- data. Sem nome, sem e-mail, sem IP.
--
-- Tipos de ação:
--   leitura     tempo com a página aberta e em uso (valor, em segundos) e
--               quanto da página a pessoa rolou (rolagem, de 0 a 100)
--   whatsapp    clique em botão de WhatsApp (rotulo = onde estava o botão)
--   telefone    clique para ligar
--   rota        clique em "traçar rota" até a loja
--   instagram   clique no Instagram da loja
--   formulario  começou a preencher um formulário (rotulo = qual)
--   lead        enviou um formulário (rotulo = qual; valor = preço do carro)
--   busca       termo digitado na busca do estoque (valor = carros achados)
--   filtro      filtro usado no estoque (rotulo = "marca: Toyota", por ex.)
--   galeria     passou as fotos do carro
-- ---------------------------------------------------------------------------

create table if not exists eventos (
  id           uuid primary key default gen_random_uuid(),
  loja_id      uuid not null references lojas (id) on delete cascade,
  visitante    text not null,
  caminho      text not null,
  tipo         text not null,
  rotulo       text,
  valor        numeric,
  rolagem      smallint,
  dispositivo  text,
  criado_em    timestamptz not null default now()
);

create index if not exists idx_eventos_loja_data on eventos (loja_id, criado_em desc);
create index if not exists idx_eventos_loja_tipo on eventos (loja_id, tipo, criado_em desc);

alter table eventos enable row level security;

grant insert on eventos to anon, authenticated;
grant select on eventos to authenticated;

-- O site é público: qualquer visitante registra a própria ação, mas só em
-- loja ativa, só dos tipos acima e com tamanho de campo limitado — mesma
-- trava que a auditoria pôs em "visitas", para ninguém poluir o relatório.
drop policy if exists "eventos_insercao_publica" on eventos;
create policy "eventos_insercao_publica" on eventos
  for insert with check (
    loja_id in (select id from lojas where ativa)
    and char_length(visitante) <= 64
    and char_length(caminho) <= 300
    and tipo in ('leitura', 'whatsapp', 'telefone', 'rota', 'instagram',
                 'formulario', 'lead', 'busca', 'filtro', 'galeria')
    and coalesce(char_length(rotulo), 0) <= 120
    and (valor is null or valor between 0 and 100000000)
    and (rolagem is null or rolagem between 0 and 100)
    and coalesce(char_length(dispositivo), 0) <= 20
  );

-- ...mas só quem é da loja enxerga os números.
drop policy if exists "eventos_leitura_dono" on eventos;
create policy "eventos_leitura_dono" on eventos
  for select using (
    loja_id in (select loja_id from perfis where id = auth.uid())
  );

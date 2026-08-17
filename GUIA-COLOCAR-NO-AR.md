# Guia — colocar o site da EG Motors no ar

Você não tem ainda conta no Supabase, GitHub nem Vercel — está tudo bem,
as três são gratuitas e o cadastro leva uns minutos. Depois que você tiver
as contas, me chame de volta aqui nesta conversa que eu termino o deploy
(subo o código, configuro as variáveis, conecto o domínio).

## 1. Criar o banco (Supabase) — ~5 min

1. Acesse **supabase.com** → **Start your project** → entre com seu e-mail
   ou Google.
2. **New project** → escolha um nome (ex: `eg-motors`) → região
   **South America (São Paulo)** → defina uma senha do banco (guarde essa
   senha em local seguro, mas ela não é a mesma coisa que a chave da API).
3. Espere o projeto provisionar (1–2 min).
4. Menu lateral → **SQL Editor** → **New query** → cole todo o conteúdo do
   arquivo `schema-clevel-supabase.sql` (está no zip que te enviei) → **Run**.
5. Menu lateral → **Storage** → **New bucket** → nome `veiculos` → marque
   **Public bucket** → Create. Repita para um segundo bucket chamado `marca`.
6. Menu lateral → **Project Settings → API** → copie a **Project URL** e a
   chave **anon public** — vou precisar dessas duas para configurar o site.
7. Menu lateral → **Authentication → Users → Add user** → cadastre o e-mail
   e senha que a EG Motors vai usar para entrar no painel administrativo.
   Depois copie o **UUID** desse usuário (aparece na lista de usuários).

Quando tiver os itens 6 e 7 (URL, chave anon, e-mail/UUID do usuário),
me manda aqui que eu sigo.

## 2. Criar conta no GitHub — ~2 min

1. Acesse **github.com** → **Sign up** → e-mail, senha, nome de usuário.
2. Confirme o e-mail. Não precisa criar repositório nem instalar nada —
   eu crio o repositório para você quando tivermos a conta pronta (preciso
   apenas que você gere um **token de acesso** ou me deixe te guiar na tela
   de criação do repositório, o que você preferir).

## 3. Criar conta na Vercel — ~2 min

1. Acesse **vercel.com** → **Sign up** → pode entrar direto com a conta do
   GitHub que você acabou de criar (mais simples: um clique e já conecta
   as duas contas).
2. Não precisa criar nenhum projeto ainda — a criação do projeto acontece
   quando eu conectar o repositório do GitHub.

## 4. Domínio egmotors.com.br

Confirme se esse domínio já foi registrado no CNPJ da EG Motors (era a
decisão combinada). Se ainda não foi, registra em qualquer registrador
(Registro.br é o oficial para .com.br). Assim que tivermos o site publicado
na Vercel, o último passo é apontar o domínio para lá — te passo o registro
DNS exato nessa hora.

---

## O que eu já preparei

- Todo o código do site revisado (checagem de tipos passou limpa).
- `schema-clevel-supabase.sql` criado — reconstrói as tabelas que o projeto
  original usa (não veio no zip que você me mandou, então recriei a partir
  do próprio código).
- Repositório git já inicializado localmente, pronto para subir assim que
  tivermos a conta do GitHub.

## O que falta (depende de você ter as contas acima)

1. Rodar o schema no Supabase e me passar URL + chave anon.
2. Subir o código no GitHub (eu faço, preciso só da conta/token).
3. Conectar o repositório na Vercel e colar as variáveis de ambiente (eu
   faço).
4. Apontar o domínio egmotors.com.br para a Vercel (eu te passo o registro
   DNS exato).

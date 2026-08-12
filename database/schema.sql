-- Almoxerifado SENAI-SP — Supabase/PostgreSQL
create extension if not exists pgcrypto;

create table if not exists public.familias (
  id uuid primary key default gen_random_uuid(),
  codigo varchar(3) unique not null check (codigo ~ '^\d{3}$'),
  nome varchar(120) not null,
  descricao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.tipos (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references public.familias(id),
  codigo varchar(3) not null check (codigo ~ '^\d{3}$'),
  nome varchar(120) not null,
  descricao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (familia_id, codigo)
);

create table if not exists public.itens (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references public.familias(id),
  tipo_id uuid not null references public.tipos(id),
  sku varchar(12) unique not null check (sku ~ '^\d{3}\.\d{3}\.\d{4}$'),
  nome varchar(160) not null,
  descricao text,
  localizacao varchar(180) not null,
  quantidade integer not null default 0 check (quantidade >= 0),
  estoque_minimo integer not null default 0 check (estoque_minimo >= 0),
  qr_code text,
  imagem_url text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.itens add column if not exists imagem_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-images', 'item-images', true, 1572864, array['image/webp','image/jpeg','image/png'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.movimentacoes (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.itens(id),
  tipo varchar(10) not null check (tipo in ('ENTRADA','SAIDA')),
  quantidade integer not null check (quantidade > 0),
  saldo_anterior integer not null check (saldo_anterior >= 0),
  saldo_posterior integer not null check (saldo_posterior >= 0),
  responsavel varchar(160) not null,
  motivo text,
  created_at timestamptz not null default now()
);

create index if not exists idx_itens_sku on public.itens(sku);
create index if not exists idx_itens_nome on public.itens using gin (to_tsvector('portuguese', nome));
create index if not exists idx_itens_ativo_created_at on public.itens(ativo, created_at desc);
create index if not exists idx_itens_familia_ativo on public.itens(familia_id, ativo);
create index if not exists idx_itens_tipo_ativo on public.itens(tipo_id, ativo);
create index if not exists idx_itens_estoque_ativo on public.itens(ativo, quantidade, estoque_minimo);
create index if not exists idx_movimentacoes_created_at on public.movimentacoes(created_at desc);
create index if not exists idx_movimentacoes_item on public.movimentacoes(item_id);
create index if not exists idx_movimentacoes_tipo_created_at on public.movimentacoes(tipo, created_at desc);

-- Cria o item e gera o próximo SKU FFF.TTT.PPPP no banco.
create or replace function public.criar_item_com_sku(
  p_familia_id uuid,
  p_tipo_id uuid,
  p_nome text,
  p_descricao text,
  p_localizacao text,
  p_quantidade integer,
  p_estoque_minimo integer
)
returns setof public.itens
language plpgsql
security definer
set search_path = public
as $$
declare
  v_familia_codigo varchar(3);
  v_tipo_codigo varchar(3);
  v_seq integer;
  v_sku varchar(12);
  v_item public.itens;
begin
  if p_quantidade < 0 or p_estoque_minimo < 0 then
    raise exception 'Quantidades não podem ser negativas';
  end if;

  select f.codigo, t.codigo
    into v_familia_codigo, v_tipo_codigo
  from familias f
  join tipos t on t.familia_id = f.id
  where f.id = p_familia_id and t.id = p_tipo_id and f.ativo = true and t.ativo = true;

  if v_familia_codigo is null then
    raise exception 'Família/tipo inválidos ou incompatíveis';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_familia_codigo || '.' || v_tipo_codigo));

  select coalesce(max(right(sku, 4)::integer), 0) + 1
    into v_seq
  from itens
  where familia_id = p_familia_id and tipo_id = p_tipo_id;

  if v_seq > 9999 then
    raise exception 'Limite de 9999 produtos atingido para esta família/tipo';
  end if;

  v_sku := v_familia_codigo || '.' || v_tipo_codigo || '.' || lpad(v_seq::text, 4, '0');

  insert into itens (familia_id, tipo_id, sku, nome, descricao, localizacao, quantidade, estoque_minimo)
  values (p_familia_id, p_tipo_id, v_sku, p_nome, p_descricao, p_localizacao, p_quantidade, p_estoque_minimo)
  returning * into v_item;

  return next v_item;
end;
$$;

-- Atualização atômica de estoque + histórico.
create or replace function public.registrar_movimentacao(
  p_item_id uuid,
  p_tipo varchar,
  p_quantidade integer,
  p_responsavel text,
  p_motivo text default null
)
returns setof public.movimentacoes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.itens;
  v_novo_saldo integer;
  v_mov public.movimentacoes;
begin
  if p_tipo not in ('ENTRADA', 'SAIDA') then raise exception 'Tipo de movimentação inválido'; end if;
  if p_quantidade <= 0 then raise exception 'Quantidade deve ser maior que zero'; end if;
  if trim(coalesce(p_responsavel,'')) = '' then raise exception 'Responsável obrigatório'; end if;

  select * into v_item from itens where id = p_item_id and ativo = true for update;
  if not found then raise exception 'Item não encontrado'; end if;

  if p_tipo = 'ENTRADA' then
    v_novo_saldo := v_item.quantidade + p_quantidade;
  else
    if p_quantidade > v_item.quantidade then raise exception 'Saldo insuficiente'; end if;
    v_novo_saldo := v_item.quantidade - p_quantidade;
  end if;

  update itens set quantidade = v_novo_saldo, updated_at = now() where id = p_item_id;

  insert into movimentacoes (item_id, tipo, quantidade, saldo_anterior, saldo_posterior, responsavel, motivo)
  values (p_item_id, p_tipo, p_quantidade, v_item.quantidade, v_novo_saldo, p_responsavel, p_motivo)
  returning * into v_mov;

  return next v_mov;
end;
$$;

-- Dados iniciais opcionais
insert into public.familias (codigo,nome,descricao)
values
  ('001','Documentos','Materiais e caixas do arquivo morto'),
  ('002','Materiais','Materiais de consumo e apoio'),
  ('003','EPIs','Equipamentos de proteção individual'),
  ('004','Ferramentas','Ferramentas e acessórios')
on conflict (codigo) do nothing;

insert into public.tipos (familia_id,codigo,nome,descricao)
select f.id, x.codigo, x.nome, x.descricao
from public.familias f
join (values
  ('001','001','Caixas de Arquivo','Caixas para documentos do arquivo morto'),
  ('001','002','Pastas','Pastas e organizadores'),
  ('002','001','Informática','Materiais de informática'),
  ('003','001','Proteção','Equipamentos de proteção'),
  ('004','001','Manuais','Ferramentas manuais')
) as x(familia_codigo,codigo,nome,descricao) on x.familia_codigo = f.codigo
on conflict (familia_id,codigo) do nothing;

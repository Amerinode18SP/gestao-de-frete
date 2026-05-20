-- ============================================================
-- FREIGHT-MS — Schema inicial Supabase
-- ============================================================

-- Extensões
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- ============================================================
-- EMPRESAS (multi-tenant)
-- ============================================================
create table empresas (
  id          uuid primary key default uuid_generate_v4(),
  nome        text not null,
  cnpj        text unique not null,
  omie_app_key    text,
  omie_app_secret text,
  ativo       boolean default true,
  criado_em   timestamptz default now()
);

-- ============================================================
-- FORNECEDORES
-- ============================================================
create table fornecedores (
  id          uuid primary key default uuid_generate_v4(),
  empresa_id  uuid references empresas(id) on delete cascade,
  nome        text not null,
  cnpj        text not null,
  modal       text check (modal in ('Rodoviário','Aéreo','Marítimo','Ferroviário','Dutoviário')),
  ativo       boolean default true,
  criado_em   timestamptz default now(),
  unique(empresa_id, cnpj)
);

-- ============================================================
-- CENTROS DE CUSTO
-- ============================================================
create table centros_custo (
  id          uuid primary key default uuid_generate_v4(),
  empresa_id  uuid references empresas(id) on delete cascade,
  nome        text not null,
  codigo      text,
  ativo       boolean default true,
  criado_em   timestamptz default now()
);

-- ============================================================
-- CT-e (Conhecimento de Transporte Eletrônico)
-- ============================================================
create table ctes (
  id                  uuid primary key default uuid_generate_v4(),
  empresa_id          uuid references empresas(id) on delete cascade,
  fornecedor_id       uuid references fornecedores(id),
  centro_custo_id     uuid references centros_custo(id),

  -- Identificação
  numero_cte          text not null,
  chave_acesso        text unique,
  omie_id             bigint,
  omie_numero_nf      text,

  -- Partes
  tomador_tipo        text check (tomador_tipo in ('Remetente','Destinatário','Expedidor','Recebedor','Terceiros')),
  remetente_nome      text,
  remetente_cnpj      text,
  destinatario_nome   text,
  destinatario_cnpj   text,
  tomador_nome        text,
  tomador_cnpj        text,

  -- Localização
  uf_origem           char(2),
  uf_destino          char(2),
  cidade_origem       text,
  cidade_destino      text,

  -- Modal e operação
  modal               text check (modal in ('Rodoviário','Aéreo','Marítimo','Ferroviário','Dutoviário')),
  sistema_operacao    text,

  -- Valores financeiros
  valor_servico       numeric(12,2),
  valor_mercadoria    numeric(12,2),

  -- Pesos
  peso_real           numeric(10,3),
  peso_cubado         numeric(10,3),
  peso_taxado         numeric(10,3),

  -- Links
  link_nfe            text,

  -- Status
  status              text check (status in ('Faturado','Recebido','Cancelado','Pendente')) default 'Pendente',
  data_emissao        date,
  data_faturamento    timestamptz,
  data_recebimento    timestamptz,

  -- Controle
  criado_em           timestamptz default now(),
  atualizado_em       timestamptz default now()
);

create index idx_ctes_empresa_id    on ctes(empresa_id);
create index idx_ctes_status        on ctes(status);
create index idx_ctes_data_emissao  on ctes(data_emissao);
create index idx_ctes_uf_destino    on ctes(uf_destino);
create index idx_ctes_modal         on ctes(modal);
create index idx_ctes_fornecedor    on ctes(fornecedor_id);

-- ============================================================
-- SOLICITAÇÕES DE FRETE
-- ============================================================
create table solicitacoes_frete (
  id                  uuid primary key default uuid_generate_v4(),
  empresa_id          uuid references empresas(id) on delete cascade,
  cte_id              uuid references ctes(id),
  centro_custo_id     uuid references centros_custo(id),

  -- Partes
  remetente_nome      text not null,
  destinatario_nome   text not null,
  uf_origem           char(2),
  uf_destino          char(2),

  -- Frete
  modal               text check (modal in ('Rodoviário','Aéreo','Marítimo','Ferroviário','Dutoviário')),
  peso_kg             numeric(10,3),
  descricao_carga     text,

  -- Valores (margem)
  valor_cotado_cliente  numeric(12,2),   -- quanto cobramos do cliente
  valor_real_pago       numeric(12,2),   -- quanto pagamos ao transportador
  margem_bruta          numeric(12,2) generated always as (valor_cotado_cliente - valor_real_pago) stored,
  margem_percentual     numeric(6,2) generated always as (
    case when valor_cotado_cliente > 0
    then ((valor_cotado_cliente - valor_real_pago) / valor_cotado_cliente) * 100
    else 0 end
  ) stored,

  -- Status
  status              text check (status in ('Pendente','Em andamento','Faturado','Cancelado','Revisão')) default 'Pendente',
  observacoes         text,
  criado_em           timestamptz default now(),
  atualizado_em       timestamptz default now()
);

create index idx_sol_empresa_id on solicitacoes_frete(empresa_id);
create index idx_sol_status     on solicitacoes_frete(status);

-- ============================================================
-- PARÂMETROS DE ALERTA
-- ============================================================
create table parametros_alerta (
  id                    uuid primary key default uuid_generate_v4(),
  empresa_id            uuid references empresas(id) on delete cascade unique,
  limite_semanal        numeric(12,2) default 45000,
  limite_mensal         numeric(12,2) default 180000,
  limite_fornecedor_mes numeric(12,2) default 60000,
  tolerancia_pct        numeric(5,2) default 5,
  email_alertas         text,
  frequencia_relatorio  text check (frequencia_relatorio in ('Semanal','Quinzenal','Mensal')) default 'Mensal',
  atualizado_em         timestamptz default now()
);

-- ============================================================
-- HISTÓRICO DE ALERTAS DISPARADOS
-- ============================================================
create table alertas_historico (
  id          uuid primary key default uuid_generate_v4(),
  empresa_id  uuid references empresas(id) on delete cascade,
  tipo        text check (tipo in ('semanal','mensal','fornecedor','contingencia')),
  mensagem    text,
  valor       numeric(12,2),
  limite      numeric(12,2),
  lido        boolean default false,
  criado_em   timestamptz default now()
);

create index idx_alertas_empresa on alertas_historico(empresa_id);
create index idx_alertas_lido    on alertas_historico(lido);

-- ============================================================
-- LOGS DE SINCRONIZAÇÃO OMIE
-- ============================================================
create table sync_logs (
  id              uuid primary key default uuid_generate_v4(),
  empresa_id      uuid references empresas(id) on delete cascade,
  iniciado_em     timestamptz default now(),
  finalizado_em   timestamptz,
  status          text check (status in ('running','success','error')),
  ctes_importados integer default 0,
  ctes_atualizados integer default 0,
  erro_mensagem   text
);

-- ============================================================
-- TRIGGER: atualizado_em automático
-- ============================================================
create or replace function set_atualizado_em()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_ctes_atualizado_em
  before update on ctes
  for each row execute function set_atualizado_em();

create trigger trg_sol_atualizado_em
  before update on solicitacoes_frete
  for each row execute function set_atualizado_em();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table empresas            enable row level security;
alter table fornecedores        enable row level security;
alter table centros_custo       enable row level security;
alter table ctes                enable row level security;
alter table solicitacoes_frete  enable row level security;
alter table parametros_alerta   enable row level security;
alter table alertas_historico   enable row level security;
alter table sync_logs           enable row level security;

-- Políticas de acesso por empresa (via JWT claim)
create policy "empresa_isolation" on ctes
  using (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

create policy "empresa_isolation" on fornecedores
  using (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

create policy "empresa_isolation" on centros_custo
  using (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

create policy "empresa_isolation" on solicitacoes_frete
  using (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

create policy "empresa_isolation" on parametros_alerta
  using (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

create policy "empresa_isolation" on alertas_historico
  using (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

create policy "empresa_isolation" on sync_logs
  using (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- ============================================================
-- VIEWS ANALÍTICAS
-- ============================================================

-- Gastos por período
create or replace view vw_gastos_periodo as
select
  empresa_id,
  date_trunc('day',   data_emissao) as dia,
  date_trunc('week',  data_emissao) as semana,
  date_trunc('month', data_emissao) as mes,
  date_trunc('year',  data_emissao) as ano,
  modal,
  uf_destino,
  count(*)              as total_ctes,
  sum(valor_servico)    as total_valor,
  avg(valor_servico)    as ticket_medio,
  sum(peso_taxado)      as total_peso_taxado
from ctes
where status in ('Faturado','Recebido')
group by 1,2,3,4,5,6,7;

-- Gastos por fornecedor e mês
create or replace view vw_gastos_fornecedor as
select
  c.empresa_id,
  c.fornecedor_id,
  f.nome as fornecedor_nome,
  f.cnpj as fornecedor_cnpj,
  date_trunc('month', c.data_emissao) as mes,
  c.modal,
  count(*)           as total_ctes,
  sum(c.valor_servico) as total_valor
from ctes c
join fornecedores f on f.id = c.fornecedor_id
where c.status in ('Faturado','Recebido')
group by 1,2,3,4,5,6;

-- Mapa logístico por estado
create or replace view vw_mapa_estados as
select
  empresa_id,
  uf_destino,
  modal,
  date_trunc('month', data_emissao) as mes,
  count(*)              as total_ctes,
  sum(valor_servico)    as total_valor,
  avg(valor_servico)    as ticket_medio,
  sum(peso_taxado)      as total_peso
from ctes
where status in ('Faturado','Recebido')
  and uf_destino is not null
group by 1,2,3,4;

-- Faturamento de solicitações (margem)
create or replace view vw_faturamento as
select
  empresa_id,
  date_trunc('month', criado_em) as mes,
  modal,
  status,
  count(*)                    as total_solicitacoes,
  sum(valor_cotado_cliente)   as total_cotado,
  sum(valor_real_pago)        as total_pago,
  sum(margem_bruta)           as total_margem,
  avg(margem_percentual)      as margem_media_pct
from solicitacoes_frete
group by 1,2,3,4;

-- Índice único para upsert por omie_id
alter table ctes add column if not exists omie_id bigint;
create unique index if not exists idx_ctes_omie_id_empresa on ctes(empresa_id, omie_id) where omie_id is not null;

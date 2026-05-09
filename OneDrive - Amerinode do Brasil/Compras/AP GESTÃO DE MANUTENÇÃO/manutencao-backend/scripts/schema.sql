-- ============================================================
--  SCHEMA — Sistema de Gestão de Manutenção Veicular
--  Execute este SQL no Supabase: SQL Editor → New query → Run
-- ============================================================

-- ── Extensão UUID ────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Tabela: veiculos ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS veiculos (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  placa            VARCHAR(10)  NOT NULL UNIQUE,
  localidade       VARCHAR(100) NOT NULL,
  km_atual         INTEGER,
  proxima_revisao  DATE,
  observacao       TEXT,
  created_at       TIMESTAMPTZ  DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  DEFAULT NOW()
);
ALTER TABLE veiculos    ADD COLUMN IF NOT EXISTS observacao TEXT;

-- ── Tabela: fornecedores ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS fornecedores (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  razao_social VARCHAR(200) NOT NULL,
  cnpj         VARCHAR(14)  NOT NULL UNIQUE,
  observacao   TEXT,
  created_at   TIMESTAMPTZ  DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  DEFAULT NOW()
);
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS observacao TEXT;

-- ── Tabela: ordens ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ordens (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  veiculo_id     UUID REFERENCES veiculos(id)    ON DELETE SET NULL,
  fornecedor_id  UUID REFERENCES fornecedores(id) ON DELETE SET NULL,
  supervisor     VARCHAR(100) NOT NULL,
  num_ordem      VARCHAR(50),
  link_ordem     TEXT,
  nota_fiscal    VARCHAR(50)  NOT NULL,
  data_ordem     DATE         NOT NULL,
  categoria      VARCHAR(20)  NOT NULL CHECK (categoria IN ('Serviço','Produto')),
  item           TEXT         NOT NULL,
  valor_item     NUMERIC(12,2) DEFAULT 0,
  quantidade     INTEGER       DEFAULT 1,
  valor_total    NUMERIC(12,2) DEFAULT 0,
  status         VARCHAR(20)   DEFAULT 'Pendente'
                 CHECK (status IN ('Pendente','Em Preparação','Concluído','Cancelado')),
  origem         VARCHAR(20)   DEFAULT 'Manual'
                 CHECK (origem IN ('Manual','Excel','Cotabox')),
  cotabox_id     VARCHAR(50),
  observacao     TEXT,
  created_at     TIMESTAMPTZ   DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   DEFAULT NOW()
);
ALTER TABLE ordens      ADD COLUMN IF NOT EXISTS observacao TEXT;

-- ── Índices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ordens_veiculo    ON ordens(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_ordens_fornecedor ON ordens(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_ordens_status     ON ordens(status);
CREATE INDEX IF NOT EXISTS idx_ordens_data       ON ordens(data_ordem);
CREATE INDEX IF NOT EXISTS idx_veiculos_placa    ON veiculos(placa);
CREATE INDEX IF NOT EXISTS idx_fornecedores_cnpj ON fornecedores(cnpj);

-- ── Trigger: updated_at automático ───────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_veiculos_updated_at
  BEFORE UPDATE ON veiculos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_fornecedores_updated_at
  BEFORE UPDATE ON fornecedores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_ordens_updated_at
  BEFORE UPDATE ON ordens
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Tabela: manutencoes ──────────────────────────────────────
-- Controle de veículos em manutenção ativa (sem ordem de compra)
CREATE TABLE IF NOT EXISTS manutencoes (
  id                UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  placa             VARCHAR(10)  NOT NULL,
  modelo            VARCHAR(100),
  localidade        VARCHAR(100),
  supervisor        VARCHAR(100),
  data_entrada      DATE         NOT NULL,
  data_saida        DATE,
  previsao_retorno  DATE,
  dias_previstos    INTEGER,
  tipo_manutencao   VARCHAR(50)  DEFAULT 'Corretiva'
                    CHECK (tipo_manutencao IN ('Corretiva','Preventiva','Revisão','Sinistro','Outro')),
  veiculo_alugado   BOOLEAN      DEFAULT false,
  veiculo_devolvido BOOLEAN      DEFAULT false,
  data_devolucao    DATE,
  num_os            VARCHAR(100),
  oficina           VARCHAR(150),
  status            VARCHAR(30)  DEFAULT 'Em Andamento'
                    CHECK (status IN ('Em Andamento','Retornado','Cancelado','Orçamento','Aprovado')),
  observacoes       TEXT,
  anexos            JSONB        DEFAULT '[]'::jsonb,
  convertido_ordem  BOOLEAN      DEFAULT false,
  ordem_id          UUID         REFERENCES ordens(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ  DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  DEFAULT NOW()
);

-- ── Migração para bancos existentes ──────────────────────────
-- Execute estes comandos uma vez se a tabela manutencoes já existir:
-- ALTER TABLE manutencoes ADD COLUMN IF NOT EXISTS oficina VARCHAR(150);
-- ALTER TABLE manutencoes ADD COLUMN IF NOT EXISTS anexos  JSONB DEFAULT '[]'::jsonb;
-- ALTER TABLE manutencoes DROP CONSTRAINT IF EXISTS manutencoes_status_check;
-- ALTER TABLE manutencoes ADD  CONSTRAINT manutencoes_status_check
--   CHECK (status IN ('Em Andamento','Retornado','Cancelado','Orçamento','Aprovado'));

CREATE INDEX IF NOT EXISTS idx_manutencoes_placa    ON manutencoes(placa);
CREATE INDEX IF NOT EXISTS idx_manutencoes_status   ON manutencoes(status);
CREATE INDEX IF NOT EXISTS idx_manutencoes_entrada  ON manutencoes(data_entrada);

CREATE OR REPLACE TRIGGER trg_manutencoes_updated_at
  BEFORE UPDATE ON manutencoes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Row Level Security (RLS) — recomendado para produção ─────
-- Descomente abaixo quando adicionar autenticação de usuários:
-- ALTER TABLE veiculos      ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE fornecedores  ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ordens        ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE manutencoes   ENABLE ROW LEVEL SECURITY;

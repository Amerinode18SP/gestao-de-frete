// ============================================================
// FREIGHT-MS — Tipos TypeScript
// ============================================================

export type Modal = 'Rodoviário' | 'Aéreo' | 'Marítimo' | 'Aquaviário' | 'Ferroviário' | 'Dutoviário'
export type TomadorTipo = 'Remetente' | 'Destinatário' | 'Expedidor' | 'Recebedor' | 'Terceiros'
export type StatusCte = 'Faturado' | 'Recebido' | 'Cancelado' | 'Pendente'
export type StatusSolicitacao = 'Pendente' | 'Em andamento' | 'Faturado' | 'Cancelado' | 'Revisão'
export type FrequenciaRelatorio = 'Semanal' | 'Quinzenal' | 'Mensal'

// ============================================================
// ENTIDADES
// ============================================================

export interface Empresa {
  id: string
  nome: string
  cnpj: string
  omie_app_key?: string
  omie_app_secret?: string
  ativo: boolean
  criado_em: string
}

export interface Fornecedor {
  id: string
  empresa_id: string
  nome: string
  cnpj: string
  modal?: Modal
  ativo: boolean
  criado_em: string
}

export interface CentroCusto {
  id: string
  empresa_id: string
  nome: string
  codigo?: string
  ativo: boolean
  criado_em: string
}

export interface Cte {
  id: string
  empresa_id: string
  fornecedor_id?: string
  centro_custo_id?: string

  numero_cte: string
  chave_acesso?: string
  omie_id?: number
  omie_numero_nf?: string

  tomador_tipo?: TomadorTipo
  remetente_nome?: string
  remetente_cnpj?: string
  destinatario_nome?: string
  destinatario_cnpj?: string
  tomador_nome?: string
  tomador_cnpj?: string

  uf_origem?: string
  uf_destino?: string
  cidade_origem?: string
  cidade_destino?: string

  modal?: Modal
  sistema_operacao?: string

  valor_servico?: number
  valor_mercadoria?: number
  peso_real?: number
  peso_cubado?: number
  peso_taxado?: number

  link_nfe?: string
  status: StatusCte
  data_emissao?: string
  data_faturamento?: string
  data_recebimento?: string

  criado_em: string
  atualizado_em: string

  // joins
  fornecedor?: Fornecedor
  centro_custo?: CentroCusto
}

export interface SolicitacaoFrete {
  id: string
  empresa_id: string
  cte_id?: string
  centro_custo_id?: string

  remetente_nome: string
  destinatario_nome: string
  uf_origem?: string
  uf_destino?: string

  modal?: Modal
  peso_kg?: number
  descricao_carga?: string

  valor_cotado_cliente?: number
  valor_real_pago?: number
  margem_bruta?: number
  margem_percentual?: number

  status: StatusSolicitacao
  observacoes?: string
  criado_em: string
  atualizado_em: string
}

export interface ParametrosAlerta {
  id: string
  empresa_id: string
  limite_semanal: number
  limite_mensal: number
  limite_fornecedor_mes: number
  tolerancia_pct: number
  email_alertas?: string
  frequencia_relatorio: FrequenciaRelatorio
  atualizado_em: string
}

export interface AlertaHistorico {
  id: string
  empresa_id: string
  tipo: 'semanal' | 'mensal' | 'fornecedor' | 'contingencia'
  mensagem: string
  valor: number
  limite: number
  lido: boolean
  criado_em: string
}

export interface SyncLog {
  id: string
  empresa_id: string
  iniciado_em: string
  finalizado_em?: string
  status: 'running' | 'success' | 'error'
  ctes_importados: number
  ctes_atualizados: number
  erro_mensagem?: string
}

// ============================================================
// OMIE API
// ============================================================

export interface OmieCredentials {
  app_key: string
  app_secret: string
}

export interface OmieCte {
  nCodCte: number
  cNumCte: string
  dDtEmissao: string
  nValorCte: number
  nValorMerc: number
  cStatus: string
  cChaveCte: string
  cModalTransp: string
  cNomeRemetente: string
  cCNPJRemetente: string
  cNomeDestinatario: string
  cCNPJDestinatario: string
  cNomeTomador: string
  cCNPJTomador: string
  cTipoTomador: string
  nPesoReal: number
  nPesoCubado: number
  nPesoTaxado: number
  cUFOrigem: string
  cUFDestino: string
  cLinkNFe?: string
  cNumNF?: string
  cCodCentroCusto?: string
}

export interface OmieListaCteResponse {
  nPagina: number
  nTotPaginas: number
  nRegistros: number
  nTotRegistros: number
  listaCte: OmieCte[]
}

// ============================================================
// ANALYTICS / DASHBOARD
// ============================================================

export interface MetricaPeriodo {
  empresa_id: string
  dia?: string
  semana?: string
  mes?: string
  ano?: string
  modal: Modal
  uf_destino: string
  total_ctes: number
  total_valor: number
  ticket_medio: number
  total_peso_taxado: number
}

export interface MetricaFornecedor {
  empresa_id: string
  fornecedor_id: string
  fornecedor_nome: string
  fornecedor_cnpj: string
  mes: string
  modal: Modal
  total_ctes: number
  total_valor: number
}

export interface MetricaEstado {
  empresa_id: string
  uf_destino: string
  modal: Modal
  mes: string
  total_ctes: number
  total_valor: number
  ticket_medio: number
  total_peso: number
}

export interface MetricaFaturamento {
  empresa_id: string
  mes: string
  modal: Modal
  status: StatusSolicitacao
  total_solicitacoes: number
  total_cotado: number
  total_pago: number
  total_margem: number
  margem_media_pct: number
}

export interface DashboardSummary {
  totalMes: number
  totalCtes: number
  ctesFaturados: number
  ctesRecebidos: number
  gastoSemanal: number
  limiteSemanual: number
  alertaAtivo: boolean
  pesoTotalTaxado: number
  ticketMedio: number
}

// ============================================================
// API RESPONSES
// ============================================================

export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface SyncResult {
  importados: number
  atualizados: number
  erros: number
  duracao_ms: number
}

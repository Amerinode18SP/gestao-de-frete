// ============================================================
// FREIGHT-MS — Cliente Omie API
// ============================================================

import axios, { AxiosInstance } from 'axios'
import {
  OmieCredentials,
  OmieCte,
  OmieListaCteResponse,
  Cte,
  Modal,
  TomadorTipo,
  StatusCte,
} from '@/types'

const OMIE_BASE_URL = 'https://app.omie.com.br/api/v1'

// ============================================================
// Mapeamentos
// ============================================================

const MODAL_MAP: Record<string, Modal> = {
  '01': 'Rodoviário',
  '02': 'Aéreo',
  '03': 'Aquaviário',
  '04': 'Ferroviário',
  '05': 'Dutoviário',
  'R':  'Rodoviário',
  'A':  'Aéreo',
  'M':  'Marítimo',
}

const TOMADOR_MAP: Record<string, TomadorTipo> = {
  '0': 'Remetente',
  '1': 'Expedidor',
  '2': 'Recebedor',
  '3': 'Destinatário',
  '4': 'Terceiros',
}

const STATUS_MAP: Record<string, StatusCte> = {
  'F': 'Faturado',
  'R': 'Recebido',
  'C': 'Cancelado',
  'P': 'Pendente',
  'FATURADO':  'Faturado',
  'RECEBIDO':  'Recebido',
  'CANCELADO': 'Cancelado',
  'PENDENTE':  'Pendente',
}

// ============================================================
// Classe principal
// ============================================================

export class OmieClient {
  private client: AxiosInstance
  private credentials: OmieCredentials

  constructor(credentials: OmieCredentials) {
    this.credentials = credentials
    this.client = axios.create({
      baseURL: OMIE_BASE_URL,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ----------------------------------------------------------
  // Método base de chamada à API Omie
  // ----------------------------------------------------------
  private async call<T>(endpoint: string, call: string, param: object): Promise<T> {
    const payload = {
      app_key:    this.credentials.app_key,
      app_secret: this.credentials.app_secret,
      call,
      param: [param],
    }

    try {
      const { data } = await this.client.post<T>(endpoint, payload)
      return data
    } catch (error: any) {
      const msg = error?.response?.data?.faultstring || error.message
      throw new Error(`Omie API [${call}]: ${msg}`)
    }
  }

  // ----------------------------------------------------------
  // Listar CT-e com paginação
  // ----------------------------------------------------------
  async listarCtes(pagina = 1, registrosPorPagina = 50): Promise<OmieListaCteResponse> {
    return this.call<OmieListaCteResponse>(
      '/geral/cte/',
      'ListarCte',
      {
        nPagina: pagina,
        nRegPorPagina: registrosPorPagina,
        cOrdenarPor: 'DATA_EMISSAO',
        cOrdemDecrescente: 'S',
      }
    )
  }

  // ----------------------------------------------------------
  // Buscar CT-e por status
  // ----------------------------------------------------------
  async listarCtesPorStatus(status: string, pagina = 1): Promise<OmieListaCteResponse> {
    return this.call<OmieListaCteResponse>(
      '/geral/cte/',
      'ListarCte',
      {
        nPagina: pagina,
        nRegPorPagina: 50,
        cStatus: status,
        cOrdenarPor: 'DATA_EMISSAO',
        cOrdemDecrescente: 'S',
      }
    )
  }

  // ----------------------------------------------------------
  // Buscar CT-e por período
  // ----------------------------------------------------------
  async listarCtesPorPeriodo(
    dataInicio: string,
    dataFim: string,
    pagina = 1
  ): Promise<OmieListaCteResponse> {
    return this.call<OmieListaCteResponse>(
      '/geral/cte/',
      'ListarCte',
      {
        nPagina: pagina,
        nRegPorPagina: 50,
        dDtInicio: dataInicio,
        dDtFim: dataFim,
        cOrdenarPor: 'DATA_EMISSAO',
        cOrdemDecrescente: 'S',
      }
    )
  }

  // ----------------------------------------------------------
  // Buscar todos CT-e (paginação automática)
  // ----------------------------------------------------------
  async listarTodosCtes(onProgress?: (atual: number, total: number) => void): Promise<OmieCte[]> {
    const todos: OmieCte[] = []
    let pagina = 1
    let totalPaginas = 1

    do {
      const resp = await this.listarCtes(pagina, 50)
      totalPaginas = resp.nTotPaginas

      if (resp.listaCte) {
        todos.push(...resp.listaCte)
      }

      onProgress?.(pagina, totalPaginas)
      pagina++

      // Respeitar rate limit Omie (máx ~3 req/s)
      if (pagina <= totalPaginas) {
        await new Promise(r => setTimeout(r, 400))
      }
    } while (pagina <= totalPaginas)

    return todos
  }

  // ----------------------------------------------------------
  // Converter CT-e Omie → formato interno
  // ----------------------------------------------------------
  static normalizar(
    raw: OmieCte,
    empresaId: string,
    fornecedorId?: string,
    centroCustoId?: string
  ): Omit<Cte, 'id' | 'criado_em' | 'atualizado_em'> {
    return {
      empresa_id:       empresaId,
      fornecedor_id:    fornecedorId,
      centro_custo_id:  centroCustoId,

      numero_cte:       raw.cNumCte,
      chave_acesso:     raw.cChaveCte,
      omie_id:          raw.nCodCte,
      omie_numero_nf:   raw.cNumNF,

      tomador_tipo:     TOMADOR_MAP[raw.cTipoTomador] ?? 'Terceiros',
      remetente_nome:   raw.cNomeRemetente,
      remetente_cnpj:   raw.cCNPJRemetente?.replace(/\D/g, ''),
      destinatario_nome: raw.cNomeDestinatario,
      destinatario_cnpj: raw.cCNPJDestinatario?.replace(/\D/g, ''),
      tomador_nome:     raw.cNomeTomador,
      tomador_cnpj:     raw.cCNPJTomador?.replace(/\D/g, ''),

      uf_destino:       raw.cUFDestino,
      uf_origem:        raw.cUFOrigem,

      modal:            MODAL_MAP[raw.cModalTransp] ?? 'Rodoviário',
      sistema_operacao: raw.cModalTransp,

      valor_servico:    raw.nValorCte,
      valor_mercadoria: raw.nValorMerc,
      peso_real:        raw.nPesoReal,
      peso_cubado:      raw.nPesoCubado,
      peso_taxado:      raw.nPesoTaxado,

      link_nfe:         raw.cLinkNFe,
      status:           STATUS_MAP[raw.cStatus] ?? 'Pendente',
      data_emissao:     raw.dDtEmissao
        ? raw.dDtEmissao.split('/').reverse().join('-') // dd/mm/yyyy → yyyy-mm-dd
        : undefined,
    }
  }
}

// ============================================================
// Factory — instância com credenciais do env
// ============================================================
export function createOmieClient(): OmieClient {
  const app_key = process.env.OMIE_APP_KEY
  const app_secret = process.env.OMIE_APP_SECRET

  if (!app_key || !app_secret) {
    throw new Error('OMIE_APP_KEY e OMIE_APP_SECRET devem estar definidos no .env')
  }

  return new OmieClient({ app_key, app_secret })
}

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
  'PAGO':      'Faturado',
  'ATRASADO':  'Pendente',
  'PREVISTO':  'Pendente',
  'CANCELADO': 'Cancelado',
  'F':         'Faturado',
  'R':         'Recebido',
  'C':         'Cancelado',
  'P':         'Pendente',
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
  // Listar CT-e via Contas a Pagar (uma página)
  // ----------------------------------------------------------
  async listarCtes(pagina = 1, registrosPorPagina = 50): Promise<OmieListaCteResponse> {
    const data = await this.call<any>(
      '/financas/contapagar/',
      'ListarContasPagar',
      {
        pagina,
        registros_por_pagina: registrosPorPagina,
        apenas_importado_api: 'N',
      }
    )

    const todos = data.conta_pagar_cadastro ?? []
    const ctes = todos.filter((r: any) => r.codigo_tipo_documento === 'CTE')

    return {
      nPagina:       pagina,
      nTotPaginas:   data.total_de_paginas ?? 1,
      nRegistros:    ctes.length,
      nTotRegistros: data.total_de_registros ?? 0,
      listaCte:      ctes.map((r: any) => this.mapContaPagarToCte(r)),
    }
  }

  // ----------------------------------------------------------
  // Listar fornecedores (uma página)
  // ----------------------------------------------------------
  async listarFornecedores(pagina = 1, registrosPorPagina = 50) {
    const data = await this.call<any>(
      '/geral/fornecedores/',
      'ListarFornecedores',
      {
        pagina,
        registros_por_pagina: registrosPorPagina,
        apenas_importado_api: 'N',
      }
    )
    return {
      fornecedores:  data.cadastro ?? [],
      total_paginas: data.total_de_paginas ?? 1,
    }
  }

  // ----------------------------------------------------------
  // Cache de fornecedores (codigo_omie → { nome, cnpj })
  // ----------------------------------------------------------
  private fornecedorCache = new Map<number, { nome: string; cnpj: string }>()

  async buscarFornecedor(codigoOmie: number): Promise<{ nome: string; cnpj: string }> {
    if (this.fornecedorCache.has(codigoOmie)) {
      return this.fornecedorCache.get(codigoOmie)!
    }

    // Tenta como Fornecedor primeiro, depois como Cliente
    for (const [endpoint, call, param] of [
      ['/geral/fornecedores/', 'ConsultarFornecedor', { codigo_fornecedor_omie: codigoOmie }],
      ['/geral/clientes/',     'ConsultarCliente',    { codigo_cliente_omie:    codigoOmie }],
    ] as const) {
      try {
        const data = await this.call<any>(endpoint, call, param)
        const result = {
          nome: data.razao_social ?? data.nome_fantasia ?? '',
          cnpj: (data.cnpj_cpf ?? '').replace(/\D/g, ''),
        }
        if (result.nome) {
          this.fornecedorCache.set(codigoOmie, result)
          return result
        }
      } catch { /* tenta o próximo */ }
    }

    const empty = { nome: '', cnpj: '' }
    this.fornecedorCache.set(codigoOmie, empty)
    return empty
  }

  // ----------------------------------------------------------
  // Mapear Conta a Pagar → OmieCte
  // ----------------------------------------------------------
  private mapContaPagarToCte(raw: any, fornecedor?: { nome: string; cnpj: string }): OmieCte {
    return {
      nCodCte:               Number(raw.codigo_lancamento_omie ?? 0),
      omie_fornecedor_codigo: Number(raw.codigo_cliente_fornecedor ?? 0) || undefined,
      cNumCte:               raw.numero_documento_fiscal ?? raw.numero_documento ?? '',
      cChaveCte:             raw.chave_nfe ?? '',
      cNumNF:                raw.numero_documento ?? '',
      cTipoTomador:          '2',
      cNomeRemetente:        fornecedor?.nome ?? '',
      cCNPJRemetente:        fornecedor?.cnpj ?? '',
      cNomeDestinatario:     '',
      cCNPJDestinatario:     '',
      cNomeTomador:          fornecedor?.nome ?? '',
      cCNPJTomador:          fornecedor?.cnpj ?? '',
      cUFDestino:            '',
      cUFOrigem:             '',
      cModalTransp:          'R',
      nValorCte:             raw.valor_documento ?? 0,
      nValorMerc:            0,
      nPesoReal:             0,
      nPesoCubado:           0,
      nPesoTaxado:           0,
      cLinkNFe:              '',
      cStatus:               STATUS_MAP[raw.status_titulo] ?? 'P',
      dDtEmissao:            raw.data_emissao ?? '',
      cCodCentroCusto:       raw.distribuicao?.[0]?.cCodDep ?? '',
    }
  }

  // ----------------------------------------------------------
  // Normalizar OmieCte → formato do banco Supabase
  // ----------------------------------------------------------
  static normalizar(
    raw: OmieCte,
    empresaId: string,
    fornecedorId?: string,
    centroCustoId?: string
  ): Omit<Cte, 'id' | 'criado_em' | 'atualizado_em'> {
    return {
      empresa_id:        empresaId,
      fornecedor_id:     fornecedorId,
      centro_custo_id:   centroCustoId,

      numero_cte:        raw.cNumCte,
      chave_acesso:      raw.cChaveCte || `omie-${raw.nCodCte}`,
      omie_id:           raw.nCodCte || undefined,
      omie_numero_nf:    raw.cNumNF,

      tomador_tipo:      TOMADOR_MAP[raw.cTipoTomador] ?? 'Terceiros',
      remetente_nome:    raw.cNomeRemetente,
      remetente_cnpj:    raw.cCNPJRemetente?.replace(/\D/g, ''),
      destinatario_nome: raw.cNomeDestinatario,
      destinatario_cnpj: raw.cCNPJDestinatario?.replace(/\D/g, ''),
      tomador_nome:      raw.cNomeTomador,
      tomador_cnpj:      raw.cCNPJTomador?.replace(/\D/g, ''),

      uf_destino:        raw.cUFDestino,
      uf_origem:         raw.cUFOrigem,

      modal:             MODAL_MAP[raw.cModalTransp] ?? 'Rodoviário',
      sistema_operacao:  raw.cModalTransp,

      valor_servico:     raw.nValorCte,
      valor_mercadoria:  raw.nValorMerc,

      peso_real:         raw.nPesoReal,
      peso_cubado:       raw.nPesoCubado,
      peso_taxado:       raw.nPesoTaxado,

      link_nfe:          raw.cLinkNFe,

      status:            STATUS_MAP[raw.cStatus] ?? 'Pendente',
      data_emissao:      raw.dDtEmissao
        ? raw.dDtEmissao.split('/').reverse().join('-')
        : undefined,
    }
  }
}

// ============================================================
// Factory
// ============================================================
export function createOmieClient(): OmieClient {
  const app_key    = process.env.OMIE_APP_KEY
  const app_secret = process.env.OMIE_APP_SECRET

  if (!app_key || !app_secret) {
    throw new Error('OMIE_APP_KEY e OMIE_APP_SECRET devem estar definidos no .env')
  }

  return new OmieClient({ app_key, app_secret })
}

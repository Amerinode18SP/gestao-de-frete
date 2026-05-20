// ============================================================
// FREIGHT-MS — Serviço de Sincronização Omie → Supabase
// ============================================================

import { createClient } from '@supabase/supabase-js'
import { OmieClient, createOmieClient } from './client'
import { SyncResult, OmieCte } from '@/types'

function createSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ============================================================
// Sincronizar todos os CT-e de uma empresa
// ============================================================
export async function syncCtes(
  empresaId: string,
  omieClient?: OmieClient
): Promise<SyncResult> {
  const supabase = createSupabaseAdmin()
  const client = omieClient ?? createOmieClient()
  const inicio = Date.now()

  // Registrar início do sync
  const { data: logEntry } = await supabase
    .from('sync_logs')
    .insert({ empresa_id: empresaId, status: 'running' })
    .select('id')
    .single()

  const result: SyncResult = { importados: 0, atualizados: 0, erros: 0, duracao_ms: 0 }

  try {
    // Buscar fornecedores e centros de custo da empresa para fazer o match
    const { data: fornecedores } = await supabase
      .from('fornecedores')
      .select('id, cnpj')
      .eq('empresa_id', empresaId)

    const { data: centros } = await supabase
      .from('centros_custo')
      .select('id, codigo')
      .eq('empresa_id', empresaId)

    const fornecedorMap = new Map(fornecedores?.map(f => [f.cnpj, f.id]) ?? [])
    const centroMap = new Map(centros?.map(c => [c.codigo, c.id]) ?? [])

    // Buscar CT-e existentes para saber quais são novos vs atualização
    const { data: existentes } = await supabase
      .from('ctes')
      .select('omie_id, id, status')
      .eq('empresa_id', empresaId)

    const existentesMap = new Map(existentes?.map(c => [c.omie_id, c]) ?? [])

    // Buscar todos CT-e do Omie com progresso
    console.log(`[sync] Iniciando busca CT-e empresa ${empresaId}`)
    const omieCtEList = await client.listarTodosCtes((pag, total) => {
      console.log(`[sync] Página ${pag}/${total}`)
    })

    // Processar em lotes de 50
    const LOTE = 50
    for (let i = 0; i < omieCtEList.length; i += LOTE) {
      const lote = omieCtEList.slice(i, i + LOTE)
      const upserts = lote.map((raw: OmieCte) => {
        const fornecedorId = fornecedorMap.get(raw.cCNPJTomador?.replace(/\D/g, ''))
        const centroCustoId = centroMap.get(raw.cCodCentroCusto ?? '')
        return {
          ...OmieClient.normalizar(raw, empresaId, fornecedorId, centroCustoId),
          // manter ID se já existe
          ...(existentesMap.has(raw.nCodCte) ? { id: existentesMap.get(raw.nCodCte)!.id } : {}),
        }
      })

      const { error } = await supabase
        .from('ctes')
        .upsert(upserts, { onConflict: 'chave_acesso', ignoreDuplicates: false })

      if (error) {
        console.error('[sync] Erro no upsert:', error.message)
        result.erros++
      } else {
        lote.forEach(raw => {
          if (existentesMap.has(raw.nCodCte)) result.atualizados++
          else result.importados++
        })
      }
    }

    // Verificar alertas após sync
    await verificarAlertas(empresaId, supabase)

    // Atualizar log com sucesso
    result.duracao_ms = Date.now() - inicio
    if (logEntry) {
      await supabase
        .from('sync_logs')
        .update({
          status: 'success',
          finalizado_em: new Date().toISOString(),
          ctes_importados: result.importados,
          ctes_atualizados: result.atualizados,
        })
        .eq('id', logEntry.id)
    }

    console.log(`[sync] ✓ Concluído: ${result.importados} novos, ${result.atualizados} atualizados`)
    return result

  } catch (err: any) {
    result.duracao_ms = Date.now() - inicio
    console.error('[sync] Erro crítico:', err.message)

    if (logEntry) {
      await supabase
        .from('sync_logs')
        .update({
          status: 'error',
          finalizado_em: new Date().toISOString(),
          erro_mensagem: err.message,
        })
        .eq('id', logEntry.id)
    }

    throw err
  }
}

// ============================================================
// Verificar limites e disparar alertas
// ============================================================
async function verificarAlertas(empresaId: string, supabase: any) {
  const { data: params } = await supabase
    .from('parametros_alerta')
    .select('*')
    .eq('empresa_id', empresaId)
    .single()

  if (!params) return

  const agora = new Date()
  const inicioSemana = new Date(agora)
  inicioSemana.setDate(agora.getDate() - agora.getDay())

  // Gasto semanal
  const { data: semanalData } = await supabase
    .from('ctes')
    .select('valor_servico')
    .eq('empresa_id', empresaId)
    .in('status', ['Faturado', 'Recebido'])
    .gte('data_emissao', inicioSemana.toISOString().split('T')[0])

  const gastoSemanal = (semanalData ?? []).reduce(
    (acc: number, r: any) => acc + (r.valor_servico ?? 0), 0
  )

  const limiteComTolerancia = params.limite_semanal * (1 + params.tolerancia_pct / 100)

  if (gastoSemanal > limiteComTolerancia) {
    await supabase.from('alertas_historico').insert({
      empresa_id: empresaId,
      tipo: 'semanal',
      mensagem: `Gasto semanal de R$ ${gastoSemanal.toFixed(2)} ultrapassou o limite de R$ ${params.limite_semanal.toFixed(2)} (tolerância ${params.tolerancia_pct}%)`,
      valor: gastoSemanal,
      limite: params.limite_semanal,
    })
  }

  // Gasto por fornecedor no mês
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)
  const { data: fornecedorData } = await supabase
    .from('ctes')
    .select('fornecedor_id, valor_servico')
    .eq('empresa_id', empresaId)
    .in('status', ['Faturado', 'Recebido'])
    .gte('data_emissao', inicioMes.toISOString().split('T')[0])

  const porFornecedor = new Map<string, number>()
  ;(fornecedorData ?? []).forEach((r: any) => {
    if (!r.fornecedor_id) return
    porFornecedor.set(
      r.fornecedor_id,
      (porFornecedor.get(r.fornecedor_id) ?? 0) + (r.valor_servico ?? 0)
    )
  })

  for (const [fId, valor] of porFornecedor.entries()) {
    if (valor > params.limite_fornecedor_mes) {
      await supabase.from('alertas_historico').insert({
        empresa_id: empresaId,
        tipo: 'fornecedor',
        mensagem: `Fornecedor ${fId} atingiu R$ ${valor.toFixed(2)} no mês (limite: R$ ${params.limite_fornecedor_mes.toFixed(2)})`,
        valor,
        limite: params.limite_fornecedor_mes,
      })
    }
  }
}

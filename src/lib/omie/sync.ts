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
// Sincronizar CT-e em lotes de páginas (evita timeout Vercel)
// paginaInicio e paginaFim permitem retomar de onde parou
// ============================================================
export async function syncCtes(
  empresaId: string,
  omieClient?: OmieClient,
  paginaInicio = 1,
  paginaFim?: number        // undefined = até o fim
): Promise<SyncResult & { proxima_pagina?: number; total_paginas?: number }> {
  const supabase = createSupabaseAdmin()
  const client = omieClient ?? createOmieClient()
  const inicio = Date.now()

  const { data: logEntry } = await supabase
    .from('sync_logs')
    .insert({
      empresa_id: empresaId,
      status: 'running',
      pagina_inicio: paginaInicio,
    })
    .select('id')
    .single()

  const result: SyncResult & { proxima_pagina?: number; total_paginas?: number } = {
    importados: 0,
    atualizados: 0,
    erros: 0,
    duracao_ms: 0,
  }

  try {
    const { data: fornecedores } = await supabase
      .from('fornecedores')
      .select('id, cnpj, omie_codigo')
      .eq('empresa_id', empresaId)

    const { data: centros } = await supabase
      .from('centros_custo')
      .select('id, codigo')
      .eq('empresa_id', empresaId)

    const fornecedorMap = new Map(fornecedores?.map(f => [f.cnpj, f.id]) ?? [])
    const fornecedorOmieMap = new Map(fornecedores?.filter(f => f.omie_codigo).map(f => [f.omie_codigo, f.id]) ?? [])
    const centroMap = new Map(centros?.map(c => [c.codigo, c.id]) ?? [])

    // -------------------------------------------------------
    // FIX: buscar também o fornecedor_id já salvo no banco
    // para não sobrescrever com vazio quando CTe for paga
    // -------------------------------------------------------
    const { data: existentes } = await supabase
      .from('ctes')
      .select('omie_id, id, status, fornecedor_id')
      .eq('empresa_id', empresaId)

    const existentesMap = new Map(existentes?.map(c => [c.omie_id, c]) ?? [])

    const MAX_PAGINAS_POR_LOTE = 20
    const fimLote = paginaFim ?? paginaInicio + MAX_PAGINAS_POR_LOTE - 1

    console.log(`[sync] Buscando páginas ${paginaInicio} até ${fimLote} — empresa ${empresaId}`)

    const omieCtEList: OmieCte[] = []
    let pagina = paginaInicio
    let totalPaginas = fimLote

    do {
      const resp = await client.listarCtes(pagina, 50)
      totalPaginas = resp.nTotPaginas

      if (resp.listaCte) {
        omieCtEList.push(...resp.listaCte)
      }

      console.log(`[sync] Página ${pagina}/${totalPaginas}`)
      pagina++

      if (pagina <= Math.min(fimLote, totalPaginas)) {
        await new Promise(r => setTimeout(r, 200))
      }
    } while (pagina <= Math.min(fimLote, totalPaginas))

    const LOTE = 50
    for (let i = 0; i < omieCtEList.length; i += LOTE) {
      const lote = omieCtEList.slice(i, i + LOTE)
      const upserts = lote.map((raw: OmieCte) => {
        const cnpj = (raw.cCNPJRemetente || raw.cCNPJTomador || '').replace(/\D/g, '')
        const omieCodigoForn = (raw as any).omie_fornecedor_codigo

        // Fornecedor_id novo vindo do Omie agora
        const fornecedorIdNovo = fornecedorMap.get(cnpj) ?? (omieCodigoForn ? fornecedorOmieMap.get(omieCodigoForn) : undefined)

        // -------------------------------------------------------
        // FIX: se o Omie não retornou fornecedor (CTe paga),
        // mantém o fornecedor_id que já estava salvo no banco
        // -------------------------------------------------------
        const existente = existentesMap.get(raw.nCodCte)
        const fornecedorId = fornecedorIdNovo ?? existente?.fornecedor_id ?? undefined

        const centroCustoId = centroMap.get(raw.cCodCentroCusto ?? '')
        return {
          ...OmieClient.normalizar(raw, empresaId, fornecedorId, centroCustoId),
          ...(existente ? { id: existente.id } : {}),
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

    const proximaPagina = pagina <= totalPaginas ? pagina : undefined
    result.proxima_pagina = proximaPagina
    result.total_paginas = totalPaginas

    if (!proximaPagina) {
      await verificarAlertas(empresaId, supabase)
    }

    result.duracao_ms = Date.now() - inicio

    if (logEntry) {
      await supabase
        .from('sync_logs')
        .update({
          status: proximaPagina ? 'partial' : 'success',
          finalizado_em: new Date().toISOString(),
          ctes_importados: result.importados,
          ctes_atualizados: result.atualizados,
          proxima_pagina: proximaPagina ?? null,
        })
        .eq('id', logEntry.id)
    }

    console.log(
      proximaPagina
        ? `[sync] Lote concluído: ${result.importados} novos, ${result.atualizados} atualizados. Continuar da página ${proximaPagina}/${totalPaginas}`
        : `[sync] ✔ Concluído: ${result.importados} novos, ${result.atualizados} atualizados`
    )

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

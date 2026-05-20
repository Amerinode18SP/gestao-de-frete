// ============================================================
// FREIGHT-MS — API Route: /api/dashboard
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const empresa_id = searchParams.get('empresa_id')
  const periodo    = searchParams.get('periodo') ?? 'mensal' // diario|semanal|mensal|anual

  if (!empresa_id) {
    return NextResponse.json({ error: 'empresa_id obrigatório' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const agora = new Date()

  // Calcular intervalos de data por período
  const getIntervalo = () => {
    const fim = agora.toISOString().split('T')[0]
    const ini = new Date(agora)
    if (periodo === 'diario')   ini.setDate(agora.getDate() - 1)
    if (periodo === 'semanal')  ini.setDate(agora.getDate() - 7)
    if (periodo === 'mensal')   ini.setMonth(agora.getMonth() - 1)
    if (periodo === 'anual')    ini.setFullYear(agora.getFullYear() - 1)
    return { inicio: ini.toISOString().split('T')[0], fim }
  }

  const intervalo = getIntervalo()
  const inicioSemana = new Date(agora)
  inicioSemana.setDate(agora.getDate() - agora.getDay())

  // Buscar em paralelo
  const [
    { data: ctePeriodo },
    { data: cteSemana },
    { data: porFornecedor },
    { data: porModal },
    { data: porEstado },
    { data: porCentro },
    { data: parametros },
    { data: alertas },
    { data: faturamento },
  ] = await Promise.all([
    // CT-e do período
    supabase
      .from('ctes')
      .select('id, status, valor_servico, peso_taxado, modal, data_emissao')
      .eq('empresa_id', empresa_id)
      .in('status', ['Faturado', 'Recebido'])
      .gte('data_emissao', intervalo.inicio)
      .lte('data_emissao', intervalo.fim),

    // Gasto semanal
    supabase
      .from('ctes')
      .select('valor_servico')
      .eq('empresa_id', empresa_id)
      .in('status', ['Faturado', 'Recebido'])
      .gte('data_emissao', inicioSemana.toISOString().split('T')[0]),

    // Por fornecedor
    supabase
      .from('ctes')
      .select('fornecedor_id, valor_servico, fornecedor:fornecedores(nome)')
      .eq('empresa_id', empresa_id)
      .in('status', ['Faturado', 'Recebido'])
      .gte('data_emissao', intervalo.inicio)
      .not('fornecedor_id', 'is', null),

    // Por modal
    supabase
      .from('ctes')
      .select('modal, valor_servico')
      .eq('empresa_id', empresa_id)
      .in('status', ['Faturado', 'Recebido'])
      .gte('data_emissao', intervalo.inicio),

    // Por estado
    supabase
      .from('ctes')
      .select('uf_destino, modal, valor_servico')
      .eq('empresa_id', empresa_id)
      .in('status', ['Faturado', 'Recebido'])
      .gte('data_emissao', intervalo.inicio)
      .not('uf_destino', 'is', null),

    // Por centro de custo
    supabase
      .from('ctes')
      .select('centro_custo_id, valor_servico, centro_custo:centros_custo(nome)')
      .eq('empresa_id', empresa_id)
      .in('status', ['Faturado', 'Recebido'])
      .gte('data_emissao', intervalo.inicio)
      .not('centro_custo_id', 'is', null),

    // Parâmetros de alerta
    supabase
      .from('parametros_alerta')
      .select('*')
      .eq('empresa_id', empresa_id)
      .single(),

    // Alertas não lidos
    supabase
      .from('alertas_historico')
      .select('*')
      .eq('empresa_id', empresa_id)
      .eq('lido', false)
      .order('criado_em', { ascending: false })
      .limit(10),

    // Faturamento / margens
    supabase
      .from('solicitacoes_frete')
      .select('valor_cotado_cliente, valor_real_pago, margem_bruta, status')
      .eq('empresa_id', empresa_id)
      .gte('criado_em', intervalo.inicio),
  ])

  // Agregar métricas
  const totalValor = (ctePeriodo ?? []).reduce((a, r) => a + (r.valor_servico ?? 0), 0)
  const totalCtes = ctePeriodo?.length ?? 0
  const totalFaturados = ctePeriodo?.filter(r => r.status === 'Faturado').length ?? 0
  const totalRecebidos = ctePeriodo?.filter(r => r.status === 'Recebido').length ?? 0
  const totalPeso = (ctePeriodo ?? []).reduce((a, r) => a + (r.peso_taxado ?? 0), 0)
  const gastoSemanal = (cteSemana ?? []).reduce((a, r) => a + (r.valor_servico ?? 0), 0)

  // Agrupar fornecedores
  const fornecedorMap = new Map<string, { nome: string; valor: number; ctes: number }>()
  ;(porFornecedor ?? []).forEach((r: any) => {
    const id = r.fornecedor_id
    const nome = r.fornecedor?.nome ?? id
    const atual = fornecedorMap.get(id) ?? { nome, valor: 0, ctes: 0 }
    fornecedorMap.set(id, { nome, valor: atual.valor + (r.valor_servico ?? 0), ctes: atual.ctes + 1 })
  })

  // Agrupar modais
  const modalMap = new Map<string, number>()
  ;(porModal ?? []).forEach((r: any) => {
    if (!r.modal) return
    modalMap.set(r.modal, (modalMap.get(r.modal) ?? 0) + (r.valor_servico ?? 0))
  })

  // Agrupar estados
  const estadoMap = new Map<string, { valor: number; ctes: number; modalPred: Map<string, number> }>()
  ;(porEstado ?? []).forEach((r: any) => {
    const uf = r.uf_destino
    const atual = estadoMap.get(uf) ?? { valor: 0, ctes: 0, modalPred: new Map() }
    atual.valor += r.valor_servico ?? 0
    atual.ctes++
    if (r.modal) atual.modalPred.set(r.modal, (atual.modalPred.get(r.modal) ?? 0) + 1)
    estadoMap.set(uf, atual)
  })

  // Agrupar centros
  const centroMap = new Map<string, { nome: string; valor: number }>()
  ;(porCentro ?? []).forEach((r: any) => {
    const id = r.centro_custo_id
    const nome = r.centro_custo?.nome ?? id
    const atual = centroMap.get(id) ?? { nome, valor: 0 }
    centroMap.set(id, { nome, valor: atual.valor + (r.valor_servico ?? 0) })
  })

  // Margem de faturamento
  const totalCotado = (faturamento ?? []).reduce((a, r) => a + (r.valor_cotado_cliente ?? 0), 0)
  const totalPago   = (faturamento ?? []).reduce((a, r) => a + (r.valor_real_pago ?? 0), 0)
  const totalMargem = totalCotado - totalPago

  return NextResponse.json({
    summary: {
      totalValor,
      totalCtes,
      totalFaturados,
      totalRecebidos,
      totalPeso,
      gastoSemanal,
      ticketMedio: totalCtes > 0 ? totalValor / totalCtes : 0,
      limiteSemanual: parametros?.limite_semanal ?? 45000,
      alertaAtivo: gastoSemanal > (parametros?.limite_semanal ?? 45000),
    },
    fornecedores: Array.from(fornecedorMap.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10),
    modais: Array.from(modalMap.entries())
      .map(([modal, valor]) => ({ modal, valor }))
      .sort((a, b) => b.valor - a.valor),
    estados: Array.from(estadoMap.entries())
      .map(([uf, v]) => ({
        uf,
        valor: v.valor,
        ctes: v.ctes,
        modalPredominante: [...v.modalPred.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Rodoviário',
        ticketMedio: v.ctes > 0 ? v.valor / v.ctes : 0,
      }))
      .sort((a, b) => b.valor - a.valor),
    centrosCusto: Array.from(centroMap.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.valor - a.valor),
    alertas: alertas ?? [],
    faturamento: { totalCotado, totalPago, totalMargem, percentual: totalCotado > 0 ? (totalMargem / totalCotado) * 100 : 0 },
  })
}

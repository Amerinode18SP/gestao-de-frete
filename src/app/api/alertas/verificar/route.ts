import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { empresa_id } = await req.json()
  if (!empresa_id) return NextResponse.json({ error: 'empresa_id obrigatorio' }, { status: 400 })

  const supabase = createSupabaseAdmin()
  const agora = new Date()

  // Datas de referência
  const inicioSemana = new Date(agora)
  inicioSemana.setDate(agora.getDate() - agora.getDay())
  inicioSemana.setHours(0, 0, 0, 0)

  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)

  // Busca parâmetros
  const { data: params } = await supabase
    .from('parametros_alerta')
    .select('*')
    .eq('empresa_id', empresa_id)
    .maybeSingle()

  if (!params) return NextResponse.json({ ok: true, alertas: 0, msg: 'Sem parâmetros configurados' })

  const limiteSemanal   = Number(params.limite_semanal   ?? 0)
  const limiteMensal    = Number(params.limite_mensal    ?? 0)
  const limiteFornecedor = Number(params.limite_fornecedor ?? 0)
  const tolerancia      = Number(params.tolerancia_pc    ?? 0) / 100

  // Busca CTes do mês (status Faturado ou Recebido)
  const { data: ctesMes } = await supabase
    .from('ctes')
    .select('valor_servico, data_emissao, fornecedor_id, fornecedor:fornecedores(nome)')
    .eq('empresa_id', empresa_id)
    .in('status', ['Faturado', 'Recebido'])
    .gte('data_emissao', inicioMes.toISOString().split('T')[0])

  const ctes = ctesMes ?? []

  // Calcula gastos
  const gastoMes = ctes.reduce((a: number, c: any) => a + (c.valor_servico ?? 0), 0)
  const gastoSemana = ctes
    .filter((c: any) => c.data_emissao >= inicioSemana.toISOString().split('T')[0])
    .reduce((a: number, c: any) => a + (c.valor_servico ?? 0), 0)

  // Gastos por fornecedor no mês
  const porFornecedor: Record<string, { nome: string; total: number }> = {}
  for (const c of ctes) {
    const fid = (c as any).fornecedor_id ?? 'sem-fornecedor'
    const fnome = (c as any).fornecedor?.nome ?? 'Transportadora desconhecida'
    if (!porFornecedor[fid]) porFornecedor[fid] = { nome: fnome, total: 0 }
    porFornecedor[fid].total += (c as any).valor_servico ?? 0
  }

  const novosAlertas: any[] = []

  // Verifica limite semanal
  if (limiteSemanal > 0 && gastoSemana >= limiteSemanal * (1 + tolerancia)) {
    novosAlertas.push({
      empresa_id,
      tipo: 'semanal',
      mensagem: `Gasto semanal de R$ ${gastoSemana.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ultrapassou o limite de R$ ${limiteSemanal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      valor: gastoSemana,
      limite: limiteSemanal,
      lido: false,
    })
  }

  // Verifica limite mensal
  if (limiteMensal > 0 && gastoMes >= limiteMensal * (1 + tolerancia)) {
    novosAlertas.push({
      empresa_id,
      tipo: 'mensal',
      mensagem: `Gasto mensal de R$ ${gastoMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ultrapassou o limite de R$ ${limiteMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      valor: gastoMes,
      limite: limiteMensal,
      lido: false,
    })
  }

  // Verifica limite por fornecedor
  if (limiteFornecedor > 0) {
    for (const [, forn] of Object.entries(porFornecedor)) {
      if (forn.total >= limiteFornecedor * (1 + tolerancia)) {
        novosAlertas.push({
          empresa_id,
          tipo: 'fornecedor',
          mensagem: `Transportadora ${forn.nome} gastou R$ ${forn.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} este mês (limite: R$ ${limiteFornecedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`,
          valor: forn.total,
          limite: limiteFornecedor,
          lido: false,
        })
      }
    }
  }

  // Evita alertas duplicados — verifica se já existe alerta do mesmo tipo hoje
  const hoje = agora.toISOString().split('T')[0]
  const { data: alertasHoje } = await supabase
    .from('alertas_historico')
    .select('tipo, mensagem')
    .eq('empresa_id', empresa_id)
    .gte('criado_em', hoje + 'T00:00:00Z')

  const tiposHoje = new Set((alertasHoje ?? []).map((a: any) => a.tipo))

  const alertasNovos = novosAlertas.filter(a => !tiposHoje.has(a.tipo) || a.tipo === 'fornecedor')

  if (alertasNovos.length > 0) {
    await supabase.from('alertas_historico').insert(alertasNovos)
  }

  return NextResponse.json({
    ok: true,
    alertas_gerados: alertasNovos.length,
    gasto_semana: gastoSemana,
    gasto_mes: gastoMes,
    limite_semanal: limiteSemanal,
    limite_mensal: limiteMensal,
  })
}

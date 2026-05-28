import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { empresa_id } = await req.json()
  if (!empresa_id) return NextResponse.json({ error: 'empresa_id obrigatorio' }, { status: 400 })

  const supabase = createSupabaseAdmin()
  const agora = new Date()

  // Últimos 7 dias (semana)
  const inicio7dias = new Date(agora)
  inicio7dias.setDate(agora.getDate() - 7)

  // Últimos 30 dias (mês)
  const inicio30dias = new Date(agora)
  inicio30dias.setDate(agora.getDate() - 30)

  // Busca parâmetros
  const { data: params } = await supabase
    .from('parametros_alerta')
    .select('*')
    .eq('empresa_id', empresa_id)
    .maybeSingle()

  if (!params) return NextResponse.json({ ok: true, alertas: 0, msg: 'Sem parâmetros configurados' })

  const limiteSemanal    = Number(params.limite_semanal    ?? 0)
  const limiteMensal     = Number(params.limite_mensal     ?? 0)
  const limiteFornecedor = Number(params.limite_fornecedor ?? 0)
  const tolerancia       = Number(params.tolerancia_pc     ?? 0) / 100

  // Busca CTes dos últimos 30 dias
  const { data: ctes30 } = await supabase
    .from('ctes')
    .select('valor_servico, data_emissao, fornecedor_id, fornecedor:fornecedores(nome)')
    .eq('empresa_id', empresa_id)
    .in('status', ['Faturado', 'Recebido'])
    .gte('data_emissao', inicio30dias.toISOString().split('T')[0])

  const ctes = ctes30 ?? []

  // Gastos
  const gastoMes    = ctes.reduce((a: number, c: any) => a + (c.valor_servico ?? 0), 0)
  const gastoSemana = ctes
    .filter((c: any) => c.data_emissao >= inicio7dias.toISOString().split('T')[0])
    .reduce((a: number, c: any) => a + (c.valor_servico ?? 0), 0)

  // Gastos por fornecedor
  const porFornecedor: Record<string, { nome: string; total: number }> = {}
  for (const c of ctes) {
    const fid   = (c as any).fornecedor_id ?? 'sem-fornecedor'
    const fnome = (c as any).fornecedor?.nome ?? 'Transportadora desconhecida'
    if (!porFornecedor[fid]) porFornecedor[fid] = { nome: fnome, total: 0 }
    porFornecedor[fid].total += (c as any).valor_servico ?? 0
  }

  const novosAlertas: any[] = []

  if (limiteSemanal > 0 && gastoSemana >= limiteSemanal * (1 + tolerancia)) {
    novosAlertas.push({
      empresa_id, tipo: 'semanal', lido: false,
      mensagem: `Gasto nos últimos 7 dias R$ ${gastoSemana.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ultrapassou o limite de R$ ${limiteSemanal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      valor: gastoSemana, limite: limiteSemanal,
    })
  }

  if (limiteMensal > 0 && gastoMes >= limiteMensal * (1 + tolerancia)) {
    novosAlertas.push({
      empresa_id, tipo: 'mensal', lido: false,
      mensagem: `Gasto nos últimos 30 dias R$ ${gastoMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ultrapassou o limite de R$ ${limiteMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      valor: gastoMes, limite: limiteMensal,
    })
  }

  if (limiteFornecedor > 0) {
    for (const [, forn] of Object.entries(porFornecedor)) {
      if (forn.total >= limiteFornecedor * (1 + tolerancia)) {
        novosAlertas.push({
          empresa_id, tipo: 'fornecedor', lido: false,
          mensagem: `Transportadora ${forn.nome} gastou R$ ${forn.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} nos últimos 30 dias (limite: R$ ${limiteFornecedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`,
          valor: forn.total, limite: limiteFornecedor,
        })
      }
    }
  }

  // Evita duplicar alertas do mesmo tipo hoje
  const hoje = agora.toISOString().split('T')[0]
  const { data: alertasHoje } = await supabase
    .from('alertas_historico')
    .select('tipo')
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
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { empresa_id } = await req.json()
  if (!empresa_id) return NextResponse.json({ error: 'empresa_id obrigatorio' }, { status: 400 })

  const supabase = createSupabaseAdmin()
  const agora = new Date()

  // Semana calendário: segunda-feira desta semana
  const diaSemana = agora.getDay()
  const diasDesdeSegunda = diaSemana === 0 ? 6 : diaSemana - 1
  const inicioSemana = new Date(agora)
  inicioSemana.setDate(agora.getDate() - diasDesdeSegunda)
  inicioSemana.setHours(0, 0, 0, 0)

  // Mês calendário atual
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)

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

  // Busca CTes do mês com filtros corretos
  const { data: ctesMes } = await supabase
    .from('ctes')
    .select('valor_servico, data_emissao, fornecedor_id, fornecedor:fornecedores(nome)')
    .eq('empresa_id', empresa_id)
    .in('status', ['Faturado', 'Recebido', 'Pendente'])
    .not('chave_acesso', 'is', null)
    .not('chave_acesso', 'ilike', 'omie-%')
    .not('numero_cte', 'is', null)
    .neq('numero_cte', '')
    .not('numero_cte', 'ilike', '%cart%')
    .not('numero_cte', 'ilike', '%credit%')
    .not('numero_cte', 'ilike', '%credito%')
    .not('numero_cte', 'ilike', '%.%')
    .not('numero_cte', 'ilike', '%/%')
    .gte('data_emissao', inicioMes.toISOString().split('T')[0])

  const ctes = ctesMes ?? []

  const gastoMes    = ctes.reduce((a: number, c: any) => a + (c.valor_servico ?? 0), 0)
  const gastoSemana = ctes
    .filter((c: any) => c.data_emissao >= inicioSemana.toISOString().split('T')[0])
    .reduce((a: number, c: any) => a + (c.valor_servico ?? 0), 0)

  const porFornecedor: Record<string, { nome: string; total: number }> = {}
  for (const c of ctes) {
    const fid   = (c as any).fornecedor_id ?? 'sem-fornecedor'
    const fnome = (c as any).fornecedor?.nome ?? 'Transportadora desconhecida'
    if (!porFornecedor[fid]) porFornecedor[fid] = { nome: fnome, total: 0 }
    porFornecedor[fid].total += (c as any).valor_servico ?? 0
  }

  const novosAlertas: any[] = []

  if (limiteSemanal > 0 && gastoSemana >= limiteSemanal * (1 + tolerancia)) {
    const seg = inicioSemana.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    const dom = new Date(inicioSemana)
    dom.setDate(dom.getDate() + 6)
    const domStr = dom.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    novosAlertas.push({
      empresa_id, tipo: 'semanal', lido: false,
      mensagem: `Gasto da semana (${seg} a ${domStr}) R$ ${gastoSemana.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ultrapassou o limite de R$ ${limiteSemanal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      valor: gastoSemana, limite: limiteSemanal,
    })
  }

  if (limiteMensal > 0 && gastoMes >= limiteMensal * (1 + tolerancia)) {
    novosAlertas.push({
      empresa_id, tipo: 'mensal', lido: false,
      mensagem: `Gasto de ${agora.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })} R$ ${gastoMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ultrapassou o limite de R$ ${limiteMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      valor: gastoMes, limite: limiteMensal,
    })
  }

  if (limiteFornecedor > 0) {
    for (const [, forn] of Object.entries(porFornecedor)) {
      if (forn.total >= limiteFornecedor * (1 + tolerancia)) {
        novosAlertas.push({
          empresa_id, tipo: 'fornecedor', lido: false,
          mensagem: `Transportadora ${forn.nome} gastou R$ ${forn.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} este mês (limite: R$ ${limiteFornecedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`,
          valor: forn.total, limite: limiteFornecedor,
        })
      }
    }
  }

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

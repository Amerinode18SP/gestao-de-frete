import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const empresa_id = req.nextUrl.searchParams.get('empresa_id')
  const dataInicio = req.nextUrl.searchParams.get('data_inicio')
  const dataFim    = req.nextUrl.searchParams.get('data_fim')

  if (!empresa_id) return NextResponse.json({ error: 'empresa_id obrigatorio' }, { status: 400 })

  const supabase = createSupabaseAdmin()

  let query = supabase
    .from('ctes')
    .select('valor_servico, data_emissao, fornecedor_id, centro_custo_nome, fornecedor:fornecedores(nome)')
    .eq('empresa_id', empresa_id)
    .not('status', 'eq', 'Cancelado')

  if (dataInicio) query = query.gte('data_emissao', dataInicio)
  if (dataFim)    query = query.lte('data_emissao', dataFim)

  const { data, error } = await query.limit(50000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ctes = data ?? []

  // Por mês
  const mesMapa = new Map<string, { valor: number; count: number }>()
  ctes.forEach((c: any) => {
    if (!c.data_emissao) return
    const mes = c.data_emissao.substring(0, 7)
    const atual = mesMapa.get(mes) ?? { valor: 0, count: 0 }
    mesMapa.set(mes, { valor: atual.valor + (c.valor_servico ?? 0), count: atual.count + 1 })
  })
  const por_mes = Array.from(mesMapa.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, d]) => ({ mes: new Date(mes + '-01').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }), valor: d.valor, count: d.count }))

  // Por fornecedor
  const fornMapa = new Map<string, { nome: string; valor: number; count: number }>()
  ctes.forEach((c: any) => {
    const nome = (c.fornecedor as any)?.nome || 'Sem transportadora'
    const atual = fornMapa.get(nome) ?? { nome, valor: 0, count: 0 }
    fornMapa.set(nome, { nome, valor: atual.valor + (c.valor_servico ?? 0), count: atual.count + 1 })
  })
  const por_fornecedor = Array.from(fornMapa.values())
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 10)

  // Por centro de custo
  const centroMapa = new Map<string, { nome: string; valor: number; count: number }>()
  ctes.forEach((c: any) => {
    const nome = c.centro_custo_nome || 'Sem centro'
    const atual = centroMapa.get(nome) ?? { nome, valor: 0, count: 0 }
    centroMapa.set(nome, { nome, valor: atual.valor + (c.valor_servico ?? 0), count: atual.count + 1 })
  })
  const por_centro = Array.from(centroMapa.values()).sort((a, b) => b.valor - a.valor)

  // Totais
  const valorTotal = ctes.reduce((a: number, c: any) => a + (c.valor_servico ?? 0), 0)
  const mesesUnicos = new Set(ctes.map((c: any) => c.data_emissao?.substring(0, 7)).filter(Boolean)).size
  const media = mesesUnicos > 0 ? valorTotal / mesesUnicos : 0
  const ticket = ctes.length > 0 ? valorTotal / ctes.length : 0

  return NextResponse.json({
    por_mes,
    por_fornecedor,
    por_centro,
    totais: { valor: valorTotal, count: ctes.length, media, ticket },
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const empresa_id = req.nextUrl.searchParams.get('empresa_id')
  if (!empresa_id) return NextResponse.json({ error: 'empresa_id obrigatorio' }, { status: 400 })

  const supabase = createSupabaseAdmin()
  const agora = new Date()

  // Semana: últimos 7 dias
  const inicio7dias = new Date(agora)
  inicio7dias.setDate(agora.getDate() - 7)

  // Mês: mês calendário atual
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)

  const [alertasRes, semanalRes, mensalRes, paramsRes] = await Promise.all([
    supabase.from('alertas_historico').select('*').eq('empresa_id', empresa_id).order('criado_em', { ascending: false }).limit(50),
    supabase.from('ctes').select('valor_servico').eq('empresa_id', empresa_id)
      .in('status', ['Faturado', 'Recebido', 'Pendente'])
      .gte('data_emissao', inicio7dias.toISOString().split('T')[0]),
    supabase.from('ctes').select('valor_servico').eq('empresa_id', empresa_id)
      .in('status', ['Faturado', 'Recebido', 'Pendente'])
      .gte('data_emissao', inicioMes.toISOString().split('T')[0]),
    supabase.from('parametros_alerta').select('limite_semanal').eq('empresa_id', empresa_id).maybeSingle(),
  ])

  const gasto_semana = (semanalRes.data ?? []).reduce((a: number, r: any) => a + (r.valor_servico ?? 0), 0)
  const gasto_mes    = (mensalRes.data  ?? []).reduce((a: number, r: any) => a + (r.valor_servico ?? 0), 0)
  const limite_semana = paramsRes.data?.limite_semanal ?? 0

  return NextResponse.json({
    alertas: alertasRes.data ?? [],
    gasto_semana,
    gasto_mes,
    limite_semana,
  })
}

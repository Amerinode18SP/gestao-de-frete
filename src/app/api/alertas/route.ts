import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const empresa_id = req.nextUrl.searchParams.get('empresa_id')
  if (!empresa_id) return NextResponse.json({ error: 'empresa_id obrigatorio' }, { status: 400 })

  const supabase = createSupabaseAdmin()
  const agora = new Date()

  // Semana calendário: segunda-feira desta semana
  const diaSemana = agora.getDay() // 0=dom, 1=seg, ..., 6=sab
  const diasDesdeSegunda = diaSemana === 0 ? 6 : diaSemana - 1
  const inicioSemana = new Date(agora)
  inicioSemana.setDate(agora.getDate() - diasDesdeSegunda)
  inicioSemana.setHours(0, 0, 0, 0)

  // Mês calendário atual
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)

  const [alertasRes, semanalRes, mensalRes, paramsRes] = await Promise.all([
    supabase.from('alertas_historico').select('*').eq('empresa_id', empresa_id).order('criado_em', { ascending: false }).limit(50),
    supabase.from('ctes').select('valor_servico').eq('empresa_id', empresa_id)
      .in('status', ['Faturado', 'Recebido', 'Pendente'])
      .gte('data_emissao', inicioSemana.toISOString().split('T')[0]),
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

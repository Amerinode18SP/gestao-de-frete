// ============================================================
// FREIGHT-MS - API Route: GET /api/ctes/resumo
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const empresa_id = searchParams.get('empresa_id')
  const status     = searchParams.get('status')
  const busca      = searchParams.get('busca')

  if (!empresa_id) {
    return NextResponse.json({ error: 'empresa_id obrigatorio' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()

  // Base query com filtros opcionais (sem select — aplicado depois)
  const baseQuery = () => {
    let q = supabase.from('ctes').select('*', { count: 'exact', head: true }).eq('empresa_id', empresa_id)
    if (status && status !== 'Todos') q = q.eq('status', status)
    if (busca) q = q.or(
      `numero_cte.ilike.%${busca}%,remetente_nome.ilike.%${busca}%,destinatario_nome.ilike.%${busca}%,centro_custo_nome.ilike.%${busca}%`
    )
    return q
  }

  const valorQuery = () => {
    let q = supabase.from('ctes').select('valor_servico').eq('empresa_id', empresa_id)
    if (status && status !== 'Todos') q = q.eq('status', status)
    if (busca) q = q.or(
      `numero_cte.ilike.%${busca}%,remetente_nome.ilike.%${busca}%,destinatario_nome.ilike.%${busca}%,centro_custo_nome.ilike.%${busca}%`
    )
    return q
  }

  const [total, faturado, cancelado, pendente, valorRes] = await Promise.all([
    baseQuery(),
    baseQuery().eq('status', 'Faturado'),
    baseQuery().eq('status', 'Cancelado'),
    baseQuery().eq('status', 'Pendente'),
    valorQuery().limit(10000),
  ])

  const valor_total = (valorRes.data ?? []).reduce((a: number, r: any) => a + (r.valor_servico ?? 0), 0)

  return NextResponse.json({
    total:      total.count     ?? 0,
    faturado:   faturado.count  ?? 0,
    cancelado:  cancelado.count ?? 0,
    pendente:   pendente.count  ?? 0,
    valor_total,
  })
}

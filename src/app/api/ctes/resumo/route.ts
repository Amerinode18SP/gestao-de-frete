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

  // Base query com filtros opcionais
  const baseQuery = () => {
    let q = supabase.from('ctes').select('*').eq('empresa_id', empresa_id)
    if (status && status !== 'Todos') q = q.eq('status', status)
    if (busca) q = q.or(
      `numero_cte.ilike.%${busca}%,remetente_nome.ilike.%${busca}%,destinatario_nome.ilike.%${busca}%,centro_custo_nome.ilike.%${busca}%`
    )
    return q
  }

  const [total, faturado, cancelado, pendente, valorRes] = await Promise.all([
    baseQuery().select('*', { count: 'exact', head: true }),
    baseQuery().select('*', { count: 'exact', head: true }).eq('status', 'Faturado'),
    baseQuery().select('*', { count: 'exact', head: true }).eq('status', 'Cancelado'),
    baseQuery().select('*', { count: 'exact', head: true }).eq('status', 'Pendente'),
    baseQuery().select('valor_servico').limit(10000),
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

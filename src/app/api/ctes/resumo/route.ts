// ============================================================
// FREIGHT-MS — API Route: GET /api/ctes/resumo
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const empresa_id = searchParams.get('empresa_id')

  if (!empresa_id) {
    return NextResponse.json({ error: 'empresa_id obrigatório' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()

  // Contar por status em paralelo (muito mais rápido que buscar todos os registros)
  const [total, faturado, recebido, cancelado, pendente, valorRes] = await Promise.all([
    supabase.from('ctes').select('*', { count: 'exact', head: true }).eq('empresa_id', empresa_id).not('numero_cte', 'ilike', '%cart%').not('numero_cte', 'ilike', '%credit%'),
    supabase.from('ctes').select('*', { count: 'exact', head: true }).eq('empresa_id', empresa_id).eq('status', 'Faturado'),
    supabase.from('ctes').select('*', { count: 'exact', head: true }).eq('empresa_id', empresa_id).eq('status', 'Recebido'),
    supabase.from('ctes').select('*', { count: 'exact', head: true }).eq('empresa_id', empresa_id).eq('status', 'Cancelado'),
    supabase.from('ctes').select('*', { count: 'exact', head: true }).eq('empresa_id', empresa_id).eq('status', 'Pendente'),
    supabase.from('ctes').select('valor_servico').eq('empresa_id', empresa_id).not('numero_cte', 'ilike', '%cart%'),
  ])

  const valor_total = (valorRes.data ?? []).reduce((a: number, r: any) => a + (r.valor_servico ?? 0), 0)

  return NextResponse.json({
    total:     total.count     ?? 0,
    faturado:  faturado.count  ?? 0,
    recebido:  recebido.count  ?? 0,
    cancelado: cancelado.count ?? 0,
    pendente:  pendente.count  ?? 0,
    valor_total,
  })
}

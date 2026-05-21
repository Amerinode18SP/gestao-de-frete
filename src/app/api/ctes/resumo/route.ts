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

  const { data, error } = await supabase
    .from('ctes')
    .select('status, valor_servico')
    .eq('empresa_id', empresa_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = data ?? []
  const resumo = {
    total:        rows.length,
    faturado:     rows.filter(r => r.status === 'Faturado').length,
    recebido:     rows.filter(r => r.status === 'Recebido').length,
    cancelado:    rows.filter(r => r.status === 'Cancelado').length,
    pendente:     rows.filter(r => r.status === 'Pendente').length,
    valor_total:  rows.reduce((a, r) => a + (r.valor_servico ?? 0), 0),
  }

  return NextResponse.json(resumo)
}

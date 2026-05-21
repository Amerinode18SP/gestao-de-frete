// ============================================================
// FREIGHT-MS — API Route: GET /api/ctes
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const empresa_id = searchParams.get('empresa_id')
  const limit      = Number(searchParams.get('limit') ?? '100')
  const status     = searchParams.get('status')
  const busca      = searchParams.get('busca')

  if (!empresa_id) {
    return NextResponse.json({ error: 'empresa_id obrigatório' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()

  let query = supabase
    .from('ctes')
    .select('id, numero_cte, remetente_nome, destinatario_nome, uf_origem, uf_destino, valor_servico, status, data_emissao, modal')
    .eq('empresa_id', empresa_id)
    .order('data_emissao', { ascending: false })
    .limit(limit)

  if (status && status !== 'Todos') {
    query = query.eq('status', status)
  }

  if (busca) {
    query = query.or(`numero_cte.ilike.%${busca}%,remetente_nome.ilike.%${busca}%,destinatario_nome.ilike.%${busca}%`)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ctes: data ?? [] })
}

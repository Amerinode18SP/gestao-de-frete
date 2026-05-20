// ============================================================
// FREIGHT-MS — API Route: /api/cte
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const empresa_id   = searchParams.get('empresa_id')
  const status       = searchParams.get('status')
  const fornecedor   = searchParams.get('fornecedor_id')
  const centro       = searchParams.get('centro_custo_id')
  const tomador      = searchParams.get('tomador_tipo')
  const modal        = searchParams.get('modal')
  const uf_destino   = searchParams.get('uf_destino')
  const data_inicio  = searchParams.get('data_inicio')
  const data_fim     = searchParams.get('data_fim')
  const page         = parseInt(searchParams.get('page') ?? '1')
  const pageSize     = parseInt(searchParams.get('page_size') ?? '50')

  if (!empresa_id) {
    return NextResponse.json({ error: 'empresa_id obrigatório' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  let query = supabase
    .from('ctes')
    .select(`
      *,
      fornecedor:fornecedores(id, nome, cnpj),
      centro_custo:centros_custo(id, nome)
    `, { count: 'exact' })
    .eq('empresa_id', empresa_id)
    .order('data_emissao', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (status)      query = query.eq('status', status)
  if (fornecedor)  query = query.eq('fornecedor_id', fornecedor)
  if (centro)      query = query.eq('centro_custo_id', centro)
  if (tomador)     query = query.eq('tomador_tipo', tomador)
  if (modal)       query = query.eq('modal', modal)
  if (uf_destino)  query = query.eq('uf_destino', uf_destino)
  if (data_inicio) query = query.gte('data_emissao', data_inicio)
  if (data_fim)    query = query.lte('data_emissao', data_fim)

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data: data ?? [],
    total: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  })
}

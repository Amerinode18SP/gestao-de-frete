// ============================================================
// FREIGHT-MS — API Route: GET /api/ctes
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const empresa_id = searchParams.get('empresa_id')
  const page       = Number(searchParams.get('page') ?? '1')
  const limit      = Number(searchParams.get('limit') ?? '50')
  const status     = searchParams.get('status')
  const busca      = searchParams.get('busca')

  if (!empresa_id) {
    return NextResponse.json({ error: 'empresa_id obrigatório' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const offset = (page - 1) * limit

  let query = supabase
    .from('ctes')
    .select(`
      id, numero_cte, remetente_nome, destinatario_nome,
      uf_origem, uf_destino, valor_servico, status,
      data_emissao, modal, fornecedor_id,
      fornecedor:fornecedores(nome)
    `, { count: 'exact' })
    .eq('empresa_id', empresa_id)
    // Filtrar "cartão de crédito" e registros sem número válido de CT-e
    .not('numero_cte', 'ilike', '%cart%')
    .not('numero_cte', 'ilike', '%crédit%')
    .not('numero_cte', 'ilike', '%credito%')
    .order('data_emissao', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1)

  if (status && status !== 'Todos') {
    query = query.eq('status', status)
  }

  if (busca) {
    // Busca em número, remetente, destinatário E nome do fornecedor via subquery
    query = query.or(
      `numero_cte.ilike.%${busca}%,remetente_nome.ilike.%${busca}%,destinatario_nome.ilike.%${busca}%`
    )
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Preencher transportadora: preferência fornecedor > remetente_nome
  const ctes = (data ?? []).map((c: any) => ({
    ...c,
    fornecedor_nome: c.fornecedor?.nome || c.remetente_nome || '',
    remetente_nome:  c.fornecedor?.nome || c.remetente_nome || '',
  }))

  return NextResponse.json({
    ctes,
    total: count ?? 0,
    page,
    total_pages: Math.ceil((count ?? 0) / limit),
  })
}

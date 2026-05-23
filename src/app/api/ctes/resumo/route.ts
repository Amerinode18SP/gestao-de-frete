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

  // Se há busca, buscar fornecedor_ids que batem com o nome
  let fornecedorIds: string[] = []
  if (busca) {
    const { data: forn } = await supabase
      .from('fornecedores')
      .select('id')
      .eq('empresa_id', empresa_id)
      .ilike('nome', `%${busca}%`)
    fornecedorIds = (forn ?? []).map((f: any) => f.id)
  }

  // Monta filtro OR para busca (incluindo transportadora)
  const buildOrFilter = (q: any) => {
    if (!busca) return q
    const orParts = [
      `numero_cte.ilike.%${busca}%`,
      `remetente_nome.ilike.%${busca}%`,
      `destinatario_nome.ilike.%${busca}%`,
      `centro_custo_nome.ilike.%${busca}%`,
    ]
    if (fornecedorIds.length > 0) {
      orParts.push(`fornecedor_id.in.(${fornecedorIds.join(',')})`)
    }
    return q.or(orParts.join(','))
  }

  // Base query para contagens
  const baseCount = (extraStatus?: string) => {
    let q = supabase.from('ctes').select('*', { count: 'exact', head: true }).eq('empresa_id', empresa_id)
    if (status && status !== 'Todos') q = q.eq('status', status)
    if (extraStatus) q = q.eq('status', extraStatus)
    q = buildOrFilter(q)
    return q
  }

  // Query para valor total via RPC
  const valorQuery = supabase.rpc('sum_valor_ctes_v2', {
    p_empresa_id: empresa_id,
    p_status: status && status !== 'Todos' ? status : null,
    p_busca: busca || null,
    p_fornecedor_ids: fornecedorIds.length > 0 ? fornecedorIds : null,
  })

  const [total, faturado, cancelado, pendente, valorRes] = await Promise.all([
    baseCount(),
    baseCount('Faturado'),
    baseCount('Cancelado'),
    baseCount('Pendente'),
    valorQuery,
  ])

  // Fallback: se RPC falhar, soma manualmente com limit
  let valor_total = 0
  if (valorRes.error) {
    const { data: vals } = await supabase
      .from('ctes')
      .select('valor_servico')
      .eq('empresa_id', empresa_id)
      .limit(10000)
    valor_total = (vals ?? []).reduce((a: number, r: any) => a + (r.valor_servico ?? 0), 0)
  } else {
    valor_total = (valorRes.data as number) ?? 0
  }

  return NextResponse.json({
    total:      total.count     ?? 0,
    faturado:   faturado.count  ?? 0,
    cancelado:  cancelado.count ?? 0,
    pendente:   pendente.count  ?? 0,
    valor_total,
  })
}

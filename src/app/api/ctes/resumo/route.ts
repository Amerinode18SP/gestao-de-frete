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
  const dataInicio = searchParams.get('data_inicio')
  const dataFim    = searchParams.get('data_fim')

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

  // Filtros base iguais ao ctes/route.ts
  const aplicarFiltrosBase = (q: any) => {
    q = q
      .eq('empresa_id', empresa_id)
      .not('chave_acesso', 'is', null)
      .not('chave_acesso', 'ilike', 'omie-%')
      .not('numero_cte', 'is', null)
      .neq('numero_cte', '')
      .not('numero_cte', 'ilike', '%cart%')
      .not('numero_cte', 'ilike', '%credit%')
      .not('numero_cte', 'ilike', '%credito%')
      .not('numero_cte', 'ilike', '%.%')
      .not('numero_cte', 'ilike', '%/%')
    if (dataInicio) q = q.gte('data_emissao', dataInicio)
    if (dataFim)    q = q.lte('data_emissao', dataFim)
    if (busca) {
      const orParts = [
        `numero_cte.ilike.%${busca}%`,
        `remetente_nome.ilike.%${busca}%`,
        `destinatario_nome.ilike.%${busca}%`,
        `centro_custo_nome.ilike.%${busca}%`,
      ]
      if (fornecedorIds.length > 0) {
        orParts.push(`fornecedor_id.in.(${fornecedorIds.join(',')})`)
      }
      q = q.or(orParts.join(','))
    }
    return q
  }

  const baseCount = (extraStatus?: string) => {
    let q = supabase.from('ctes').select('*', { count: 'exact', head: true })
    q = aplicarFiltrosBase(q)
    if (status && status !== 'Todos') q = q.eq('status', status)
    if (extraStatus) q = q.eq('status', extraStatus)
    return q
  }

  // Valor total: soma direta com os mesmos filtros
  const valorQuery = () => {
    let q = supabase.from('ctes').select('valor_servico')
    q = aplicarFiltrosBase(q)
    if (status && status !== 'Todos') q = q.eq('status', status)
    return q
  }

  const [total, faturado, cancelado, pendente, valoresRes] = await Promise.all([
    baseCount(),
    baseCount('Faturado'),
    baseCount('Cancelado'),
    baseCount('Pendente'),
    valorQuery(),
  ])

  const valor_total = (valoresRes.data ?? []).reduce((a: number, r: any) => a + (r.valor_servico ?? 0), 0)

  return NextResponse.json({
    total:      total.count     ?? 0,
    faturado:   faturado.count  ?? 0,
    cancelado:  cancelado.count ?? 0,
    pendente:   pendente.count  ?? 0,
    valor_total,
  })
}

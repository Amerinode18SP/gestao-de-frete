// ============================================================
// FREIGHT-MS — API Route: GET /api/ctes
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'

// Mapa de código IBGE → sigla UF
const UF_MAP: Record<string, string> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA',
  '16': 'AP', '17': 'TO', '21': 'MA', '22': 'PI', '23': 'CE',
  '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE',
  '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP',
  '41': 'PR', '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT',
  '52': 'GO', '53': 'DF',
}

function ufDaChave(chave: string | null): string {
  if (!chave || chave.startsWith('omie-') || chave.length < 2) return ''
  return UF_MAP[chave.substring(0, 2)] ?? ''
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const empresa_id = searchParams.get('empresa_id')
  const page       = Number(searchParams.get('page') ?? '1')
  const limit      = Number(searchParams.get('limit') ?? '50')
  const status     = searchParams.get('status')
  const busca      = searchParams.get('busca')
  const dataInicio = searchParams.get('data_inicio')
  const dataFim    = searchParams.get('data_fim')

  if (!empresa_id) {
    return NextResponse.json({ error: 'empresa_id obrigatorio' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const offset = (page - 1) * limit

  // Se há busca, primeiro busca fornecedor_ids que batem com o nome
  let fornecedorIds: string[] = []
  if (busca) {
    const { data: forn } = await supabase
      .from('fornecedores')
      .select('id')
      .eq('empresa_id', empresa_id)
      .ilike('nome', `%${busca}%`)
    fornecedorIds = (forn ?? []).map((f: any) => f.id)
  }

  let query = supabase
    .from('ctes')
    .select(`
      id, numero_cte, remetente_nome, destinatario_nome,
      uf_origem, uf_destino, chave_acesso, valor_servico, status,
      data_emissao, modal, peso_real, centro_custo_nome, fornecedor_id,
      fornecedor:fornecedores(nome)
    `, { count: 'exact' })
    .eq('empresa_id', empresa_id)
    // Somente CT-es com chave de acesso real (44 dígitos, não começa com omie-)
    .not('chave_acesso', 'is', null)
    .not('chave_acesso', 'ilike', 'omie-%')
    // Somente registros com número de CT-e válido
    .not('numero_cte', 'is', null)
    .neq('numero_cte', '')
    // Filtrar lançamentos que não são CT-e
    .not('numero_cte', 'ilike', '%cart%')
    .not('numero_cte', 'ilike', '%credit%')
    .not('numero_cte', 'ilike', '%credito%')
    .not('numero_cte', 'ilike', '%.%')
    .not('numero_cte', 'ilike', '%/%')
    .order('data_emissao', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1)

  if (status && status !== 'Todos') {
    query = query.eq('status', status)
  }

  if (dataInicio) {
    query = query.gte('data_emissao', dataInicio)
  }

  if (dataFim) {
    query = query.lte('data_emissao', dataFim)
  }

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
    query = query.or(orParts.join(','))
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const ctes = (data ?? []).map((c: any) => {
    const uf_origem = c.uf_origem || ufDaChave(c.chave_acesso)
    return {
      ...c,
      uf_origem,
      fornecedor_nome: c.fornecedor?.nome || c.remetente_nome || '',
      remetente_nome:  c.fornecedor?.nome || c.remetente_nome || '',
    }
  })

  return NextResponse.json({
    ctes,
    total: count ?? 0,
    page,
    total_pages: Math.ceil((count ?? 0) / limit),
  })
}

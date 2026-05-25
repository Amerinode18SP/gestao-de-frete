import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'

const ESTADOS: Record<string, string> = {
  AC:'Acre',AL:'Alagoas',AP:'Amapá',AM:'Amazonas',BA:'Bahia',
  CE:'Ceará',DF:'Distrito Federal',ES:'Espírito Santo',GO:'Goiás',
  MA:'Maranhão',MT:'Mato Grosso',MS:'Mato Grosso do Sul',MG:'Minas Gerais',
  PA:'Pará',PB:'Paraíba',PR:'Paraná',PE:'Pernambuco',PI:'Piauí',
  RJ:'Rio de Janeiro',RN:'Rio Grande do Norte',RS:'Rio Grande do Sul',
  RO:'Rondônia',RR:'Roraima',SC:'Santa Catarina',SP:'São Paulo',
  SE:'Sergipe',TO:'Tocantins',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function nomeFornecedor(r: any): string {
  const f = r.fornecedores
  if (!f) return ''
  if (Array.isArray(f)) return f[0]?.nome || ''
  return f.nome || ''
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const empresaId   = searchParams.get('empresa_id') || process.env.NEXT_PUBLIC_EMPRESA_ID!
    const modalFiltro = searchParams.get('modal')
    const transp      = searchParams.get('transportadora')
    const cc          = searchParams.get('centro_custo')
    const mes         = searchParams.get('mes')
    const ano         = searchParams.get('ano')

    const supabase = createSupabaseAdmin()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allRows: any[] = []
    const PAGE = 1000
    let from = 0
    let hasMore = true

    while (hasMore) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase
        .from('ctes')
        .select(`
          id,
          valor_servico,
          uf_destino,
          modal,
          data_emissao,
          centro_custo_nome,
          fornecedores ( nome )
        `)
        .eq('empresa_id', empresaId)
        .neq('status', 'Cancelado')
        .not('uf_destino', 'is', null)
        .not('valor_servico', 'is', null)
        .range(from, from + PAGE - 1)

      if (modalFiltro) q = q.eq('modal', modalFiltro)

      const { data, error } = await q
      if (error) throw new Error(error.message)

      const batch = data || []
      allRows.push(...batch)
      hasMore = batch.length === PAGE
      from += PAGE
    }

    // Listas para filtros
    const transpSet = new Set<string>()
    const ccSet     = new Set<string>()
    for (const r of allRows) {
      const t = nomeFornecedor(r)
      const c = r.centro_custo_nome || ''
      if (t) transpSet.add(t)
      if (c) ccSet.add(c)
    }

    // Filtros em memória
    const filtered = allRows.filter(r => {
      const nomeT = nomeFornecedor(r)
      const nomeC = r.centro_custo_nome || ''
      const data  = r.data_emissao ? new Date(r.data_emissao) : null
      const rMes  = data ? String(data.getMonth() + 1) : ''
      const rAno  = data ? String(data.getFullYear())  : ''
      return (
        (!transp || nomeT === transp) &&
        (!cc     || nomeC === cc)     &&
        (!mes    || rMes  === mes)    &&
        (!ano    || rAno  === ano)
      )
    })

    const byState: Record<string, {
      name: string; uf: string; ctes: number; value: number
      modal: string; modalCounts: Record<string, number>
    }> = {}
    const byModal: Record<string, number> = {}
    const byCC:    Record<string, number> = {}

    for (const r of filtered) {
      const uf  = String(r.uf_destino || '').toUpperCase().trim()
      if (!uf || !ESTADOS[uf]) continue

      const val = Number(r.valor_servico) || 0
      const mod = String(r.modal || 'Rodoviário')
      const ccN = r.centro_custo_nome || 'Sem C.C.'

      if (!byState[uf]) {
        byState[uf] = { name: ESTADOS[uf], uf, ctes: 0, value: 0, modal: '', modalCounts: {} }
      }
      byState[uf].ctes  += 1
      byState[uf].value += val
      byState[uf].modalCounts[mod] = (byState[uf].modalCounts[mod] || 0) + 1

      byModal[mod] = (byModal[mod] || 0) + val
      byCC[ccN]    = (byCC[ccN]   || 0) + val
    }

    for (const uf in byState) {
      const mc = byState[uf].modalCounts
      byState[uf].modal = Object.entries(mc).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Rodoviário'
      delete (byState[uf] as any).modalCounts
    }

    const sorted     = Object.values(byState).sort((a, b) => b.value - a.value)
    const totalValue = filtered.reduce((s, r) => s + (Number(r.valor_servico) || 0), 0)
    const totalCtes  = filtered.length

    return NextResponse.json({
      summary: {
        totalValue:  Math.round(totalValue),
        totalCtes,
        stateCount:  sorted.length,
        ticketMedio: totalCtes > 0 ? Math.round(totalValue / totalCtes) : 0,
        topState:    sorted[0] || null,
      },
      byState: sorted,
      byModal: Object.entries(byModal)
        .sort((a, b) => b[1] - a[1])
        .map(([label, value]) => ({ label, value: Math.round(value) })),
      byCC: Object.entries(byCC)
        .sort((a, b) => b[1] - a[1])
        .map(([label, value]) => ({ label, value: Math.round(value) })),
      transportadoras: Array.from(transpSet).sort(),
      centrosCusto:    Array.from(ccSet).sort(),
    })
  } catch (err: any) {
    console.error('[mapeamento]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

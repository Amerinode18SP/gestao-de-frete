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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function nomeCC(r: any): string {
  const c = r.centros_custo
  if (!c) return ''
  if (Array.isArray(c)) return c[0]?.nome || ''
  return c.nome || ''
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
    let query: any = supabase
      .from('ctes')
      .select(`
        id,
        valor_servico,
        uf_destino,
        modal,
        data_emissao,
        status,
        fornecedores ( nome ),
        centros_custo ( nome )
      `)
      .eq('empresa_id', empresaId)
      .neq('status', 'Cancelado')
      .not('uf_destino', 'is', null)
      .not('valor_servico', 'is', null)

    if (modalFiltro) query = query.eq('modal', modalFiltro)

    const { data: ctes, error } = await query
    if (error) throw new Error(error.message)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = ctes || []

    // Listas para os selects (todos os registros, sem filtro)
    const transpSet = new Set<string>()
    const ccSet     = new Set<string>()
    for (const r of rows) {
      const t = nomeFornecedor(r)
      const c = nomeCC(r)
      if (t) transpSet.add(t)
      if (c) ccSet.add(c)
    }

    // Filtros em memória
    const filtered = rows.filter(r => {
      const nomeT = nomeFornecedor(r)
      const nomeC = nomeCC(r)
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

    // Agrega por estado
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
      const ccN = nomeCC(r) || 'Sem C.C.'

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

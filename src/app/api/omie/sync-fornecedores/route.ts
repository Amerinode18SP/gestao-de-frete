// ============================================================
// FREIGHT-MS — API Route: POST /api/omie/sync-fornecedores
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'
import { createOmieClient } from '@/lib/omie/client'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization')
    const cronKey = req.headers.get('x-cron-key')
    if (cronKey !== process.env.CRON_SECRET && !auth?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { empresa_id, pagina_inicio = 1 } = body
    if (!empresa_id) return NextResponse.json({ error: 'empresa_id obrigatório' }, { status: 400 })

    const supabase = createSupabaseAdmin()
    const client = createOmieClient()

    const MAX_PAG = 40
    let pagina = pagina_inicio
    let totalPaginas = pagina_inicio + MAX_PAG - 1
    let importados = 0
    let erros = 0

    do {
      const data = await client.listarFornecedores(pagina, 50)
      totalPaginas = data.total_paginas

      for (const f of data.fornecedores ?? []) {
        const nome = f.razao_social ?? f.nome_fantasia ?? ''
        if (!nome) continue

        const omie_codigo = f.codigo_fornecedor_omie ?? null
        const cnpj = (f.cnpj_cpf ?? '').replace(/\D/g, '') || null

        // Tenta por omie_codigo primeiro (mais confiável)
        if (omie_codigo) {
          const { data: existing } = await supabase
            .from('fornecedores')
            .select('id')
            .eq('empresa_id', empresa_id)
            .eq('omie_codigo', omie_codigo)
            .maybeSingle()

          if (existing) {
            // Atualiza registro existente
            await supabase
              .from('fornecedores')
              .update({ nome, cnpj, ativo: f.inativo !== 'S' })
              .eq('id', existing.id)
            importados++
            continue
          }
        }

        // Tenta por CNPJ se tiver
        if (cnpj) {
          const { data: existing } = await supabase
            .from('fornecedores')
            .select('id')
            .eq('empresa_id', empresa_id)
            .eq('cnpj', cnpj)
            .maybeSingle()

          if (existing) {
            await supabase
              .from('fornecedores')
              .update({ nome, omie_codigo, ativo: f.inativo !== 'S' })
              .eq('id', existing.id)
            importados++
            continue
          }
        }

        // Insere novo
        const { error } = await supabase
          .from('fornecedores')
          .insert({ empresa_id, nome, cnpj, omie_codigo, ativo: f.inativo !== 'S' })

        if (error) {
          console.error('[sync-forn] Erro ao inserir:', nome, error.message)
          erros++
        } else {
          importados++
        }
      }

      pagina++
      if (pagina <= Math.min(pagina_inicio + MAX_PAG - 1, totalPaginas)) {
        await new Promise(r => setTimeout(r, 350))
      }
    } while (pagina <= Math.min(pagina_inicio + MAX_PAG - 1, totalPaginas))

    const proxima_pagina = pagina <= totalPaginas ? pagina : undefined

    return NextResponse.json({
      message: proxima_pagina
        ? `Continuar da página ${proxima_pagina}`
        : 'Fornecedores sincronizados',
      importados,
      erros,
      proxima_pagina,
      total_paginas: totalPaginas,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ============================================================
// FREIGHT-MS - Cron Job: Sync automático diário
// Chamado pelo GitHub Actions todo dia às 00:00 BRT
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { syncCtes } from '@/lib/omie/sync'
import { createSupabaseAdmin } from '@/lib/supabase/client'
import { createOmieClient } from '@/lib/omie/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const OMIE_BASE = 'https://app.omie.com.br/api/v1'

async function consultarCliente(codigo: number): Promise<{ nome: string; cnpj: string } | null> {
  try {
    const res = await fetch(`${OMIE_BASE}/geral/clientes/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_key:    process.env.OMIE_APP_KEY,
        app_secret: process.env.OMIE_APP_SECRET,
        call:       'ConsultarCliente',
        param:      [{ codigo_cliente_omie: codigo }],
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const nome = data.razao_social ?? data.nome_fantasia ?? ''
    if (!nome) return null
    return { nome, cnpj: (data.cnpj_cpf ?? '').replace(/\D/g, '') }
  } catch {
    return null
  }
}

async function resolverTransportadoras(empresa_id: string, supabase: any): Promise<number> {
  let totalResolvidos = 0
  const MAX_TENTATIVAS = 20

  for (let tentativa = 0; tentativa < MAX_TENTATIVAS; tentativa++) {
    const { data: ctesSemFornecedor } = await supabase
      .from('ctes')
      .select('omie_fornecedor_codigo')
      .eq('empresa_id', empresa_id)
      .eq('status', 'Pendente')
      .is('fornecedor_id', null)
      .not('omie_fornecedor_codigo', 'is', null)
      .limit(500)

    if (!ctesSemFornecedor || ctesSemFornecedor.length === 0) break

    const codigosUnicos = [...new Set(
      ctesSemFornecedor.map((c: any) => c.omie_fornecedor_codigo).filter(Boolean)
    )] as number[]

    let resolvidos = 0
    const LOTE = 5

    for (let i = 0; i < codigosUnicos.length; i += LOTE) {
      const lote = codigosUnicos.slice(i, i + LOTE)
      await Promise.all(lote.map(async (codigo) => {
        const { data: existente } = await supabase
          .from('fornecedores')
          .select('id')
          .eq('empresa_id', empresa_id)
          .eq('omie_codigo', codigo)
          .maybeSingle()

        let fornecedorId = existente?.id

        if (!fornecedorId) {
          const info = await consultarCliente(codigo)
          if (info?.nome) {
            const { data: novo } = await supabase
              .from('fornecedores')
              .upsert({
                empresa_id,
                nome:        info.nome,
                cnpj:        info.cnpj || null,
                omie_codigo: codigo,
                ativo:       true,
              }, { onConflict: 'empresa_id,omie_codigo' })
              .select('id')
              .single()
            fornecedorId = novo?.id
          }
        }

        if (fornecedorId) {
          await supabase
            .from('ctes')
            .update({ fornecedor_id: fornecedorId })
            .eq('empresa_id', empresa_id)
            .eq('omie_fornecedor_codigo', codigo)
            .is('fornecedor_id', null)
          resolvidos++
        }
      }))

      if (i + LOTE < codigosUnicos.length) {
        await new Promise(r => setTimeout(r, 500))
      }
    }

    totalResolvidos += resolvidos
    if (resolvidos === 0) break
  }

  return totalResolvidos
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const empresa_id = process.env.NEXT_PUBLIC_EMPRESA_ID
  if (!empresa_id) {
    return NextResponse.json({ error: 'EMPRESA_ID não configurado' }, { status: 500 })
  }

  try {
    console.log('[CRON] Iniciando sync automático -', new Date().toISOString())

    const supabase = createSupabaseAdmin()

    // 1. Sync CTes em lotes
    let pagina = 1
    let totalImportados = 0
    let totalAtualizados = 0
    let totalErros = 0
    let totalPaginas = 0

    while (true) {
      const resultado = await syncCtes(empresa_id, undefined, pagina)
      totalImportados  += resultado.importados ?? 0
      totalAtualizados += resultado.atualizados ?? 0
      totalErros       += resultado.erros ?? 0
      totalPaginas      = resultado.total_paginas ?? totalPaginas

      if (!resultado.proxima_pagina) break
      pagina = resultado.proxima_pagina
      await new Promise(r => setTimeout(r, 1000))
    }

    // 2. Resolver transportadoras automaticamente
    console.log('[CRON] Resolvendo transportadoras...')
    const transportadorasResolvidas = await resolverTransportadoras(empresa_id, supabase)
    console.log(`[CRON] ${transportadorasResolvidas} transportadoras resolvidas`)

    // 3. Registrar sync completo como success
    await supabase.from('sync_logs').insert({
      empresa_id,
      status: 'success',
      finalizado_em: new Date().toISOString(),
      ctes_importados: totalImportados,
      ctes_atualizados: totalAtualizados,
    })

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      importados: totalImportados,
      atualizados: totalAtualizados,
      erros: totalErros,
      total_paginas: totalPaginas,
      transportadoras_resolvidas: transportadorasResolvidas,
    })
  } catch (error: any) {
    console.error('[CRON] Erro:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

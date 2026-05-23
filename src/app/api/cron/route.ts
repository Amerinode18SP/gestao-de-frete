// ============================================================
// FREIGHT-MS - Cron Job: Sync automático diário
// Chamado pelo GitHub Actions todo dia às 00:00 BRT
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { syncCtes } from '@/lib/omie/sync'
import { createSupabaseAdmin } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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

    let pagina = 1
    let totalImportados = 0
    let totalAtualizados = 0
    let totalErros = 0
    let totalPaginas = 0
    let lote = 0

    // Itera por todos os lotes até concluir
    while (true) {
      lote++
      console.log(`[CRON] Lote ${lote}, página ${pagina}`)

      const resultado = await syncCtes(empresa_id, undefined, pagina)
      totalImportados  += resultado.importados ?? 0
      totalAtualizados += resultado.atualizados ?? 0
      totalErros       += resultado.erros ?? 0
      totalPaginas      = resultado.total_paginas ?? totalPaginas

      if (!resultado.proxima_pagina) break
      pagina = resultado.proxima_pagina

      // Pausa entre lotes para não sobrecarregar
      await new Promise(r => setTimeout(r, 1000))
    }

    // Registrar sync completo como success
    const supabase = createSupabaseAdmin()
    await supabase.from('sync_logs').insert({
      empresa_id,
      status: 'success',
      finalizado_em: new Date().toISOString(),
      ctes_importados: totalImportados,
      ctes_atualizados: totalAtualizados,
    })

    console.log('[CRON] Sync concluído:', { totalImportados, totalAtualizados, totalErros })

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      importados: totalImportados,
      atualizados: totalAtualizados,
      erros: totalErros,
      total_paginas: totalPaginas,
    })
  } catch (error: any) {
    console.error('[CRON] Erro:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

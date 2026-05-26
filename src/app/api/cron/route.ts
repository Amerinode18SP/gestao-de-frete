// ============================================================
// FREIGHT-MS - Cron Job: Sync automático diário
// Chamado pelo GitHub Actions em loop até concluir
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

  // Ler página atual do query param (padrão 1)
  const pagina = Number(req.nextUrl.searchParams.get('pagina') ?? '1')
  const modo = req.nextUrl.searchParams.get('modo') ?? 'sync'

  try {
    const supabase = createSupabaseAdmin()

    if (modo === 'resolver') {
      // Modo resolver transportadoras
      console.log('[CRON] Resolvendo transportadoras...')
      const res = await fetch(`https://gestao-de-log.vercel.app/api/omie/resolver-transportadoras`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cronSecret}`,
        },
        body: JSON.stringify({ empresa_id }),
      })
      const data = await res.json()

      if (!data.tem_mais) {
        // Registrar sync completo como success
        await supabase.from('sync_logs').insert({
          empresa_id,
          status: 'success',
          finalizado_em: new Date().toISOString(),
          ctes_importados: 0,
          ctes_atualizados: 0,
        })
      }

      return NextResponse.json({
        ok: true,
        modo: 'resolver',
        resolvidos: data.resolvidos ?? 0,
        tem_mais: data.tem_mais ?? false,
        proxima_pagina: data.tem_mais ? null : null,
      })
    }

    // Modo sync - processa 1 lote de 20 páginas
    console.log(`[CRON] Sync lote página ${pagina}`)
    const resultado = await syncCtes(empresa_id, undefined, pagina)

    return NextResponse.json({
      ok: true,
      modo: 'sync',
      importados: resultado.importados,
      atualizados: resultado.atualizados,
      erros: resultado.erros,
      proxima_pagina: resultado.proxima_pagina ?? null,
      total_paginas: resultado.total_paginas ?? null,
      concluido: !resultado.proxima_pagina,
    })
  } catch (error: any) {
    console.error('[CRON] Erro:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

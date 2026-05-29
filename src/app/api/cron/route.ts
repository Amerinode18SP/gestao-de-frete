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

  const pagina = Number(req.nextUrl.searchParams.get('pagina') ?? '1')
  const modo = req.nextUrl.searchParams.get('modo') ?? 'sync'
  const supabase = createSupabaseAdmin()

  try {
    if (modo === 'resolver') {
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
        // Sync totalmente concluído — grava data final
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
      })
    }

    // Modo sync — processa 1 lote de 20 páginas com retry
    console.log(`[CRON] Sync lote página ${pagina}`)

    let resultado: any = null
    let lastError = ''
    const MAX_TENTATIVAS = 3

    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
      try {
        resultado = await syncCtes(empresa_id, undefined, pagina)
        break // sucesso — sai do loop
      } catch (err: any) {
        lastError = err.message
        console.error(`[CRON] Tentativa ${tentativa} falhou: ${err.message}`)
        if (tentativa < MAX_TENTATIVAS) {
          await new Promise(r => setTimeout(r, 3000 * tentativa))
        }
      }
    }

    // Se todas as tentativas falharam, retorna erro mas SEM status 500
    // para o GitHub Actions não parar o loop — ele vai tentar a próxima página
    if (!resultado) {
      console.error(`[CRON] Lote ${pagina} falhou após ${MAX_TENTATIVAS} tentativas: ${lastError}`)
      
      // Pula para próxima página em vez de travar
      const proximaPagina = pagina + 20
      return NextResponse.json({
        ok: false,
        erro: lastError,
        pagina_falhou: pagina,
        proxima_pagina: proximaPagina, // continua do próximo lote
        importados: 0,
        atualizados: 0,
      })
    }

    // Sucesso — se concluiu tudo, grava data
    if (!resultado.proxima_pagina) {
      await supabase.from('sync_logs').insert({
        empresa_id,
        status: 'success',
        finalizado_em: new Date().toISOString(),
        ctes_importados: resultado.importados,
        ctes_atualizados: resultado.atualizados,
      })
    }

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
    console.error('[CRON] Erro crítico:', error.message)
    // Mesmo em erro crítico, grava data para o dashboard mostrar algo
    await supabase.from('sync_logs').insert({
      empresa_id,
      status: 'error',
      finalizado_em: new Date().toISOString(),
      ctes_importados: 0,
      ctes_atualizados: 0,
    }).then(() => {}, () => {})
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

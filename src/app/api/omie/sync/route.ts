// ============================================================
// FREIGHT-MS — API Route: POST /api/omie/sync
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { syncCtes } from '@/lib/omie/sync'
import { createSupabaseAdmin } from '@/lib/supabase/client'

// Vercel Hobby: 60s. Pro: 300s. Definimos maxDuration para o máximo disponível.
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    // Validar autorização
    const auth = req.headers.get('authorization')
    const cronKey = req.headers.get('x-cron-key')

    const isCron = cronKey === process.env.CRON_SECRET
    const isAuth = auth?.startsWith('Bearer ')

    if (!isCron && !isAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Identificar empresa e página inicial (para retomada)
    const body = await req.json().catch(() => ({}))
    const { empresa_id, pagina_inicio = 1 } = body

    if (!empresa_id) {
      return NextResponse.json({ error: 'empresa_id obrigatório' }, { status: 400 })
    }

    // Executar sync do lote atual
    const result = await syncCtes(empresa_id, undefined, pagina_inicio)

    // Se há mais páginas, retorna proxima_pagina para o cliente continuar
    return NextResponse.json({
      message: result.proxima_pagina
        ? `Lote concluído. Continuar da página ${result.proxima_pagina}/${result.total_paginas}`
        : 'Sincronização concluída',
      ...result,
    })
  } catch (err: any) {
    console.error('[POST /api/omie/sync]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET: status do último sync
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const empresa_id = searchParams.get('empresa_id')

  if (!empresa_id) {
    return NextResponse.json({ error: 'empresa_id obrigatório' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const { data } = await supabase
    .from('sync_logs')
    .select('*')
    .eq('empresa_id', empresa_id)
    .order('iniciado_em', { ascending: false })
    .limit(5)

  return NextResponse.json({ logs: data ?? [] })
}

// ============================================================
// FREIGHT-MS — API Route: POST /api/omie/sync
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { syncCtes } from '@/lib/omie/sync'
import { createSupabaseAdmin } from '@/lib/supabase/client'

export async function POST(req: NextRequest) {
  try {
    // Validar autorização (Bearer token ou chave interna para cron)
    const auth = req.headers.get('authorization')
    const cronKey = req.headers.get('x-cron-key')

    const isCron = cronKey === process.env.CRON_SECRET
    const isAuth = auth?.startsWith('Bearer ')

    if (!isCron && !isAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Identificar empresa
    const { empresa_id } = await req.json().catch(() => ({}))
    if (!empresa_id) {
      return NextResponse.json({ error: 'empresa_id obrigatório' }, { status: 400 })
    }

    // Buscar credenciais Omie da empresa (se não usar env global)
    const supabase = createSupabaseAdmin()
    const { data: empresa } = await supabase
      .from('empresas')
      .select('omie_app_key, omie_app_secret')
      .eq('id', empresa_id)
      .single()

    // Executar sync
    const result = await syncCtes(empresa_id)

    return NextResponse.json({
      message: 'Sincronização concluída',
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

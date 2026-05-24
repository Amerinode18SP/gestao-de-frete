import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const empresa_id = req.nextUrl.searchParams.get('empresa_id')
  if (!empresa_id) return NextResponse.json({ error: 'empresa_id obrigatorio' }, { status: 400 })

  const supabase = createSupabaseAdmin()

  // Pegar o log mais recente — qualquer status, ordenado por iniciado_em
  const { data } = await supabase
    .from('sync_logs')
    .select('iniciado_em, finalizado_em, status, ctes_importados, ctes_atualizados')
    .eq('empresa_id', empresa_id)
    .order('iniciado_em', { ascending: false })
    .limit(1)

  const ultimo = data?.[0]

  // Usar finalizado_em se disponível, senão iniciado_em
  const dataSync = ultimo?.finalizado_em ?? ultimo?.iniciado_em ?? null

  return NextResponse.json({
    ultimo_sync: dataSync,
    importados: ultimo?.ctes_importados ?? 0,
    atualizados: ultimo?.ctes_atualizados ?? 0,
    status: ultimo?.status ?? null,
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const empresa_id = req.nextUrl.searchParams.get('empresa_id')
  if (!empresa_id) return NextResponse.json({ error: 'empresa_id obrigatorio' }, { status: 400 })

  const supabase = createSupabaseAdmin()

  const { data } = await supabase.rpc('get_ultimo_sync', { p_empresa_id: empresa_id })

  return NextResponse.json(
    { ultimo_sync: data ?? null },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

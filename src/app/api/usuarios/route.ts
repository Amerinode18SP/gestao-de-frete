import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'

export async function GET(req: NextRequest) {
  const empresa_id = req.nextUrl.searchParams.get('empresa_id')
  if (!empresa_id) return NextResponse.json({ error: 'empresa_id obrigatorio' }, { status: 400 })

  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('perfis_usuario')
    .select('*')
    .eq('empresa_id', empresa_id)
    .order('criado_em', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ usuarios: data ?? [] })
}

export async function PATCH(req: NextRequest) {
  const { id, papel, ativo } = await req.json()
  const supabase = createSupabaseAdmin()

  const updates: any = {}
  if (papel !== undefined) updates.papel = papel
  if (ativo !== undefined) updates.ativo = ativo

  const { error } = await supabase
    .from('perfis_usuario')
    .update(updates)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

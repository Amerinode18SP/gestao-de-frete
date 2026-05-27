import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'

export async function POST(req: NextRequest) {
  try {
    const { id, nome, email, papel, empresa_id } = await req.json()
    if (!id || !email || !empresa_id) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
    }
    const supabase = createSupabaseAdmin()
    const { error } = await supabase.from('perfis_usuario').upsert({
      id,
      empresa_id,
      nome: nome || email.split('@')[0],
      email,
      papel: papel || 'visualizador',
      ativo: true,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

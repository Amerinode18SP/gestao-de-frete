import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'

export async function POST(req: NextRequest) {
  const { email, nome, papel, empresa_id } = await req.json()

  if (!email || !nome || !papel || !empresa_id) {
    return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()

  // Criar usuário no Auth com senha temporária
  const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { nome, papel }
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  const userId = authData.user.id

  // Criar perfil
  const { error: perfilError } = await supabase
    .from('perfis_usuario')
    .insert({ id: userId, empresa_id, nome, email, papel, ativo: true })

  if (perfilError) {
    return NextResponse.json({ error: perfilError.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, message: `Convite enviado para ${email}` })
}

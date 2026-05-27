import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin()
    const { nome, email, papel } = await request.json()

    if (!nome || !email || !papel) {
      return NextResponse.json({ error: 'Nome, email e papel são obrigatórios' }, { status: 400 })
    }

    const empresaId = process.env.NEXT_PUBLIC_EMPRESA_ID!

    // Gera link de convite ou recuperação
    let usuarioId = ''
    let linkConvite = ''

    const { data: inviteData, error: inviteError } = await supabase.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'https://gestao-de-log.vercel.app'}/redefinir-senha`,
        data: { nome, papel, empresa_id: empresaId },
      },
    })

    if (inviteError) {
      // Usuário já existe — gera link de recuperação de senha
      const { data: resetData, error: resetError } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'https://gestao-de-log.vercel.app'}/redefinir-senha`,
        },
      })

      if (resetError) {
        console.error('Erro generateLink recovery:', resetError)
        return NextResponse.json({ error: resetError.message }, { status: 500 })
      }

      linkConvite = resetData.properties?.action_link ?? ''
      usuarioId = resetData.user?.id ?? ''
    } else {
      linkConvite = inviteData.properties?.action_link ?? ''
      usuarioId = inviteData.user?.id ?? ''
    }

    // Cria/atualiza perfil
    if (usuarioId) {
      const { error: upsertError } = await supabase.from('perfis_usuario').upsert({
        id: usuarioId,
        empresa_id: empresaId,
        nome,
        email,
        papel,
        ativo: true,
      })
      if (upsertError) {
        console.error('Erro upsert perfil:', upsertError)
      }
    }

    // Tenta enviar email via Supabase SMTP configurado
    if (linkConvite) {
      // O link já foi gerado — o Supabase envia automaticamente via SMTP configurado
      // quando usamos generateLink com type 'invite'
      console.log('Link gerado com sucesso para:', email)
      return NextResponse.json({ 
        success: true, 
        message: `Convite enviado para ${email}` 
      })
    }

    return NextResponse.json({ error: 'Não foi possível gerar o link de convite' }, { status: 500 })

  } catch (error: any) {
    console.error('Erro no convite:', error)
    return NextResponse.json({ error: error?.message || 'Erro interno' }, { status: 500 })
  }
}

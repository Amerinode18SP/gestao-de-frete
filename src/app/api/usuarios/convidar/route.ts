import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'
import { Resend } from 'resend'


export async function POST(request: NextRequest) {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const supabase = createSupabaseAdmin()
    const { nome, email, papel } = await request.json()

    if (!nome || !email || !papel) {
      return NextResponse.json({ error: 'Nome, email e papel são obrigatórios' }, { status: 400 })
    }

    const empresaId = process.env.NEXT_PUBLIC_EMPRESA_ID!
    let linkConvite = ''
    let usuarioId = ''

    // Tenta gerar link de convite (novo usuário)
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/redefinir-senha`,
        data: { nome, papel, empresa_id: empresaId },
      },
    })

    if (inviteError) {
      // Usuário já existe — gera link de recuperação de senha
      const { data: resetData, error: resetError } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/redefinir-senha`,
        },
      })

      if (resetError) {
        return NextResponse.json({ error: resetError.message }, { status: 500 })
      }

      linkConvite = resetData.properties?.action_link ?? ''
      usuarioId = resetData.user?.id ?? ''
    } else {
      linkConvite = inviteData.properties?.action_link ?? ''
      usuarioId = inviteData.user?.id ?? ''
    }

    // Cria/atualiza perfil na tabela perfis_usuario
    if (usuarioId) {
      await supabase.from('perfis_usuario').upsert({
        id: usuarioId,
        empresa_id: empresaId,
        nome,
        email,
        papel,
        ativo: true,
      })
    }

    // Envia email via Resend
    const { error: emailError } = await resend.emails.send({
      from: 'Gestão de Log <onboarding@resend.dev>',
      to: email,
      subject: 'Amerinode — Você foi convidado para o App Gestão de Log',
      html: gerarEmailHtml(nome, papel, linkConvite),
    })

    if (emailError) {
      console.error('Erro ao enviar email:', emailError)
      return NextResponse.json({ error: 'Erro ao enviar email de convite' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: `Convite enviado para ${email}` })
  } catch (error) {
    console.error('Erro no convite:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

function gerarEmailHtml(nome: string, papel: string, link: string): string {
  const papelLabel = papel === 'administrador' ? 'Administrador' : 'Visualizador'
  const papelDescricao =
    papel === 'administrador'
      ? 'Você terá acesso completo ao sistema, incluindo importação de CTes, sincronização com Omie e gerenciamento de usuários.'
      : 'Você terá acesso de leitura ao dashboard, relatórios e alertas do sistema.'

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Convite — Gestão de Log</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="background-color:#1a1a2e;border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:13px;letter-spacing:2px;text-transform:uppercase;">Amerinode do Brasil</p>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">
                🚛 Gestão de Log
              </h1>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;padding:40px;">
              <h2 style="margin:0 0 8px;color:#1a1a2e;font-size:22px;font-weight:600;">
                Olá, ${nome}! 👋
              </h2>
              <p style="margin:0 0 24px;color:#64748b;font-size:15px;line-height:1.6;">
                Você foi convidado para acessar o <strong>App Gestão de Log</strong> da Amerinode do Brasil.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="background-color:#f0f4ff;border:1px solid #c7d2fe;border-radius:8px;padding:16px 20px;">
                    <p style="margin:0 0 4px;color:#4f46e5;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Seu perfil de acesso</p>
                    <p style="margin:0 0 8px;color:#1e1b4b;font-size:18px;font-weight:700;">${papelLabel}</p>
                    <p style="margin:0;color:#64748b;font-size:13px;line-height:1.5;">${papelDescricao}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 24px;color:#64748b;font-size:15px;line-height:1.6;">
                Clique no botão abaixo para criar sua senha e acessar o sistema:
              </p>
              <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="background-color:#4f46e5;border-radius:8px;">
                    <a href="${link}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:0.3px;">
                      Criar minha senha e acessar →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;">
                Se o botão não funcionar, copie e cole este link no navegador:
              </p>
              <p style="margin:0 0 32px;word-break:break-all;">
                <a href="${link}" style="color:#4f46e5;font-size:12px;">${link}</a>
              </p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 24px;">
              <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;">
                ⚠️ Este link expira em <strong>24 horas</strong>. Se você não esperava este convite, ignore este email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8fafc;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">
                Amerinode do Brasil · App Gestão de Log<br>
                Este é um email automático, não responda.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `
}
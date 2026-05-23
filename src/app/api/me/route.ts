import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createSupabaseAdmin } from '@/lib/supabase/client'

export async function GET(req: NextRequest) {
  try {
    // Criar client com cookies da request
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => req.cookies.getAll(),
          setAll: () => {},
        },
      }
    )

    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Buscar perfil com service role
    const admin = createSupabaseAdmin()
    const { data: perfil } = await admin
      .from('perfis_usuario')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (!perfil) {
      // Tentar pelo email
      const { data: perfilEmail } = await admin
        .from('perfis_usuario')
        .select('*')
        .eq('email', user.email ?? '')
        .maybeSingle()
      
      if (perfilEmail) {
        return NextResponse.json({ perfil: perfilEmail })
      }
      return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })
    }

    return NextResponse.json({ perfil })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

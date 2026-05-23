'use client'

import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase/client'

export interface UserProfile {
  id: string
  nome: string
  email: string
  papel: 'administrador' | 'visualizador'
  ativo: boolean
}

export function useAuth() {
  const supabase = createSupabaseBrowser()
  const [perfil, setPerfil] = useState<UserProfile | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setCarregando(false); return }

      const { data } = await supabase
        .from('perfis_usuario')
        .select('*')
        .eq('id', user.id)
        .single()

      setPerfil(data as UserProfile ?? null)
      setCarregando(false)
    }
    carregar()
  }, [])

  const isAdmin = perfil?.papel === 'administrador'
  const isVisualizer = perfil?.papel === 'visualizador'

  async function sair() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return { perfil, carregando, isAdmin, isVisualizer, sair }
}

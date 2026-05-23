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
      try {
        // Buscar sessão atual
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          setCarregando(false)
          return
        }

        const user = session.user

        // Buscar perfil pelo id (UUID do auth)
        const { data, error } = await supabase
          .from('perfis_usuario')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()

        if (error) {
          console.error('[useAuth] Erro ao buscar perfil:', error.message)
        }

        if (data) {
          setPerfil(data as UserProfile)
        } else {
          // Fallback: buscar pelo email
          const { data: data2 } = await supabase
            .from('perfis_usuario')
            .select('*')
            .eq('email', user.email ?? '')
            .maybeSingle()
          setPerfil(data2 as UserProfile ?? null)
        }
      } catch (e) {
        console.error('[useAuth] Erro:', e)
      }
      setCarregando(false)
    }
    carregar()

    // Ouvir mudanças de sessão
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setPerfil(null)
        setCarregando(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const isAdmin = perfil?.papel === 'administrador'
  const isVisualizer = perfil?.papel === 'visualizador'

  async function sair() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return { perfil, carregando, isAdmin, isVisualizer, sair }
}

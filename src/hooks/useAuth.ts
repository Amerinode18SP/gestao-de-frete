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
        const res = await fetch('/api/me')
        if (res.ok) {
          const data = await res.json()
          setPerfil(data.perfil ?? null)
        }
      } catch (e) {
        console.error('[useAuth]', e)
      }
      setCarregando(false)
    }
    carregar()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setPerfil(null)
      } else if (event === 'SIGNED_IN') {
        carregar()
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

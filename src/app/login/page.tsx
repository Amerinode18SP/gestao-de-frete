'use client'

import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const supabase = createSupabaseBrowser()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setCarregando(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
      if (error) {
        setErro('Email ou senha incorretos.')
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch {
      setErro('Erro ao conectar. Tente novamente.')
    }
    setCarregando(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F0EEE8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E8E6E0', padding: '40px', width: '100%', maxWidth: '380px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🚛</div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#1A1916', margin: '0 0 4px' }}>Gestão de Frete</h1>
          <p style={{ fontSize: '13px', color: '#888780', margin: 0 }}>Entre com sua conta para continuar</p>
        </div>

        <form onSubmit={entrar}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', fontWeight: '500', color: '#444441', display: 'block', marginBottom: '6px' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D8D6D0', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ fontSize: '12px', fontWeight: '500', color: '#444441', display: 'block', marginBottom: '6px' }}>Senha</label>
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              placeholder="••••••••"
              required
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D8D6D0', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {erro && (
            <div style={{ background: '#FFEBEE', border: '1px solid #FFCDD2', borderRadius: '8px', padding: '10px 12px', marginBottom: '16px', fontSize: '13px', color: '#C62828' }}>
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={carregando}
            style={{ width: '100%', padding: '11px', background: carregando ? '#888' : '#1A1916', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: carregando ? 'not-allowed' : 'pointer' }}
          >
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createSupabaseBrowser()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    })

    if (error) {
      setErro(
        error.message.includes('Invalid login')
          ? 'E-mail ou senha incorretos.'
          : error.message.includes('Email not confirmed')
          ? 'Confirme seu e-mail antes de entrar.'
          : 'Erro ao entrar. Tente novamente.'
      )
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#F5F4F0', padding: '16px'
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '52px', height: '52px', background: '#185FA5',
            borderRadius: '12px', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', marginBottom: '12px'
          }}>🚚</div>
          <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#1A1916', margin: '0 0 4px' }}>
            Gestão de Frete
          </h1>
          <p style={{ fontSize: '13px', color: '#888780', margin: 0 }}>
            Faça login para acessar o sistema
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: '#fff', borderRadius: '12px',
          border: '0.5px solid #E2E0D8', padding: '28px'
        }}>
          <form onSubmit={handleLogin}>

            {/* Erro */}
            {erro && (
              <div style={{
                background: '#FCEBEB', border: '0.5px solid #E8AEAE',
                borderRadius: '8px', padding: '10px 14px',
                fontSize: '13px', color: '#791F1F', marginBottom: '16px',
                display: 'flex', alignItems: 'center', gap: '8px'
              }}>
                ⚠️ {erro}
              </div>
            )}

            {/* Email */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: '500', color: '#444441', display: 'block', marginBottom: '6px' }}>
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com.br"
                required
                style={{
                  width: '100%', padding: '10px 12px', fontSize: '14px',
                  border: '0.5px solid #D4D2CA', borderRadius: '8px',
                  outline: 'none', background: '#FAFAF8', boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Senha */}
            <div style={{ marginBottom: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: '500', color: '#444441', display: 'block', marginBottom: '6px' }}>
                Senha
              </label>
              <input
                type="password"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%', padding: '10px 12px', fontSize: '14px',
                  border: '0.5px solid #D4D2CA', borderRadius: '8px',
                  outline: 'none', background: '#FAFAF8', boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Esqueci senha */}
            <div style={{ textAlign: 'right', marginBottom: '20px' }}>
              <Link href="/esqueci-senha" style={{
                fontSize: '12px', color: '#185FA5', textDecoration: 'none'
              }}>
                Esqueci minha senha
              </Link>
            </div>

            {/* Botão */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '11px', fontSize: '14px',
                fontWeight: '500', background: loading ? '#85B7EB' : '#185FA5',
                color: '#fff', border: 'none', borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer', transition: 'background .2s'
              }}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>

          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: '12px', color: '#888780', marginTop: '16px' }}>
          Gestão de Frete © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}

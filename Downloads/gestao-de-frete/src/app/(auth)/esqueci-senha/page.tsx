'use client'

import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase/client'
import Link from 'next/link'

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createSupabaseBrowser()

  async function handleEnviar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })

    if (error) {
      setErro('Erro ao enviar e-mail. Verifique o endereço digitado.')
      setLoading(false)
      return
    }

    setEnviado(true)
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#F5F4F0', padding: '16px'
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '52px', height: '52px', background: '#185FA5',
            borderRadius: '12px', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', marginBottom: '12px'
          }}>🚚</div>
          <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#1A1916', margin: '0 0 4px' }}>
            Recuperar senha
          </h1>
          <p style={{ fontSize: '13px', color: '#888780', margin: 0 }}>
            {enviado ? 'Verifique seu e-mail' : 'Enviaremos um link de redefinição'}
          </p>
        </div>

        <div style={{
          background: '#fff', borderRadius: '12px',
          border: '0.5px solid #E2E0D8', padding: '28px'
        }}>

          {enviado ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📧</div>
              <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#1A1916', marginBottom: '8px' }}>
                E-mail enviado!
              </h2>
              <p style={{ fontSize: '13px', color: '#888780', marginBottom: '20px', lineHeight: '1.6' }}>
                Enviamos um link de redefinição para <strong>{email}</strong>.
                Verifique também a pasta de spam.
              </p>
              <Link href="/login" style={{
                display: 'block', padding: '11px', fontSize: '14px',
                fontWeight: '500', background: '#185FA5', color: '#fff',
                borderRadius: '8px', textDecoration: 'none', textAlign: 'center'
              }}>
                Voltar ao login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleEnviar}>
              {erro && (
                <div style={{
                  background: '#FCEBEB', border: '0.5px solid #E8AEAE',
                  borderRadius: '8px', padding: '10px 14px',
                  fontSize: '13px', color: '#791F1F', marginBottom: '16px'
                }}>
                  ⚠️ {erro}
                </div>
              )}

              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#444441', display: 'block', marginBottom: '6px' }}>
                  E-mail cadastrado
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

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', padding: '11px', fontSize: '14px',
                  fontWeight: '500', background: loading ? '#85B7EB' : '#185FA5',
                  color: '#fff', border: 'none', borderRadius: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer', marginBottom: '12px'
                }}
              >
                {loading ? 'Enviando...' : 'Enviar link de recuperação'}
              </button>

              <div style={{ textAlign: 'center' }}>
                <Link href="/login" style={{ fontSize: '13px', color: '#185FA5', textDecoration: 'none' }}>
                  ← Voltar ao login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function RedefinirSenhaPage() {
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const router = useRouter()
  const supabase = createSupabaseBrowser()

  async function handleRedefinir(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    if (novaSenha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (novaSenha !== confirmar) {
      setErro('As senhas não coincidem.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: novaSenha })

    if (error) {
      setErro('Erro ao redefinir senha. O link pode ter expirado.')
      setLoading(false)
      return
    }

    setSucesso(true)
    setTimeout(() => router.push('/login'), 3000)
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
            alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '12px'
          }}>🚚</div>
          <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#1A1916', margin: '0 0 4px' }}>
            Nova senha
          </h1>
        </div>

        <div style={{ background: '#fff', borderRadius: '12px', border: '0.5px solid #E2E0D8', padding: '28px' }}>
          {sucesso ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
              <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>Senha redefinida!</h2>
              <p style={{ fontSize: '13px', color: '#888780' }}>Redirecionando para o login...</p>
            </div>
          ) : (
            <form onSubmit={handleRedefinir}>
              {erro && (
                <div style={{
                  background: '#FCEBEB', border: '0.5px solid #E8AEAE', borderRadius: '8px',
                  padding: '10px 14px', fontSize: '13px', color: '#791F1F', marginBottom: '16px'
                }}>⚠️ {erro}</div>
              )}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#444441', display: 'block', marginBottom: '6px' }}>Nova senha</label>
                <input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)}
                  placeholder="Mínimo 6 caracteres" required
                  style={{ width: '100%', padding: '10px 12px', fontSize: '14px', border: '0.5px solid #D4D2CA', borderRadius: '8px', outline: 'none', background: '#FAFAF8', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#444441', display: 'block', marginBottom: '6px' }}>Confirmar senha</label>
                <input type="password" value={confirmar} onChange={e => setConfirmar(e.target.value)}
                  placeholder="Repita a senha" required
                  style={{ width: '100%', padding: '10px 12px', fontSize: '14px', border: '0.5px solid #D4D2CA', borderRadius: '8px', outline: 'none', background: '#FAFAF8', boxSizing: 'border-box' }} />
              </div>
              <button type="submit" disabled={loading}
                style={{ width: '100%', padding: '11px', fontSize: '14px', fontWeight: '500', background: loading ? '#85B7EB' : '#185FA5', color: '#fff', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer' }}>
                {loading ? 'Salvando...' : 'Redefinir senha'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

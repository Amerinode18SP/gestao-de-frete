'use client'

import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [aba, setAba] = useState<'entrar' | 'cadastrar'>('entrar')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [nome, setNome] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createSupabaseBrowser()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })

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

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setMensagem('')

    if (senha !== confirmar) {
      setErro('As senhas não coincidem.')
      return
    }
    if (senha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { nome } },
    })

    if (error) {
      setErro(error.message.includes('already registered')
        ? 'Este e-mail já está cadastrado.'
        : error.message)
      setLoading(false)
      return
    }

    // Cria perfil na tabela perfis_usuario
    if (data.user) {
      await fetch('/api/usuarios/perfil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: data.user.id,
          nome,
          email,
          papel: 'visualizador',
          empresa_id: process.env.NEXT_PUBLIC_EMPRESA_ID,
        }),
      })
    }

    setMensagem('Cadastro realizado! Você já pode entrar.')
    setAba('entrar')
    setSenha('')
    setConfirmar('')
    setLoading(false)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', fontSize: '14px',
    border: '0.5px solid #D4D2CA', borderRadius: '8px',
    outline: 'none', background: '#FAFAF8', boxSizing: 'border-box',
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#F5F4F0', padding: '16px',
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '52px', height: '52px', background: '#185FA5',
            borderRadius: '12px', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', marginBottom: '12px',
          }}>🚛</div>
          <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#1A1916', margin: '0 0 4px' }}>
            Gestão de Log
          </h1>
          <p style={{ fontSize: '13px', color: '#888780', margin: 0 }}>
            Sistema de gestão de fretes
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: '#fff', borderRadius: '12px',
          border: '0.5px solid #E2E0D8', overflow: 'hidden',
        }}>

          {/* Abas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #E2E0D8' }}>
            {(['entrar', 'cadastrar'] as const).map(a => (
              <button key={a} onClick={() => { setAba(a); setErro(''); setMensagem('') }}
                style={{
                  padding: '14px', fontSize: '14px', fontWeight: '500',
                  border: 'none', cursor: 'pointer', transition: 'all .15s',
                  background: aba === a ? '#fff' : '#F8F7F4',
                  color: aba === a ? '#185FA5' : '#888780',
                  borderBottom: aba === a ? '2px solid #185FA5' : '2px solid transparent',
                }}>
                {a === 'entrar' ? 'Entrar' : 'Cadastrar'}
              </button>
            ))}
          </div>

          <div style={{ padding: '28px' }}>

            {/* Mensagem de sucesso */}
            {mensagem && (
              <div style={{
                background: '#EAF3DE', border: '0.5px solid #B3D48A',
                borderRadius: '8px', padding: '10px 14px',
                fontSize: '13px', color: '#27500A', marginBottom: '16px',
              }}>
                ✅ {mensagem}
              </div>
            )}

            {/* Erro */}
            {erro && (
              <div style={{
                background: '#FCEBEB', border: '0.5px solid #E8AEAE',
                borderRadius: '8px', padding: '10px 14px',
                fontSize: '13px', color: '#791F1F', marginBottom: '16px',
              }}>
                ⚠️ {erro}
              </div>
            )}

            {/* ABA ENTRAR */}
            {aba === 'entrar' && (
              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '500', color: '#444441', display: 'block', marginBottom: '6px' }}>E-mail</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="seu@email.com.br" required style={inputStyle} />
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '500', color: '#444441', display: 'block', marginBottom: '6px' }}>Senha</label>
                  <input type="password" value={senha} onChange={e => setSenha(e.target.value)}
                    placeholder="••••••••" required style={inputStyle} />
                </div>
                <div style={{ textAlign: 'right', marginBottom: '20px' }}>
                  <Link href="/esqueci-senha" style={{ fontSize: '12px', color: '#185FA5', textDecoration: 'none' }}>
                    Esqueci minha senha
                  </Link>
                </div>
                <button type="submit" disabled={loading} style={{
                  width: '100%', padding: '11px', fontSize: '14px', fontWeight: '500',
                  background: loading ? '#85B7EB' : '#185FA5', color: '#fff',
                  border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer',
                }}>
                  {loading ? 'Entrando...' : 'Entrar'}
                </button>
              </form>
            )}

            {/* ABA CADASTRAR */}
            {aba === 'cadastrar' && (
              <form onSubmit={handleCadastro}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '500', color: '#444441', display: 'block', marginBottom: '6px' }}>Nome completo</label>
                  <input type="text" value={nome} onChange={e => setNome(e.target.value)}
                    placeholder="Seu nome" required style={inputStyle} />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '500', color: '#444441', display: 'block', marginBottom: '6px' }}>E-mail</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="seu@email.com.br" required style={inputStyle} />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '500', color: '#444441', display: 'block', marginBottom: '6px' }}>Senha</label>
                  <input type="password" value={senha} onChange={e => setSenha(e.target.value)}
                    placeholder="Mínimo 6 caracteres" required style={inputStyle} />
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '500', color: '#444441', display: 'block', marginBottom: '6px' }}>Confirmar senha</label>
                  <input type="password" value={confirmar} onChange={e => setConfirmar(e.target.value)}
                    placeholder="Repita a senha" required style={inputStyle} />
                </div>
                <button type="submit" disabled={loading} style={{
                  width: '100%', padding: '11px', fontSize: '14px', fontWeight: '500',
                  background: loading ? '#85B7EB' : '#185FA5', color: '#fff',
                  border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer',
                }}>
                  {loading ? 'Cadastrando...' : 'Criar conta'}
                </button>
              </form>
            )}

          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: '12px', color: '#888780', marginTop: '16px' }}>
          Gestão de Log © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
